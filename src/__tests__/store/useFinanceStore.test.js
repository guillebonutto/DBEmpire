import { act } from '@testing-library/react-native';
import { useFinanceStore } from '../../store/useFinanceStore';
import { supabase } from '../../services/supabase';
import { LocalDbService } from '../../services/localDbService';
import NetInfo from '@react-native-community/netinfo';

jest.mock('../../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue({ data: [] })
        }))
    }
}));

jest.mock('../../services/localDbService', () => ({
    LocalDbService: {
        getAll: jest.fn(),
        replaceFullTable: jest.fn()
    }
}));

jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn()
}));

describe('useFinanceStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        const store = useFinanceStore.getState();
        store.sales = [];
        store.expenses = [];
        store.supplierOrders = [];
        store.supplierOrderItems = [];
        store.saleItems = [];
        store.settings = [];
        store.cartItems = [];
        store.manualOverrides = {};
        store.isLoading = false;
        store.isInitialized = false;
        store.lastFetch = null;
    });

    describe('initStore', () => {
        it('should load all data from local DB and map relationships', async () => {
            LocalDbService.getAll.mockImplementation((table) => {
                switch(table) {
                    case 'sales': return Promise.resolve([{ id: 's1', client_id: 'c1' }]);
                    case 'expenses': return Promise.resolve([{ id: 'e1' }]);
                    case 'clients': return Promise.resolve([{ id: 'c1', name: 'John Doe' }]);
                    case 'products': return Promise.resolve([{ id: 'p1', name: 'Prod A' }]);
                    case 'sale_items': return Promise.resolve([{ id: 'si1', sale_id: 's1', product_id: 'p1' }]);
                    default: return Promise.resolve([]);
                }
            });

            await act(async () => {
                await useFinanceStore.getState().initStore();
            });

            const state = useFinanceStore.getState();
            expect(state.isInitialized).toBe(true);
            expect(state.expenses).toHaveLength(1);
            expect(state.sales).toHaveLength(1);
            expect(state.sales[0].clients.name).toBe('John Doe');
            expect(state.sales[0].sale_items).toHaveLength(1);
            expect(state.sales[0].sale_items[0].products.name).toBe('Prod A');
        });

        it('should handle errors gracefully', async () => {
            LocalDbService.getAll.mockRejectedValue(new Error('DB Failed'));

            await act(async () => {
                await useFinanceStore.getState().initStore();
            });

            const state = useFinanceStore.getState();
            expect(state.isInitialized).toBe(true);
            expect(state.isLoading).toBe(false);
            expect(state.sales).toHaveLength(0);
        });
    });

    describe('fetchAllData', () => {
        it('should exit if offline', async () => {
            NetInfo.fetch.mockResolvedValue({ isConnected: false });
            await act(async () => {
                await useFinanceStore.getState().fetchAllData();
            });
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('should fetch data from supabase and update local db', async () => {
            NetInfo.fetch.mockResolvedValue({ isConnected: true });
            
            const mockSales = [{ id: '1', total: 100 }];
            supabase.from.mockImplementation(() => ({
                select: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({ data: mockSales })
            }));

            await act(async () => {
                await useFinanceStore.getState().fetchAllData(true);
            });

            expect(LocalDbService.replaceFullTable).toHaveBeenCalledWith('sales', mockSales);
            const state = useFinanceStore.getState();
            expect(state.sales).toEqual(mockSales);
            expect(state.isLoading).toBe(false);
            expect(state.lastFetch).not.toBeNull();
        });
    });

    describe('Cart Actions', () => {
        it('addToCart should add new item or increment qty', () => {
            const product = { id: 'p1', name: 'Product A', price: 10 };
            
            act(() => {
                useFinanceStore.getState().addToCart(product, 1, 'c1', 'red');
            });

            let state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(1);
            expect(state.cartItems[0].qty).toBe(1);

            // Add same product
            act(() => {
                useFinanceStore.getState().addToCart(product, 2, 'c1', 'red');
            });

            state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(1);
            expect(state.cartItems[0].qty).toBe(3);

            // Add different color
            act(() => {
                useFinanceStore.getState().addToCart(product, 1, 'c1', 'blue');
            });

            state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(2);
        });

        it('removeFromCart should remove specific item by id and color', () => {
            act(() => {
                useFinanceStore.setState({
                    cartItems: [
                        { id: 'p1', color: 'red' },
                        { id: 'p1', color: 'blue' }
                    ]
                });
                useFinanceStore.getState().removeFromCart('p1', 'red');
            });

            const state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(1);
            expect(state.cartItems[0].color).toBe('blue');
        });

        it('updateCartQty should modify qty or remove if 0', () => {
            act(() => {
                useFinanceStore.setState({
                    cartItems: [{ id: 'p1', qty: 2, color: 'red' }]
                });
                useFinanceStore.getState().updateCartQty('p1', 5, 'red');
            });

            let state = useFinanceStore.getState();
            expect(state.cartItems[0].qty).toBe(5);

            act(() => {
                useFinanceStore.getState().updateCartQty('p1', 0, 'red');
            });

            state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(0);
        });

        it('splitCartItem should duplicate item with qty 1 and decrement original', () => {
            act(() => {
                useFinanceStore.setState({
                    cartItems: [{ id: 'p1', qty: 3, color: 'red' }]
                });
                useFinanceStore.getState().splitCartItem('p1', 'red');
            });

            const state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(2);
            expect(state.cartItems[0].qty).toBe(2);
            expect(state.cartItems[1].qty).toBe(1);
        });

        it('resetCart should clear cart and manual overrides', () => {
            act(() => {
                useFinanceStore.setState({
                    cartItems: [{ id: '1' }],
                    manualOverrides: { '1_price': 10 }
                });
                useFinanceStore.getState().resetCart();
            });

            const state = useFinanceStore.getState();
            expect(state.cartItems).toHaveLength(0);
            expect(state.manualOverrides).toEqual({});
        });

        it('setManualOverride should correctly update object map', () => {
            act(() => {
                useFinanceStore.getState().setManualOverride('p1', 'price', 150);
            });

            const state = useFinanceStore.getState();
            expect(state.manualOverrides['p1_price']).toBe(150);
        });
    });

    describe('Local array insertions', () => {
        it('should add to local lists correctly', () => {
            act(() => {
                useFinanceStore.getState().addSaleLocal({ id: 'sale1' });
                useFinanceStore.getState().addExpenseLocal({ id: 'exp1' });
                useFinanceStore.getState().addSupplierOrderLocal({ id: 'ord1' });
            });

            const state = useFinanceStore.getState();
            expect(state.sales[0].id).toBe('sale1');
            expect(state.expenses[0].id).toBe('exp1');
            expect(state.supplierOrders[0].id).toBe('ord1');
        });

        it('should update local supplier order correctly', () => {
            act(() => {
                useFinanceStore.setState({ supplierOrders: [{ id: '1', name: 'Order 1' }] });
                useFinanceStore.getState().updateSupplierOrderLocal({ id: '1', name: 'Updated Order' });
            });

            const state = useFinanceStore.getState();
            expect(state.supplierOrders[0].name).toBe('Updated Order');
        });
    });
});
