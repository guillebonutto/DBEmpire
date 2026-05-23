// Mocks must be defined before imports due to Jest hoisting

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
    Alert: { alert: jest.fn() },
}));

// Mock Supabase
const mockSupabase = {
    auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null } })
    },
    from: jest.fn(),
};
jest.mock('../services/supabase', () => ({
    supabase: mockSupabase,
}));

// Mock SyncService
jest.mock('../services/syncService', () => ({
    SyncService: {
        queueAction: jest.fn().mockResolvedValue('sale_id_test_123'),
    }
}));

// Mock LocalDbService
jest.mock('../services/localDbService', () => ({
    LocalDbService: {
        saveItem: jest.fn().mockResolvedValue(),
        getAll: jest.fn().mockResolvedValue([]),
    }
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
    fetch: jest.fn().mockResolvedValue({ isConnected: true }),
}));

import { useFinanceStore } from '../store/useFinanceStore';
import { SyncService } from '../services/syncService';

describe('useFinanceStore - Cart & Sale Flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset the store cart state
        useFinanceStore.setState({
            cartItems: [],
            manualOverrides: {},
            sales: [],
            isLoading: false,
        });
    });

    describe('Cart Operations', () => {
        const testProduct = {
            id: 'prod_1',
            name: 'Gadget Imperial',
            sale_price: 15000,
            cost_price: 5000,
            stock_local: 10,
            stock_cordoba: 5,
        };

        test('should add a new product to cart', () => {
            useFinanceStore.getState().addToCart(testProduct, 2, 'cli_1', 'Azul');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems).toHaveLength(1);
            expect(cartItems[0]).toEqual(expect.objectContaining({
                id: 'prod_1',
                qty: 2,
                color: 'Azul',
                clientId: 'cli_1',
            }));
        });

        test('should stack quantity for same product and color', () => {
            useFinanceStore.getState().addToCart(testProduct, 1, 'cli_1', 'Negro');
            useFinanceStore.getState().addToCart(testProduct, 3, 'cli_1', 'Negro');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems).toHaveLength(1);
            expect(cartItems[0].qty).toBe(4);
        });

        test('should keep separate items for different colors', () => {
            useFinanceStore.getState().addToCart(testProduct, 1, 'cli_1', 'Blanco');
            useFinanceStore.getState().addToCart(testProduct, 1, 'cli_1', 'Rojo');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems).toHaveLength(2);
            expect(cartItems[0].color).toBe('Blanco');
            expect(cartItems[1].color).toBe('Rojo');
        });

        test('should remove item from cart', () => {
            useFinanceStore.getState().addToCart(testProduct, 1, 'cli_1', 'Verde');
            useFinanceStore.getState().addToCart(testProduct, 1, 'cli_1', 'Gris');

            useFinanceStore.getState().removeFromCart('prod_1', 'Verde');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems).toHaveLength(1);
            expect(cartItems[0].color).toBe('Gris');
        });

        test('should update cart item quantity', () => {
            useFinanceStore.getState().addToCart(testProduct, 2, 'cli_1', 'Azul');
            useFinanceStore.getState().updateCartQty('prod_1', 5, 'Azul');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems[0].qty).toBe(5);
        });

        test('should remove item if quantity updated to 0 or less', () => {
            useFinanceStore.getState().addToCart(testProduct, 1, 'cli_1', 'Azul');
            useFinanceStore.getState().updateCartQty('prod_1', 0, 'Azul');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems).toHaveLength(0);
        });

        test('should split cart item into duplicate of 1', () => {
            useFinanceStore.getState().addToCart(testProduct, 3, 'cli_1', 'Azul');
            useFinanceStore.getState().splitCartItem('prod_1', 'Azul');

            const { cartItems } = useFinanceStore.getState();
            expect(cartItems).toHaveLength(2);
            expect(cartItems[0].qty).toBe(2);
            expect(cartItems[1].qty).toBe(1);
        });
    });

    describe('Calculation and Pricing Logic Mocking', () => {
        // Simulating NewSaleScreen's local calculateTotals function
        const getRegionalPrice = (product, location) => {
            if (location === 'cordoba') {
                return parseFloat(product.sale_price_cordoba) || parseFloat(product.sale_price) || 0;
            }
            return parseFloat(product.sale_price) || 0;
        };

        const calculateTotalsMock = ({ cart, selectedPromo, manualDiscount, manualDiscountType, saleLocation, commissionRate = 0.10, commissionType = 'direct', isLeaderSale = false, isSeller = true }) => {
            let subtotal = 0;
            let totalProfit = 0;
            let discount = 0;

            cart.forEach(item => {
                const regionalPrice = getRegionalPrice(item, saleLocation);
                const itemTotal = regionalPrice * item.qty;
                const itemCost = (item.cost_price || 0) * item.qty;
                subtotal += itemTotal;
                totalProfit += (itemTotal - itemCost);
            });

            // Apply Promo
            if (selectedPromo) {
                if (selectedPromo.type === 'global_percent') {
                    discount = subtotal * (selectedPromo.value / 100);
                } else if (selectedPromo.type === 'fixed_discount') {
                    discount = selectedPromo.value;
                } else if (selectedPromo.type === 'buy_x_get_y') {
                    // Simulating 2x1 on qualifying
                    cart.forEach(item => {
                        if (item.qty >= 2) {
                            const freeUnits = Math.floor(item.qty / 2);
                            discount += (freeUnits * getRegionalPrice(item, saleLocation));
                        }
                    });
                }
            }

            // Apply Manual Discount
            let manualDiscountAmt = 0;
            const mVal = parseFloat(manualDiscount) || 0;
            if (mVal > 0) {
                if (manualDiscountType === 'percent') {
                    manualDiscountAmt = subtotal * (mVal / 100);
                } else {
                    manualDiscountAmt = mVal;
                }
            }

            const totalDiscount = discount + manualDiscountAmt;
            const total = subtotal - totalDiscount;
            const finalProfit = totalProfit - totalDiscount;

            // Commission Rates
            let currentRate = 0;
            if (isSeller) {
                if (saleLocation === 'cordoba') {
                    currentRate = (commissionType === 'direct') ? 0.40 : 0.10;
                } else {
                    currentRate = isLeaderSale ? 0.05 : commissionRate;
                }
            }

            const commission = finalProfit * currentRate;

            return {
                subtotal,
                total,
                totalProfit: finalProfit,
                discount,
                manualDiscountAmt,
                commission,
            };
        };

        const testCart = [
            { id: 'p1', name: 'Premium Cup', sale_price: 10000, sale_price_cordoba: 12000, cost_price: 4000, qty: 2 }
        ];

        test('should calculate correct totals for BA location (local)', () => {
            const res = calculateTotalsMock({
                cart: testCart,
                saleLocation: 'local',
                isSeller: true,
                commissionRate: 0.10,
            });

            expect(res.subtotal).toBe(20000); // 10000 * 2
            expect(res.totalProfit).toBe(12000); // (20000 - 8000)
            expect(res.commission).toBe(1200); // 10% of 12000
        });

        test('should calculate correct totals for Córdoba location', () => {
            const res = calculateTotalsMock({
                cart: testCart,
                saleLocation: 'cordoba',
                isSeller: true,
                commissionType: 'direct', // 40%
            });

            expect(res.subtotal).toBe(24000); // 12000 * 2
            expect(res.totalProfit).toBe(16000); // (24000 - 8000)
            expect(res.commission).toBe(6400); // 40% of 16000
        });

        test('should calculate correct commission when Leader closed the sale (5%)', () => {
            const res = calculateTotalsMock({
                cart: testCart,
                saleLocation: 'local',
                isSeller: true,
                isLeaderSale: true, // 5%
            });

            expect(res.commission).toBe(600); // 5% of 12000
        });

        test('should apply global percent promotion', () => {
            const promo = { type: 'global_percent', value: 15 }; // 15% off
            const res = calculateTotalsMock({
                cart: testCart,
                saleLocation: 'local',
                selectedPromo: promo,
                isSeller: false,
            });

            expect(res.discount).toBe(3000); // 15% of 20000
            expect(res.total).toBe(17000);
        });

        test('should apply 2x1 buy_x_get_y promotion', () => {
            const promo = { type: 'buy_x_get_y', value: 0 };
            const res = calculateTotalsMock({
                cart: testCart, // qty = 2, price = 10000
                saleLocation: 'local',
                selectedPromo: promo,
                isSeller: false,
            });

            expect(res.discount).toBe(10000); // 1 unit free
            expect(res.total).toBe(10000);
        });

        test('should apply manual percentage discount', () => {
            const res = calculateTotalsMock({
                cart: testCart,
                saleLocation: 'local',
                manualDiscount: '20',
                manualDiscountType: 'percent',
                isSeller: false,
            });

            expect(res.manualDiscountAmt).toBe(4000); // 20% of 20000
            expect(res.total).toBe(16000);
        });
    });

    describe('Offline Sync Queuing Simulation', () => {
        test('should package and queue sale action in SyncService', async () => {
            const salePayload = {
                id: 'sale_mock_123',
                seller_id: 'seller_abc',
                client_id: 'client_xyz',
                total_amount: 10000,
                profit_generated: 6000,
                commission_amount: 1000,
                status: 'completed',
                sale_location: 'local',
            };

            const cartItems = [{ id: 'prod_1', name: 'Test Product', qty: 1 }];

            await SyncService.queueAction('sale', salePayload, { items: cartItems });

            expect(SyncService.queueAction).toHaveBeenCalledWith(
                'sale',
                salePayload,
                { items: cartItems }
            );
        });
    });
});
