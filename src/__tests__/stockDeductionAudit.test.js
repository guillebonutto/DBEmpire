/**
 * AUDITORIA DE CONSISTENCIA DE STOCK, ATOMICIDAD E IDEMPOTENCIA
 * Pruebas unitarias y de integracion simuladas en Jest (Mocks de Supabase y SyncService)
 *
 * NOTA DE AUDITORIA: Estas pruebas se ejecutan contra mocks de Jest.
 * La validacion contra transacciones reales y concurrencia de PostgreSQL se ejecuta
 * en el archivo scripts/test_real_pg.js contra un motor PostgreSQL 17 real.
 */

import { SyncService } from '../services/syncService';
import { supabase } from '../services/supabase';

jest.mock('../services/supabase', () => ({
    supabase: {
        rpc: jest.fn(),
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                eq: jest.fn(() => ({
                    single: jest.fn().mockResolvedValue({ data: null, error: null })
                }))
            })),
            insert: jest.fn().mockResolvedValue({ data: null, error: null }),
            update: jest.fn().mockResolvedValue({ data: null, error: null })
        }))
    }
}));

describe('Auditoria Integral de Seguridad y Consistencia de la RPC process_sale_atomic', () => {
    let mockRemoteDb;
    let mockAuthContext;

    beforeEach(() => {
        jest.clearAllMocks();

        mockAuthContext = {
            role: 'authenticated',
            uid: '00000000-0000-0000-0000-000000000001',
            assigned_location: null
        };

        mockRemoteDb = {
            sales: new Map(),
            sale_items: new Map(),
            inventory_movements: new Map(),
            profiles: new Map([
                ['00000000-0000-0000-0000-000000000001', { id: '00000000-0000-0000-0000-000000000001', role: 'admin', assigned_location: null }],
                ['00000000-0000-0000-0000-000000000002', { id: '00000000-0000-0000-0000-000000000002', role: 'seller', assigned_location: 'local' }],
                ['00000000-0000-0000-0000-000000000003', { id: '00000000-0000-0000-0000-000000000003', role: 'blocked', assigned_location: 'local' }],
                ['00000000-0000-0000-0000-000000000004', { id: '00000000-0000-0000-0000-000000000004', role: 'seller', assigned_location: 'cordoba' }]
            ]),
            products: new Map([
                ['prod-1', {
                    id: 'prod-1',
                    stock_local: 10,
                    stock_cordoba: 5,
                    current_stock: 15,
                    variants: [
                        { color: 'Rojo', stock: 5 },
                        { color: 'Azul', stock: 5 }
                    ]
                }],
                ['prod-2', {
                    id: 'prod-2',
                    stock_local: 10,
                    stock_cordoba: 0,
                    current_stock: 10,
                    variants: null
                }]
            ]),
            stockDeductionHistory: []
        };

        supabase.rpc.mockImplementation(async (fnName, args) => {
            if (fnName === 'process_sale_atomic') {
                const { p_sale, p_items, p_location = 'local', p_allow_oversell = false } = args;

                const snapshot = {
                    sales: new Map(mockRemoteDb.sales),
                    sale_items: new Map(mockRemoteDb.sale_items),
                    inventory_movements: new Map(mockRemoteDb.inventory_movements),
                    products: new Map(Array.from(mockRemoteDb.products.entries()).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))])),
                    historyLen: mockRemoteDb.stockDeductionHistory.length
                };

                const raiseException = (errCode, message) => {
                    mockRemoteDb.sales = snapshot.sales;
                    mockRemoteDb.sale_items = snapshot.sale_items;
                    mockRemoteDb.inventory_movements = snapshot.inventory_movements;
                    mockRemoteDb.products = snapshot.products;
                    mockRemoteDb.stockDeductionHistory.length = snapshot.historyLen;
                    return { data: null, error: { code: errCode, message: errCode + ": " + message } };
                };

                let effectiveLocation = 'local';
                if (p_location && p_location.trim() !== '') {
                    effectiveLocation = p_location.trim().toLowerCase();
                }
                if (effectiveLocation !== 'local' && effectiveLocation !== 'cordoba') {
                    return raiseException('INVALID_LOCATION', 'Location parameter must be local or cordoba');
                }

                if (p_sale && p_sale.sale_location) {
                    const saleLoc = p_sale.sale_location.trim().toLowerCase();
                    if (saleLoc !== 'local' && saleLoc !== 'cordoba') {
                        return raiseException('INVALID_LOCATION', 'sale.sale_location must be local or cordoba');
                    }
                    if (saleLoc !== effectiveLocation) {
                        return raiseException('LOCATION_MISMATCH', 'Payload location mismatch');
                    }
                }

                const saleId = p_sale?.id;
                if (!saleId || typeof saleId !== 'string' || saleId.trim() === '') {
                    return raiseException('INVALID_SALE_ID', 'Sale ID cannot be empty');
                }

                if (!mockAuthContext || mockAuthContext.role === 'anon' || !mockAuthContext.uid) {
                    return raiseException('UNAUTHORIZED', 'Anonymous calls are not permitted. Authentication required.');
                }

                const targetUserId = (mockAuthContext.role !== 'service_role' && mockAuthContext.uid) ? mockAuthContext.uid : (p_sale?.seller_id || null);
                if (targetUserId) {
                    const userProf = mockRemoteDb.profiles.get(targetUserId);
                    if (!userProf) {
                        return raiseException('PROFILE_NOT_FOUND', 'Profile does not exist');
                    }
                    if (userProf.role === 'blocked') {
                        return raiseException('UNAUTHORIZED', 'User account is blocked');
                    }
                    if (!['admin', 'leader', 'seller'].includes(userProf.role)) {
                        return raiseException('UNAUTHORIZED', 'Role is not authorized');
                    }
                    if (userProf.assigned_location && userProf.assigned_location !== effectiveLocation && userProf.role !== 'admin') {
                        return raiseException('UNAUTHORIZED_LOCATION', 'User is not authorized for location');
                    }
                }

                if (!p_items || !Array.isArray(p_items) || p_items.length === 0) {
                    return raiseException('INVALID_ITEMS', 'Items must be a non-empty JSON array');
                }

                const existingSale = mockRemoteDb.sales.get(saleId);
                if (existingSale) {
                    const amountDiff = Math.abs((existingSale.total_amount || 0) - (p_sale.total_amount || 0));
                    const clientDiff = (existingSale.client_id || '') !== (p_sale.client_id || '');
                    const locDiff = (existingSale.sale_location || 'local') !== effectiveLocation;

                    if (amountDiff > 0.01 || clientDiff || locDiff) {
                        return raiseException('ID_COLLISION_DIFFERENT_SALE', 'Conflicting header');
                    }

                    const remoteItems = Array.from(mockRemoteDb.sale_items.values()).filter(si => si.sale_id === saleId);
                    if (remoteItems.length > 0 && remoteItems.length !== p_items.length) {
                        return raiseException('ID_COLLISION_DIFFERENT_ITEMS', 'Remote sale has  items but incoming payload has  items');
                    }

                    if (remoteItems.length > 0) {
                        for (const rItem of remoteItems) {
                            const match = p_items.some(inc =>
                                inc.id === rItem.id &&
                                inc.product_id === rItem.product_id &&
                                (parseInt(inc.quantity) || 0) === rItem.quantity &&
                                Math.abs((Number(inc.unit_price_at_sale) || 0) - (Number(rItem.unit_price_at_sale) || 0)) <= 0.01 &&
                                Math.abs((Number(inc.subtotal) || 0) - (Number(rItem.subtotal) || 0)) <= 0.01 &&
                                (inc.color?.trim().toLowerCase() || null) === (rItem.color?.trim().toLowerCase() || null)
                            );
                            if (!match) {
                                return raiseException('ID_COLLISION_DIFFERENT_ITEMS', 'Remote items do not match incoming items for sale');
                            }
                        }
                    }

                    const remoteMovs = Array.from(mockRemoteDb.inventory_movements.values()).filter(m => m.sale_id === saleId);
                    if (remoteItems.length === p_items.length && remoteMovs.length === p_items.length) {
                        return { data: { success: true, status: 'already_processed', sale_id: saleId }, error: null };
                    }
                }

                const generalDemand = new Map();
                const variantDemand = new Map();

                for (const item of p_items) {
                    const itemId = item.id;
                    const prodId = item.product_id;
                    const qty = parseInt(item.quantity) || 0;
                    const color = item.color ? item.color.trim().toLowerCase() : null;

                    if (!itemId || itemId.trim() === '') return raiseException('INVALID_ITEM_ID', 'Item ID cannot be empty');
                    if (qty <= 0) return raiseException('INVALID_QUANTITY', 'Quantity must be > 0');

                    const exMov = mockRemoteDb.inventory_movements.get(itemId);
                    if (exMov) {
                        if (exMov.sale_id !== saleId || exMov.product_id !== prodId || exMov.quantity !== qty || (exMov.color?.trim().toLowerCase() || null) !== color || exMov.movement_type !== 'SALE') {
                            return raiseException('MOVEMENT_ID_COLLISION', 'inventory_movement  already exists with incompatible data');
                        }
                    } else {
                        generalDemand.set(prodId, (generalDemand.get(prodId) || 0) + qty);
                        if (color) {
                            const varKey = prodId + ":::" + color;
                            variantDemand.set(varKey, (variantDemand.get(varKey) || 0) + qty);
                        }
                    }
                }

                for (const [prodId, totalQty] of generalDemand.entries()) {
                    const prod = mockRemoteDb.products.get(prodId);
                    if (!prod) return raiseException('PRODUCT_NOT_FOUND', 'Product does not exist');
                    const avail = (effectiveLocation === 'cordoba') ? (prod.stock_cordoba || 0) : (prod.stock_local || 0);
                    if (avail < totalQty && !p_allow_oversell) {
                        return raiseException('INSUFFICIENT_STOCK', 'Insufficient stock');
                    }
                }

                for (const [varKey, totalQty] of variantDemand.entries()) {
                    const [prodId, color] = varKey.split(':::');
                    const prod = mockRemoteDb.products.get(prodId);
                    if (!prod.variants || !Array.isArray(prod.variants) || prod.variants.length === 0) {
                        return raiseException('VARIANT_NOT_FOUND', 'Product has no variants');
                    }
                    const varElem = prod.variants.find(v => v.color?.trim().toLowerCase() === color);
                    if (!varElem) return raiseException('VARIANT_NOT_FOUND', 'Variant color not found');
                    const varStock = parseInt(varElem.stock) || 0;
                    if (varStock < totalQty && !p_allow_oversell) {
                        return raiseException('INSUFFICIENT_VARIANT_STOCK', 'Insufficient variant stock');
                    }
                }

                if (!mockRemoteDb.sales.has(saleId)) {
                    mockRemoteDb.sales.set(saleId, { ...p_sale, sale_location: effectiveLocation });
                }

                for (const item of p_items) {
                    const itemId = item.id;
                    const prodId = item.product_id;
                    const qty = parseInt(item.quantity) || 0;
                    const unitPrice = Number(item.unit_price_at_sale) || 0;
                    const subtotal = Number(item.subtotal) || (qty * unitPrice);
                    const color = item.color;

                    const exItem = mockRemoteDb.sale_items.get(itemId);
                    if (exItem) {
                        if (exItem.sale_id !== saleId || exItem.product_id !== prodId || exItem.quantity !== qty || Math.abs((exItem.unit_price_at_sale || 0) - unitPrice) > 0.01 || Math.abs((exItem.subtotal || 0) - subtotal) > 0.01 || (exItem.color?.trim().toLowerCase() || null) !== (color?.trim().toLowerCase() || null)) {
                            return raiseException('ITEM_ID_COLLISION', 'Item collision');
                        }
                    } else {
                        mockRemoteDb.sale_items.set(itemId, { id: itemId, sale_id: saleId, product_id: prodId, quantity: qty, unit_price_at_sale: unitPrice, subtotal, color });
                    }

                    const exMov = mockRemoteDb.inventory_movements.get(itemId);
                    let movementInserted = false;
                    if (!exMov) {
                        const prod = mockRemoteDb.products.get(prodId);
                        const availStock = (effectiveLocation === 'cordoba') ? (prod.stock_cordoba || 0) : (prod.stock_local || 0);
                        const deficit = (availStock < qty) ? (qty - availStock) : 0;
                        mockRemoteDb.inventory_movements.set(itemId, { id: itemId, sale_id: saleId, product_id: prodId, color, quantity: qty, deficit_quantity: deficit, movement_type: 'SALE' });
                        movementInserted = true;
                    }

                    if (movementInserted) {
                        const prod = mockRemoteDb.products.get(prodId);
                        if (effectiveLocation === 'cordoba') {
                            prod.stock_cordoba = Math.max(0, (prod.stock_cordoba || 0) - qty);
                        } else {
                            prod.stock_local = Math.max(0, (prod.stock_local || 0) - qty);
                        }
                        prod.current_stock = Math.max(0, (prod.current_stock || 0) - qty);

                        if (color && prod.variants) {
                            const vIdx = prod.variants.findIndex(v => v.color?.trim().toLowerCase() === color.trim().toLowerCase());
                            if (vIdx >= 0) prod.variants[vIdx].stock = Math.max(0, (parseInt(prod.variants[vIdx].stock) || 0) - qty);
                        }

                        mockRemoteDb.stockDeductionHistory.push({ itemId, productId: prodId, color, diff: qty });
                    }
                }

                return { data: { success: true, status: 'completed', sale_id: saleId }, error: null };
            }

            return { data: null, error: { message: "Function " + fnName + " not found" } };
        });
    });

    test('1. Mismo ID y Mismo Contenido: Resuelve con idempotencia perfecta sin duplicar registros ni stock', async () => {
        const saleId = '00000000-0000-4000-8000-000000000001';
        const payload = { id: saleId, total_amount: 100, client_id: 'client-1', sale_location: 'local' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 2 }] };

        const res1 = await SyncService._processSaleSync(payload, metadata);
        expect(res1).toBe(true);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(8);

        const res2 = await SyncService._processSaleSync(payload, metadata);
        expect(res2).toBe(true);

        expect(mockRemoteDb.sales.size).toBe(1);
        expect(mockRemoteDb.sale_items.size).toBe(1);
        expect(mockRemoteDb.inventory_movements.size).toBe(1);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(8);
        expect(mockRemoteDb.stockDeductionHistory.length).toBe(1);
    });

    test('2. Mismo ID y Contenido Diferente con Distinto Importe: Aborta con excepcion y rollback', async () => {
        const saleId = '00000000-0000-4000-8000-000000000002';
        mockRemoteDb.sales.set(saleId, { id: saleId, total_amount: 500, client_id: 'client-1', sale_location: 'local' });

        const payload = { id: saleId, total_amount: 200, client_id: 'client-1', sale_location: 'local' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 1 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('ID_COLLISION_DIFFERENT_SALE');
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('3. Mismo ID y Contenido Diferente con IGUAL Importe: Aborta con excepcion por contenido incompatible', async () => {
        const saleId = '00000000-0000-4000-8000-000000000003';
        mockRemoteDb.sales.set(saleId, { id: saleId, total_amount: 200, client_id: 'client-1', sale_location: 'local' });
        mockRemoteDb.sale_items.set('item-orig', { id: 'item-orig', sale_id: saleId, product_id: 'prod-1', quantity: 2, unit_price_at_sale: 100, subtotal: 200, color: null });

        const payload = { id: saleId, total_amount: 200, client_id: 'client-1', sale_location: 'local' };
        const metadata = { items: [{ id: 'item-orig', product_id: 'prod-1', qty: 1, unit_price: 200, sale_price: 200 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('ID_COLLISION_DIFFERENT_ITEMS');
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('4. Mismo ID de Item Perteneciente a Otra Venta: Rechaza colision y ejecuta rollback', async () => {
        const sale1Id = '00000000-0000-4000-8000-000000000004';
        const sale2Id = '00000000-0000-4000-8000-000000000005';
        const conflictingItemId = '00000000-0000-4000-8000-0000000000c4';

        mockRemoteDb.sales.set(sale1Id, { id: sale1Id, total_amount: 100, sale_location: 'local' });
        mockRemoteDb.sale_items.set(conflictingItemId, { id: conflictingItemId, sale_id: sale1Id, product_id: 'prod-1', quantity: 1, unit_price_at_sale: 100, subtotal: 100, color: null });

        const payload = { id: sale2Id, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: conflictingItemId, product_id: 'prod-1', qty: 1, item_id: conflictingItemId }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('ITEM_ID_COLLISION');
        expect(mockRemoteDb.sales.has(sale2Id)).toBe(false);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('5. Movimiento Existente con Contenido Incompatible: Rechaza colision de movimiento', async () => {
        const saleId = '00000000-0000-4000-8000-000000000005';
        const itemId = '00000000-0000-4000-8000-0000000000c5';

        mockRemoteDb.inventory_movements.set(itemId, { id: itemId, sale_id: 'other-sale-uuid', product_id: 'prod-1', quantity: 5, movement_type: 'SALE' });

        const payload = { id: saleId, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: itemId, product_id: 'prod-1', qty: 1, item_id: itemId }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('MOVEMENT_ID_COLLISION');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('6. Distinta Cantidad de Lineas o Duplicados: Detecta violacion de cardinalidad biyectiva', async () => {
        const saleId = '00000000-0000-4000-8000-000000000006';
        mockRemoteDb.sales.set(saleId, { id: saleId, total_amount: 300, sale_location: 'local' });
        mockRemoteDb.sale_items.set('item-6a', { id: 'item-6a', sale_id: saleId, product_id: 'prod-1', quantity: 1, unit_price_at_sale: 100, subtotal: 100, color: null });

        const payload = { id: saleId, total_amount: 300, sale_location: 'local' };
        const metadata = { items: [{ id: 'item-6a', product_id: 'prod-1', qty: 1, item_id: 'item-6a' }, { id: 'item-6b', product_id: 'prod-2', qty: 2, item_id: 'item-6b' }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('ID_COLLISION_DIFFERENT_ITEMS');
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
        expect(mockRemoteDb.products.get('prod-2').stock_local).toBe(10);
    });

    test('7. Invocacion sin Autorizacion: Rechaza llamadas anonimas con excepcion 42501', async () => {
        mockAuthContext = { role: 'anon', uid: null };
        const payload = { id: '00000000-0000-4000-8000-000000000007', total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 1 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('UNAUTHORIZED');
        expect(mockRemoteDb.sales.has('00000000-0000-4000-8000-000000000007')).toBe(false);
    });

    test('8. Usuario sin Autorizacion de Ubicacion: Rechaza venta fuera de su sucursal asignada', async () => {
        mockAuthContext = { role: 'authenticated', uid: '00000000-0000-0000-0000-000000000002', assigned_location: 'local' };
        const payload = { id: '00000000-0000-4000-8000-000000000008', total_amount: 100, sale_location: 'cordoba' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 1 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('UNAUTHORIZED_LOCATION');
        expect(mockRemoteDb.sales.has('00000000-0000-4000-8000-000000000008')).toBe(false);
    });

    test('9. Stock Insuficiente: Rechaza con INSUFFICIENT_STOCK y ejecuta rollback total', async () => {
        const saleId = '00000000-0000-4000-8000-000000000009';
        const payload = { id: saleId, total_amount: 1500, sale_location: 'local' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 15 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('INSUFFICIENT_STOCK');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        expect(mockRemoteDb.sale_items.size).toBe(0);
        expect(mockRemoteDb.inventory_movements.size).toBe(0);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('10. Ventas Concurrentes con Stock Limitado: La ganadora descuenta, la perdedora aborta con rollback', async () => {
        mockRemoteDb.products.get('prod-1').stock_local = 3;
        const sale1 = { id: '00000000-0000-4000-8000-00000000010a', total_amount: 200, sale_location: 'local' };
        const sale2 = { id: '00000000-0000-4000-8000-00000000010b', total_amount: 200, sale_location: 'local' };
        const meta = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 2 }] };

        const r1 = await SyncService._processSaleSync(sale1, meta);
        expect(r1).toBe(true);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(1);

        await expect(SyncService._processSaleSync(sale2, meta)).rejects.toThrow('INSUFFICIENT_STOCK');
        expect(mockRemoteDb.sales.has('00000000-0000-4000-8000-00000000010a')).toBe(true);
        expect(mockRemoteDb.sales.has('00000000-0000-4000-8000-00000000010b')).toBe(false);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(1);
    });

    test('11. Dos Reintentos Concurrentes de la Misma Venta: Idempotencia estricta, exactamente una deduccion', async () => {
        const saleId = '00000000-0000-4000-8000-000000000011';
        const payload = { id: saleId, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 2 }] };

        const [r1, r2] = await Promise.all([
            SyncService._processSaleSync(payload, metadata),
            SyncService._processSaleSync(payload, metadata)
        ]);

        expect(r1).toBe(true);
        expect(r2).toBe(true);
        expect(mockRemoteDb.sales.size).toBe(1);
        expect(mockRemoteDb.sale_items.size).toBe(1);
        expect(mockRemoteDb.inventory_movements.size).toBe(1);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(8);
        expect(mockRemoteDb.stockDeductionHistory.length).toBe(1);
    });

    test('12. Variantes de Color y Lineas Repetidas: Cada linea y variante se procesa acumulativamente', async () => {
        const saleId = '00000000-0000-4000-8000-000000000012';
        const payload = { id: saleId, total_amount: 300, sale_location: 'local' };
        const metadata = {
            items: [
                { id: 'item-12a', product_id: 'prod-1', qty: 1, color: 'Rojo', item_id: 'item-12a' },
                { id: 'item-12b', product_id: 'prod-1', qty: 2, color: 'Azul', item_id: 'item-12b' }
            ]
        };

        const res = await SyncService._processSaleSync(payload, metadata);
        expect(res).toBe(true);
        const prod = mockRemoteDb.products.get('prod-1');
        expect(prod.stock_local).toBe(7);
        expect(prod.variants.find(v => v.color === 'Rojo').stock).toBe(4);
        expect(prod.variants.find(v => v.color === 'Azul').stock).toBe(3);
    });

    test('13. Respuesta HTTP Perdida tras Commit: Reintento posterior detecta movimientos y no duplica descuento', async () => {
        const saleId = '00000000-0000-4000-8000-000000000013';
        const itemId = '00000000-0000-4000-8000-000000000099';

        mockRemoteDb.sales.set(saleId, { id: saleId, total_amount: 100, sale_location: 'local' });
        mockRemoteDb.sale_items.set(itemId, { id: itemId, sale_id: saleId, product_id: 'prod-1', quantity: 2 });
        mockRemoteDb.inventory_movements.set(itemId, { id: itemId, sale_id: saleId, product_id: 'prod-1', quantity: 2, movement_type: 'SALE' });
        mockRemoteDb.products.get('prod-1').stock_local = 8;
        mockRemoteDb.stockDeductionHistory.push({ itemId, productId: 'prod-1', diff: 2 });

        const payload = { id: saleId, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: 'prod-1', product_id: 'prod-1', qty: 2, item_id: itemId }] };

        const result = await SyncService._processSaleSync(payload, metadata);
        expect(result).toBe(true);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(8);
        expect(mockRemoteDb.stockDeductionHistory.length).toBe(1);
    });

    test('14. Error en el Segundo Item: Rollback total revierte la venta, items y stock de prod-1', async () => {
        const saleId = '00000000-0000-4000-8000-000000000014';
        const payload = { id: saleId, total_amount: 200, sale_location: 'local' };
        const metadata = {
            items: [
                { id: 'prod-1', product_id: 'prod-1', qty: 2 },
                { id: 'prod-inexistente', product_id: 'prod-inexistente', qty: 1 }
            ]
        };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('PRODUCT_NOT_FOUND');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        expect(mockRemoteDb.sale_items.size).toBe(0);
        expect(mockRemoteDb.inventory_movements.size).toBe(0);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('15. Payload Manipulado con Ubicacion Discrepante: Rechaza con LOCATION_MISMATCH', async () => {
        const saleId = '00000000-0000-4000-8000-000000000015';
        const payload = { id: saleId, total_amount: 100, sale_location: 'cordoba' };
        const metadata = { items: [{ id: 'item-15', product_id: 'prod-1', qty: 1 }] };

        const originalRpc = supabase.rpc;
        supabase.rpc = jest.fn((fn, args) => {
            return originalRpc(fn, { ...args, p_location: 'local' });
        });

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('LOCATION_MISMATCH');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        supabase.rpc = originalRpc;
    });

    test('16. Perfil Inexistente: Rechaza seller_id no registrado con PROFILE_NOT_FOUND', async () => {
        mockAuthContext = { role: 'authenticated', uid: '00000000-0000-0000-0000-999999999999' };
        const saleId = '00000000-0000-4000-8000-000000000016';
        const payload = { id: saleId, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: 'item-16', product_id: 'prod-1', qty: 1 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('PROFILE_NOT_FOUND');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
    });

    test('17. Usuario Bloqueado: Rechaza seller con role = blocked', async () => {
        mockAuthContext = { role: 'authenticated', uid: '00000000-0000-0000-0000-000000000003' };
        const saleId = '00000000-0000-4000-8000-000000000017';
        const payload = { id: saleId, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: 'item-17', product_id: 'prod-1', qty: 1 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('UNAUTHORIZED');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
    });

    test('18. Operacion Valida en Sucursal Cordoba: Descuenta stock_cordoba y mantiene stock_local intacto', async () => {
        mockAuthContext = { role: 'authenticated', uid: '00000000-0000-0000-0000-000000000004', assigned_location: 'cordoba' };
        const saleId = '00000000-0000-4000-8000-000000000018';
        const payload = { id: saleId, total_amount: 200, sale_location: 'cordoba' };
        const metadata = { items: [{ id: 'item-18', product_id: 'prod-1', qty: 2 }] };

        const res = await SyncService._processSaleSync(payload, metadata);
        expect(res).toBe(true);
        const prod = mockRemoteDb.products.get('prod-1');
        expect(prod.stock_cordoba).toBe(3);
        expect(prod.stock_local).toBe(10);
        expect(prod.current_stock).toBe(13);
    });

    test('19. Variante Inexistente: Rechaza color no presente en variants con VARIANT_NOT_FOUND', async () => {
        const saleId = '00000000-0000-4000-8000-000000000019';
        const payload = { id: saleId, total_amount: 100, sale_location: 'local' };
        const metadata = { items: [{ id: 'item-19', product_id: 'prod-1', color: 'Verde', qty: 1 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('VARIANT_NOT_FOUND');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('20. Stock de Variante Insuficiente: Rechaza cuando stock general es suficiente pero variante Rojo no', async () => {
        const saleId = '00000000-0000-4000-8000-000000000020';
        const payload = { id: saleId, total_amount: 800, sale_location: 'local' };
        const metadata = { items: [{ id: 'item-20', product_id: 'prod-1', color: 'Rojo', qty: 8 }] };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('INSUFFICIENT_VARIANT_STOCK');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
    });

    test('21. Multiples Lineas de Misma Variante Acumuladas: 3 + 3 = 6 excede stock de Rojo (5) y revierte todo', async () => {
        const saleId = '00000000-0000-4000-8000-000000000021';
        const payload = { id: saleId, total_amount: 600, sale_location: 'local' };
        const metadata = {
            items: [
                { id: 'item-21a', product_id: 'prod-1', color: 'Rojo', qty: 3, item_id: 'item-21a' },
                { id: 'item-21b', product_id: 'prod-1', color: 'Rojo', qty: 3, item_id: 'item-21b' }
            ]
        };

        await expect(SyncService._processSaleSync(payload, metadata)).rejects.toThrow('INSUFFICIENT_VARIANT_STOCK');
        expect(mockRemoteDb.sales.has(saleId)).toBe(false);
        expect(mockRemoteDb.sale_items.size).toBe(0);
        expect(mockRemoteDb.inventory_movements.size).toBe(0);
        expect(mockRemoteDb.products.get('prod-1').stock_local).toBe(10);
        expect(mockRemoteDb.products.get('prod-1').variants.find(v => v.color === 'Rojo').stock).toBe(5);
    });
});

describe('Regresion Historica: Demostracion del Fallo en Flujo Desacoplado REST Antiguo', () => {
    test('Defecto Historico C & D: En REST desacoplado, los items pre-existentes omitian el descuento de stock', () => {
        const metadataItems = [{ id: 'prod-1', product_id: 'prod-1', qty: 2 }, { id: 'prod-2', product_id: 'prod-2', qty: 3 }];
        const existingRemoteItems = [{ product_id: 'prod-1', quantity: 2 }];
        const itemsToInsert = metadataItems.filter(target => !existingRemoteItems.some(r => r.product_id === target.product_id));
        expect(itemsToInsert).toHaveLength(1);
        expect(itemsToInsert[0].product_id).toBe('prod-2');
        const productsDeducted = itemsToInsert.map(i => i.product_id);
        expect(productsDeducted).not.toContain('prod-1');
        expect(productsDeducted).toContain('prod-2');
    });

    test('Defecto Historico D: Si todos los items ya existian, el descuento completo se omitia', () => {
        const metadataItems = [{ id: 'prod-1', product_id: 'prod-1', qty: 4 }];
        const existingRemoteItems = [{ product_id: 'prod-1', quantity: 4 }];
        const itemsToInsert = metadataItems.filter(target => !existingRemoteItems.some(r => r.product_id === target.product_id));
        expect(itemsToInsert).toHaveLength(0);
        let stockDeducted = false;
        if (itemsToInsert.length > 0) stockDeducted = true;
        expect(stockDeducted).toBe(false);
    });
});
