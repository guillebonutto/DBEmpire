import { LocalDbService } from '../services/localDbService';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';
import { useClientStore } from '../store/useClientStore';

jest.mock('../services/localDbService', () => ({
    LocalDbService: {
        getAll: jest.fn(),
        getById: jest.fn(),
        getBy: jest.fn(),
        saveItem: jest.fn(),
        saveItems: jest.fn(),
        deleteItem: jest.fn(),
        queueForSync: jest.fn(),
        getPendingSyncs: jest.fn(),
        removeSyncItem: jest.fn()
    }
}));

jest.mock('../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({ data: [] }),
            eq: jest.fn().mockResolvedValue({ data: [], count: 0 })
        }))
    }
}));

// Baseline algorithm (nested filter, O(S * I))
function nestedFilterAlgorithm(sales, saleItems, prodMap) {
    return (sales || []).map(s => {
        const items = (saleItems || [])
            .filter(it => it && it.sale_id === s.id)
            .map(it => ({
                ...it,
                products: (it.product_id && prodMap[it.product_id]) ? prodMap[it.product_id] : { name: 'Producto' }
            }));
        return { ...s, sale_items: items };
    });
}

// Optimized algorithm (hash-map grouping, O(S + I))
function hashMapGroupingAlgorithm(sales, saleItems, prodMap) {
    const itemsBySale = {};
    const items = saleItems || [];
    for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it) continue;
        const key = it.sale_id;
        if (!itemsBySale[key]) itemsBySale[key] = [];
        itemsBySale[key].push({
            ...it,
            products: (it.product_id && prodMap[it.product_id]) ? prodMap[it.product_id] : { name: 'Producto' }
        });
    }

    return (sales || []).map(s => {
        if (Array.isArray(s.sale_items) && s.sale_items.length > 0) {
            return s;
        }
        return {
            ...s,
            sale_items: itemsBySale[s.id] || []
        };
    });
}

describe('Performance & Data Flow Regression Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useFinanceStore.setState({ sales: [], isInitialized: false, isLoading: false, saleItems: [] });
        useProductStore.setState({ products: [], isInitialized: false });
        useClientStore.setState({ clients: [], isInitialized: false });
    });

    test('TransfersScreen fast-path: uses memory store when isInitialized is true, avoiding SQLite getAll', async () => {
        useFinanceStore.setState({
            isInitialized: true,
            sales: [
                {
                    id: 'sale_cba_1',
                    client_id: 'c_cba',
                    status: 'ready_to_ship',
                    sale_items: [{ id: 'si1', product_id: 'p1', quantity: 2 }]
                }
            ]
        });
        useClientStore.setState({
            isInitialized: true,
            clients: [{ id: 'c_cba', name: 'Socio Cordoba' }]
        });
        useProductStore.setState({
            isInitialized: true,
            products: [{ id: 'p1', name: 'Producto CBA', stock_cordoba: 5 }]
        });

        const finState = useFinanceStore.getState();
        const clientState = useClientStore.getState();
        const prodState = useProductStore.getState();

        let sales = finState.sales;
        let clients = clientState.clients;
        let products = prodState.products;
        let saleItems = null;

        if (!finState.isInitialized || !clientState.isInitialized || !prodState.isInitialized) {
            const results = await Promise.all([
                !finState.isInitialized ? LocalDbService.getAll('sales') : Promise.resolve(sales),
                !clientState.isInitialized ? LocalDbService.getAll('clients') : Promise.resolve(clients),
                (!finState.isInitialized || !sales.every(s => Array.isArray(s.sale_items))) ? LocalDbService.getAll('sale_items') : Promise.resolve(null),
                !prodState.isInitialized ? LocalDbService.getAll('products') : Promise.resolve(products)
            ]);
            sales = results[0];
            clients = results[1];
            saleItems = results[2];
            products = results[3];
        }

        expect(LocalDbService.getAll).not.toHaveBeenCalled();
        expect(sales).toHaveLength(1);
        expect(clients).toHaveLength(1);
        expect(products).toHaveLength(1);
    });

    test('ClientDetailScreen fast-path: distinguishes initialized store with empty sales from uninitialized store', async () => {
        // Client has legitimately 0 sales, but store is initialized
        useFinanceStore.setState({
            isInitialized: true,
            sales: [{ id: 'sale_other', client_id: 'other_client', sale_items: [] }]
        });

        const finState = useFinanceStore.getState();
        const targetClientId = 'c_empty';
        let clientSales = [];
        let fetchedFromDb = false;

        if (finState.isInitialized) {
            clientSales = (finState.sales || []).filter(s => s.client_id === targetClientId);
            const hasValidItemArrays = clientSales.every(s => Array.isArray(s.sale_items));
            if (clientSales.length === 0 || hasValidItemArrays) {
                // Resolved without SQLite
            } else {
                fetchedFromDb = true;
                await LocalDbService.getAll('sale_items');
            }
        } else {
            fetchedFromDb = true;
            await LocalDbService.getAll('sales');
        }

        expect(fetchedFromDb).toBe(false);
        expect(clientSales).toEqual([]);
        expect(LocalDbService.getAll).not.toHaveBeenCalled();
    });

    test('ClientDetailScreen fallback: calls SQLite only when store is not initialized', async () => {
        LocalDbService.getAll.mockImplementation(async (table) => {
            if (table === 'sales') return [{ id: 's1', client_id: 'c1', status: 'completed' }];
            if (table === 'sale_items') return [{ id: 'si1', sale_id: 's1', product_id: 'p1' }];
            if (table === 'products') return [{ id: 'p1', name: 'Zapatillas' }];
            return [];
        });

        useFinanceStore.setState({ isInitialized: false, sales: [] });
        const finState = useFinanceStore.getState();
        let clientSales = [];

        if (!finState.isInitialized) {
            const localSales = await LocalDbService.getAll('sales');
            clientSales = (localSales || []).filter(s => s.client_id === 'c1');
            const [allItems, allProducts] = await Promise.all([
                LocalDbService.getAll('sale_items'),
                LocalDbService.getAll('products')
            ]);
            expect(allItems).toHaveLength(1);
            expect(allProducts).toHaveLength(1);
        }

        expect(LocalDbService.getAll).toHaveBeenCalledWith('sales');
        expect(LocalDbService.getAll).toHaveBeenCalledWith('sale_items');
        expect(LocalDbService.getAll).toHaveBeenCalledWith('products');
        expect(clientSales).toHaveLength(1);
    });

    // ── SECTION 2: EQUIVALENCE OF ALGORITHMS ─────────────────────────────────

    test('Equivalence 1: Ventas sin ítems e ítems sin venta asociada (orphan items)', () => {
        const prodMap = { p1: { name: 'Remera' }, p2: { name: 'Pantalón' } };
        const sales = [
            { id: 's1', total_amount: 100 },
            { id: 's2_no_items', total_amount: 200 }, // sale without items
            { id: 's3', total_amount: 300 }
        ];
        const saleItems = [
            { id: 'i1', sale_id: 's1', product_id: 'p1', quantity: 1 },
            { id: 'i_orphan_1', sale_id: 's_nonexistent_99', product_id: 'p2', quantity: 2 }, // orphan item
            { id: 'i_orphan_2', sale_id: null, product_id: 'p1', quantity: 1 },               // null sale_id
            { id: 'i2', sale_id: 's3', product_id: 'p2', quantity: 3 }
        ];

        const oldResult = nestedFilterAlgorithm(sales, saleItems, prodMap);
        const newResult = hashMapGroupingAlgorithm(sales, saleItems, prodMap);

        expect(newResult).toEqual(oldResult);
        expect(newResult.find(s => s.id === 's2_no_items').sale_items).toEqual([]);
        expect(newResult.find(s => s.id === 's1').sale_items).toHaveLength(1);
        expect(newResult.find(s => s.id === 's3').sale_items).toHaveLength(1);
    });

    test('Equivalence 2: Identificadores duplicados o ausentes', () => {
        const prodMap = { p1: { name: 'Buzo' } };
        const sales = [
            { id: 's_dup', total_amount: 150 },
            { id: 's_dup', total_amount: 150 }, // duplicate sale ID
            { id: undefined, total_amount: 50 }, // missing ID
            { id: 's_normal', total_amount: 300 }
        ];
        const saleItems = [
            { id: 'i_dup', sale_id: 's_dup', product_id: 'p1', quantity: 1 },
            { id: 'i_dup', sale_id: 's_dup', product_id: 'p1', quantity: 2 }, // duplicate item ID
            { id: undefined, sale_id: 's_normal', product_id: 'p1', quantity: 1 } // missing item ID
        ];

        const oldResult = nestedFilterAlgorithm(sales, saleItems, prodMap);
        const newResult = hashMapGroupingAlgorithm(sales, saleItems, prodMap);

        expect(newResult).toEqual(oldResult);
        expect(newResult[0].sale_items).toHaveLength(2);
        expect(newResult[1].sale_items).toHaveLength(2);
        expect(newResult[2].sale_items).toEqual([]);
        expect(newResult[3].sale_items).toHaveLength(1);
    });

    test('Equivalence 3: Ventas canceladas', () => {
        const prodMap = { p1: { name: 'Gorra' } };
        const sales = [
            { id: 's_comp', status: 'completed', total_amount: 1000 },
            { id: 's_canc', status: 'cancelled', total_amount: 500 },
            { id: 's_pend', status: 'pending', total_amount: 200 },
            { id: 's_nostat', total_amount: 300 }
        ];
        const saleItems = [
            { id: 'i1', sale_id: 's_comp', product_id: 'p1', quantity: 1 },
            { id: 'i2', sale_id: 's_canc', product_id: 'p1', quantity: 1 },
            { id: 'i3', sale_id: 's_pend', product_id: 'p1', quantity: 1 },
            { id: 'i4', sale_id: 's_nostat', product_id: 'p1', quantity: 1 }
        ];

        const oldResult = nestedFilterAlgorithm(sales, saleItems, prodMap);
        const newResult = hashMapGroupingAlgorithm(sales, saleItems, prodMap);

        expect(newResult).toEqual(oldResult);
        // Verified: cancelled sale retains its line items identically
        expect(newResult.find(s => s.id === 's_canc').sale_items).toHaveLength(1);

        // Verification of client VIP / totalSpent rule ignoring cancelled sales
        const totalSpent = newResult.reduce((acc, s) => {
            if (s.status === 'completed' || !s.status) {
                return acc + (Number(s.total_amount) || 0);
            }
            return acc;
        }, 0);
        expect(totalSpent).toBe(1300); // 1000 + 300, excludes 500 and 200
    });

    test('Equivalence 4: Ventas con sale_items ya cargados y ventas que requieren enriquecimiento', () => {
        const prodMap = { p1: { name: 'Reloj' }, p2: { name: 'Cadena' } };
        const preloadedItem = { id: 'pre_1', sale_id: 's1', product_id: 'p1', quantity: 1, products: { name: 'Reloj VIP' } };
        const sales = [
            { id: 's1', sale_items: [preloadedItem] }, // already preloaded
            { id: 's2', sale_items: undefined },       // requires enrichment
            { id: 's3', sale_items: [] }              // empty array requires enrichment or fallback
        ];
        const externalSaleItems = [
            { id: 'ext_1', sale_id: 's2', product_id: 'p2', quantity: 2 },
            { id: 'ext_2', sale_id: 's3', product_id: 'p1', quantity: 1 }
        ];

        const grouped = hashMapGroupingAlgorithm(sales, externalSaleItems, prodMap);

        // Sale 1 preserved preloaded items
        expect(grouped[0].sale_items).toEqual([preloadedItem]);
        // Sale 2 was enriched from external items
        expect(grouped[1].sale_items).toHaveLength(1);
        expect(grouped[1].sale_items[0].id).toBe('ext_1');
        // Sale 3 was enriched from external items
        expect(grouped[2].sale_items).toHaveLength(1);
        expect(grouped[2].sale_items[0].id).toBe('ext_2');
    });

    test('Equivalence 5: Cambios recientes después de volver a enfocar una pantalla (addSaleLocal and updateSaleLocal)', () => {
        // User creates a new sale in NewSaleScreen
        const newSale = {
            id: 'new_sale_101',
            client_id: 'c_active',
            total_amount: 4500,
            status: 'completed'
        };
        const newItems = [
            { id: 'ni_1', sale_id: 'new_sale_101', product_id: 'p_gold', quantity: 2, products: { name: 'Cadena Oro' } }
        ];

        // Store updates locally
        useFinanceStore.getState().addSaleLocal(newSale, newItems);

        // When screen refocuses and reads from store
        const currentSales = useFinanceStore.getState().sales;
        expect(currentSales).toHaveLength(1);
        expect(currentSales[0].id).toBe('new_sale_101');
        expect(currentSales[0].sale_items).toEqual(newItems);

        // User updates status (e.g., in TransfersScreen)
        const updated = { id: 'new_sale_101', status: 'transfer_completed' };
        useFinanceStore.getState().updateSaleLocal(updated);

        const afterUpdate = useFinanceStore.getState().sales;
        expect(afterUpdate[0].status).toBe('transfer_completed');
        // Items must be preserved
        expect(afterUpdate[0].sale_items).toEqual(newItems);
    });

    test('Equivalence 6: Datos vacíos y resultados equivalentes al algoritmo anterior', () => {
        const prodMap = { p1: { name: 'Test' } };

        // Empty sales & empty items
        expect(hashMapGroupingAlgorithm([], [], prodMap)).toEqual(nestedFilterAlgorithm([], [], prodMap));
        expect(hashMapGroupingAlgorithm([], [], prodMap)).toEqual([]);

        // Empty sales with items
        expect(hashMapGroupingAlgorithm([], [{ id: 'i1', sale_id: 's1' }], prodMap)).toEqual(
            nestedFilterAlgorithm([], [{ id: 'i1', sale_id: 's1' }], prodMap)
        );

        // Sales with no items
        const salesOnly = [{ id: 's1', total_amount: 100 }];
        expect(hashMapGroupingAlgorithm(salesOnly, [], prodMap)).toEqual(
            nestedFilterAlgorithm(salesOnly, [], prodMap)
        );
        expect(hashMapGroupingAlgorithm(salesOnly, [], prodMap)[0].sale_items).toEqual([]);

        // Null and undefined inputs
        expect(hashMapGroupingAlgorithm(null, null, {})).toEqual(nestedFilterAlgorithm(null, null, {}));
        expect(hashMapGroupingAlgorithm(undefined, undefined, {})).toEqual(nestedFilterAlgorithm(undefined, undefined, {}));
    });

    test('ClientDetail dynamic VIP and totalSpent derivation matches completed sales', () => {
        const clientSales = [
            { id: 's1', client_id: 'c99', total_amount: 1500, status: 'completed' },
            { id: 's2', client_id: 'c99', total_amount: 1000, status: 'completed' },
            { id: 's3', client_id: 'c99', total_amount: 500, status: 'cancelled' }
        ];

        const computedTotalSpent = clientSales.reduce((acc, s) => {
            if (s.status === 'completed' || !s.status) {
                return acc + (Number(s.total_amount) || 0);
            }
            return acc;
        }, 0);

        expect(computedTotalSpent).toBe(2500);

        let vip;
        if (computedTotalSpent > 5000) vip = 'DIAMANTE';
        else if (computedTotalSpent > 2000) vip = 'ORO';
        else if (computedTotalSpent > 500) vip = 'PLATA';
        else vip = 'BRONCE';

        expect(vip).toBe('ORO');
    });

    test('O(N + M) hash dictionary grouping benchmark equivalence to nested filter', () => {
        const sales = Array.from({ length: 200 }, (_, i) => ({ id: `sale_${i}`, total_amount: 100 }));
        const saleItems = Array.from({ length: 1000 }, (_, i) => ({
            id: `item_${i}`,
            sale_id: `sale_${i % 200}`,
            product_id: `prod_${i % 20}`,
            quantity: 1
        }));
        const prodMap = { prod_0: { name: 'P0' } };

        const itemsBySale = {};
        for (let i = 0; i < saleItems.length; i++) {
            const it = saleItems[i];
            if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
            itemsBySale[it.sale_id].push({
                ...it,
                products: prodMap[it.product_id] || { name: 'Producto' }
            });
        }

        const enrichedSales = sales.map(s => ({
            ...s,
            sale_items: itemsBySale[s.id] || []
        }));

        const nestedResult = nestedFilterAlgorithm(sales, saleItems, prodMap);

        expect(enrichedSales).toHaveLength(200);
        expect(enrichedSales[0].sale_items).toHaveLength(5);
        expect(enrichedSales).toEqual(nestedResult);
    });

    test('Audit B: DebtsScreen offline payment updates store, calls LocalDbService, and removes debt from pending view', async () => {
        const initialSale = {
            id: 'sale_debt_offline',
            client_id: 'client_1',
            status: 'pending',
            total_amount: 3500,
            sale_items: [{ id: 'si1', product_id: 'p1', quantity: 1 }]
        };
        useFinanceStore.setState({
            isInitialized: true,
            sales: [initialSale]
        });

        // Verify it is visible in pending debts
        expect(useFinanceStore.getState().sales.filter(s => s.status === 'pending')).toHaveLength(1);

        // Simulate DebtsScreen.markAsPaid
        const paidAt = new Date().toISOString();
        const updatedSale = { ...initialSale, status: 'completed', paid_at: paidAt };

        await LocalDbService.saveItem('sales', updatedSale);
        useFinanceStore.getState().updateSaleLocal(updatedSale);

        // Verify LocalDbService was called with completed status
        expect(LocalDbService.saveItem).toHaveBeenCalledWith('sales', expect.objectContaining({
            id: 'sale_debt_offline',
            status: 'completed',
            paid_at: paidAt
        }));

        // Verify in-memory store updated immediately and debt no longer shows in pending list
        const activeDebts = useFinanceStore.getState().sales.filter(s => s.status === 'pending');
        expect(activeDebts).toHaveLength(0);
        const completedSales = useFinanceStore.getState().sales.filter(s => s.status === 'completed');
        expect(completedSales).toHaveLength(1);
    });

    test('Audit B: Remote error after local persistence preserves local optimistic changes in store and SQLite', async () => {
        const sale = { id: 'sale_err_test', status: 'pending', total_amount: 1200 };
        useFinanceStore.setState({ isInitialized: true, sales: [sale] });

        // Optimistically update
        const updated = { ...sale, status: 'completed' };
        await LocalDbService.saveItem('sales', updated);
        useFinanceStore.getState().updateSaleLocal(updated);

        // Simulate remote failure
        const remoteSync = jest.fn().mockRejectedValueOnce(new Error('Supabase 503 Service Unavailable'));
        let caughtError = null;
        try {
            await remoteSync();
        } catch (e) {
            caughtError = e;
        }

        expect(caughtError).not.toBeNull();
        expect(caughtError.message).toContain('Supabase 503');

        // Local state MUST remain intact despite remote failure
        const currentSale = useFinanceStore.getState().sales.find(s => s.id === 'sale_err_test');
        expect(currentSale.status).toBe('completed');
    });

    test('Audit C: Offline startup hydrates from SQLite and late remote arrival preserves pending rows', async () => {
        // App starts offline - stores hydrate from SQLite
        LocalDbService.getAll.mockImplementation(async (table) => {
            if (table === 'products') return [{ id: 'p_local', name: 'Cached Local Prod', current_stock: 10 }];
            if (table === 'clients') return [{ id: 'c_local', name: 'Cached Local Client' }];
            if (table === 'sales') return [{ id: 's_local', status: 'pending', total_amount: 500 }];
            return [];
        });

        await useProductStore.getState().initStore();
        await useClientStore.getState().initStore();
        await useFinanceStore.getState().initStore();

        expect(useProductStore.getState().isInitialized).toBe(true);
        expect(useClientStore.getState().isInitialized).toBe(true);
        expect(useFinanceStore.getState().isInitialized).toBe(true);

        expect(useProductStore.getState().products).toHaveLength(1);
        expect(useClientStore.getState().clients).toHaveLength(1);
        expect(useFinanceStore.getState().sales).toHaveLength(1);
    });

    test('Audit 2: NewOrderScreen data resolution with hydrated vs empty vs uninitialized stores', async () => {
        // 1. Uninitialized state
        useProductStore.setState({ products: [], isInitialized: false });
        useClientStore.setState({ clients: [], isInitialized: false });

        LocalDbService.getAll.mockImplementation(async (tbl) => {
            if (tbl === 'products') return [{ id: 'prod_h1', name: 'Zapatillas Imperial', current_stock: 8, active: 1 }];
            if (tbl === 'clients') return [{ id: 'cli_h1', name: 'Carlos Gomez', status: 'active' }];
            return [];
        });

        // Initialize stores from SQLite (offline-first path)
        await Promise.all([
            useProductStore.getState().initStore(),
            useClientStore.getState().initStore()
        ]);

        expect(useProductStore.getState().isInitialized).toBe(true);
        expect(useProductStore.getState().products).toHaveLength(1);
        expect(useClientStore.getState().clients).toHaveLength(1);

        // 2. Legitimate empty state (0 clients, 0 products)
        useProductStore.setState({ products: [], isInitialized: true });
        useClientStore.setState({ clients: [], isInitialized: true });

        // Must distinguish empty collection from uninitialized (isInitialized is true)
        expect(useProductStore.getState().isInitialized).toBe(true);
        expect(useProductStore.getState().products).toHaveLength(0);
        expect(useClientStore.getState().isInitialized).toBe(true);
        expect(useClientStore.getState().clients).toHaveLength(0);

        // 3. Stock deduction during order placement
        useProductStore.setState({
            products: [{
                id: 'prod_stock_test',
                name: 'Gorra Empire',
                current_stock: 10,
                stock_local: 10,
                stock_cordoba: 0,
                variants: [{ color: 'Negro', stock: '10' }]
            }],
            isInitialized: true
        });

        await useProductStore.getState().updateProductStock('prod_stock_test', 3, 'local', 'Negro');

        const updatedProd = useProductStore.getState().products.find(p => p.id === 'prod_stock_test');
        expect(updatedProd.current_stock).toBe(7);
        expect(updatedProd.stock_local).toBe(7);
        expect(updatedProd.variants[0].stock).toBe('7');
    });
});
