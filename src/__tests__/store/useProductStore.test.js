import { act } from '@testing-library/react-native';
import { useProductStore } from '../../store/useProductStore';
import { supabase } from '../../services/supabase';
import { LocalDbService } from '../../services/localDbService';
import NetInfo from '@react-native-community/netinfo';

jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({
                data: [{ id: '1', name: 'Product 1', active: true, stock_local: 10, stock_cordoba: 5, variants: [] }]
            })
        }))
    }
}));

jest.mock('../../services/localDbService', () => ({
    LocalDbService: {
        getAll: jest.fn(),
        getPendingSyncs: jest.fn(),
        replaceFullTable: jest.fn(),
        saveItem: jest.fn()
    }
}));

jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn()
}));

describe('useProductStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the store state before each test
        const store = useProductStore.getState();
        store.products = [];
        store.loadingProducts = false;
        store.isInitialized = false;
        store.lastFetch = null;
    });

    describe('initStore', () => {
        it('should load products from local DB on init', async () => {
            const mockProducts = [
                { id: '1', name: 'Product A', variants_json: JSON.stringify([{ color: 'Red', stock: '5' }]) },
                { id: '2', name: 'Product B', variants: [{ color: 'Blue', stock: '2' }] },
                { id: '3', name: 'Product C' }
            ];
            LocalDbService.getAll.mockResolvedValue(mockProducts);

            await act(async () => {
                await useProductStore.getState().initStore();
            });

            const state = useProductStore.getState();
            expect(LocalDbService.getAll).toHaveBeenCalledWith('products');
            expect(state.isInitialized).toBe(true);
            expect(state.loadingProducts).toBe(false);
            expect(state.products).toHaveLength(3);
            expect(state.products[0].variants).toEqual([{ color: 'Red', stock: '5' }]);
            expect(state.products[1].variants).toEqual([{ color: 'Blue', stock: '2' }]);
            expect(state.products[2].variants).toEqual([]); // Fallback to empty array
        });

        it('should handle errors during init', async () => {
            LocalDbService.getAll.mockRejectedValue(new Error('DB Error'));
            
            await act(async () => {
                await useProductStore.getState().initStore();
            });

            const state = useProductStore.getState();
            expect(state.isInitialized).toBe(true);
            expect(state.products).toHaveLength(0); // State remains empty, but init finishes
        });

        it('should return early if already initialized', async () => {
            useProductStore.setState({ isInitialized: true });
            
            await act(async () => {
                await useProductStore.getState().initStore();
            });

            expect(LocalDbService.getAll).not.toHaveBeenCalled();
        });
    });

    describe('fetchProducts', () => {
        it('should skip if not connected to internet', async () => {
            NetInfo.fetch.mockResolvedValue({ isConnected: false });
            
            await act(async () => {
                await useProductStore.getState().fetchProducts();
            });

            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('should fetch and reconcile pending syncs correctly', async () => {
            NetInfo.fetch.mockResolvedValue({ isConnected: true });
            const mockSupabaseData = [
                { id: '1', name: 'Prod 1', stock_local: 10, stock_cordoba: 5, variants: [{ color: 'red', stock: '3' }] },
                { id: '2', name: 'Prod 2', stock_local: 5, stock_cordoba: 5, variants: '[]' } // Test string variants
            ];
            
            const supabaseMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: mockSupabaseData, error: null })
            };
            supabase.from.mockReturnValue(supabaseMock);

            const mockPendingSyncs = [
                {
                    table_name: 'sales',
                    action: 'INSERT',
                    payload: JSON.stringify({ sale_location: 'local' }),
                    metadata: JSON.stringify({ items: [{ id: '1', qty: 2, color: 'red' }] })
                }
            ];
            LocalDbService.getPendingSyncs.mockResolvedValue(mockPendingSyncs);

            await act(async () => {
                await useProductStore.getState().fetchProducts(true); // force fetch
            });

            const state = useProductStore.getState();
            expect(state.products).toHaveLength(2);
            
            // Reconciled stock assertions for Prod 1
            const p1 = state.products.find(p => p.id === '1');
            expect(p1.stock_local).toBe(8); // 10 - 2 (from pending sale)
            expect(p1.stock_cordoba).toBe(5);
            expect(p1.current_stock).toBe(13); // 8 + 5
            expect(p1.variants[0].stock).toBe("1"); // 3 - 2

            // Prod 2 shouldn't be affected
            const p2 = state.products.find(p => p.id === '2');
            expect(p2.stock_local).toBe(5);
            expect(p2.variants).toEqual([]); // Parsed from string
        });
        
        it('should handle supabase error', async () => {
            NetInfo.fetch.mockResolvedValue({ isConnected: true });
            
            const supabaseMock = {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: null, error: new Error('Network error') })
            };
            supabase.from.mockReturnValue(supabaseMock);

            await act(async () => {
                await useProductStore.getState().fetchProducts(true);
            });

            const state = useProductStore.getState();
            expect(state.loadingProducts).toBe(false); // Should stop loading
            expect(LocalDbService.replaceFullTable).not.toHaveBeenCalled();
        });
    });

    describe('updateProductStock', () => {
        beforeEach(() => {
            useProductStore.setState({
                products: [
                    { 
                        id: '1', 
                        stock_local: 10, 
                        stock_cordoba: 5, 
                        variants: [{ color: 'blue', stock: '4' }] 
                    }
                ]
            });
        });

        it('should decrement local stock correctly', async () => {
            await act(async () => {
                await useProductStore.getState().updateProductStock('1', 2, 'local', null);
            });

            const p1 = useProductStore.getState().products[0];
            expect(p1.stock_local).toBe(8);
            expect(p1.stock_cordoba).toBe(5);
            expect(p1.current_stock).toBe(13);
            expect(LocalDbService.saveItem).toHaveBeenCalledWith('products', expect.any(Object));
        });

        it('should decrement cordoba stock and variant stock correctly', async () => {
            await act(async () => {
                await useProductStore.getState().updateProductStock('1', 3, 'cordoba', 'blue');
            });

            const p1 = useProductStore.getState().products[0];
            expect(p1.stock_local).toBe(10);
            expect(p1.stock_cordoba).toBe(2);
            expect(p1.current_stock).toBe(12);
            expect(p1.variants[0].stock).toBe("1"); // 4 - 3
        });
        
        it('should not go below zero for stock', async () => {
            await act(async () => {
                await useProductStore.getState().updateProductStock('1', 20, 'local', 'blue');
            });

            const p1 = useProductStore.getState().products[0];
            expect(p1.stock_local).toBe(0); // 10 - 20 (min 0)
            expect(p1.variants[0].stock).toBe("0"); // 4 - 20 (min 0)
        });

        it('should do nothing if product does not exist', async () => {
            await act(async () => {
                await useProductStore.getState().updateProductStock('non-existent', 1, 'local', null);
            });
            
            // Save item should not be called
            expect(LocalDbService.saveItem).not.toHaveBeenCalled();
        });
    });
});
