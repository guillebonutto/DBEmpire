import { create } from 'zustand';
import { supabase } from '../services/supabase';

export const useFinanceStore = create((set, get) => ({
    sales: [],
    expenses: [],
    supplierOrders: [],
    saleItems: [],
    settings: [],
    
    isLoading: false,
    lastFetch: null,

    fetchAllData: async (force = false) => {
        const { lastFetch } = get();
        // Smart Caching: Only fetch if forced or if data is older than 60 seconds
        if (!force && lastFetch && (Date.now() - lastFetch < 60000)) {
            return;
        }

        set({ isLoading: true });
        try {
            const [settingsRes, debtRes, salesRes, expensesRes, itemsRes] = await Promise.all([
                supabase.from('settings').select('*'),
                supabase.from('supplier_orders').select('*'),
                supabase.from('sales')
                    .select('id, created_at, total_amount, profit_generated, commission_amount, status, device_sig')
                    .order('created_at', { ascending: false }),
                supabase.from('expenses')
                    .select('id, amount, description, category, created_at, details')
                    .order('created_at', { ascending: false }),
                supabase.from('sale_items').select('sale_id, quantity, products(name)')
            ]);

            // Fallback for device_sig missing column
            let fetchedSales = salesRes.data || [];
            if (salesRes.error && salesRes.error.message.includes('device_sig')) {
                const retry = await supabase.from('sales')
                    .select('id, created_at, total_amount, profit_generated, commission_amount, status')
                    .order('created_at', { ascending: false });
                fetchedSales = retry.data || [];
            } else if (salesRes.error) {
                console.error("Error fetching sales:", salesRes.error);
            }

            set({
                settings: settingsRes.data || [],
                supplierOrders: debtRes.data || [],
                sales: fetchedSales,
                expenses: expensesRes.data || [],
                saleItems: itemsRes.data || [],
                lastFetch: Date.now(),
                isLoading: false
            });
        } catch (error) {
            console.error('Error fetching finance data:', error);
            set({ isLoading: false });
        }
    },

    // OPTIMISTIC UPDATES
    addSaleLocal: (newSale, newSaleItems = []) => {
        set((state) => {
            // Ensure state.sales and state.saleItems are arrays
            const safeSales = Array.isArray(state.sales) ? state.sales : [];
            const safeSaleItems = Array.isArray(state.saleItems) ? state.saleItems : [];
            
            return {
                sales: [newSale, ...safeSales],
                saleItems: [...safeSaleItems, ...newSaleItems]
            };
        });
    },
    
    addExpenseLocal: (newExpense) => {
        set((state) => {
            const safeExpenses = Array.isArray(state.expenses) ? state.expenses : [];
            return {
                expenses: [newExpense, ...safeExpenses]
            };
        });
    },

    addSupplierOrderLocal: (newOrder) => {
        set((state) => {
            const safeOrders = Array.isArray(state.supplierOrders) ? state.supplierOrders : [];
            return {
                supplierOrders: [newOrder, ...safeOrders]
            };
        });
    },
    
    updateSupplierOrderLocal: (updatedOrder) => {
        set((state) => {
            const safeOrders = Array.isArray(state.supplierOrders) ? state.supplierOrders : [];
            return {
                supplierOrders: safeOrders.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
            };
        });
    },

    // CART MANAGEMENT (Centralized for NewSaleScreen)
    cartItems: [],
    manualOverrides: {}, // Map of productId -> boolean

    setCart: (items) => set({ cartItems: items }),

    addToCart: (product, qty = 1, clientId = null, color = null) => {
        set((state) => {
            const existingIndex = state.cartItems.findIndex(item => 
                item.id === product.id && 
                item.clientId === clientId && 
                item.selectedColor === color
            );

            if (existingIndex !== -1) {
                const updated = [...state.cartItems];
                updated[existingIndex].qty += qty;
                return { cartItems: updated };
            }

            // New item with stable cartId to allow splitting without index confusion
            const newItem = {
                ...product,
                cartId: `${product.id}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                qty,
                clientId,
                selectedColor: color
            };
            return { cartItems: [...state.cartItems, newItem] };
        });
    },

    updateCartQty: (cartId, qty) => {
        set((state) => ({
            cartItems: state.cartItems.map(item => 
                item.cartId === cartId ? { ...item, qty: Math.max(0, qty) } : item
            ).filter(item => item.qty > 0)
        }));
    },

    removeFromCart: (cartId) => {
        set((state) => ({
            cartItems: state.cartItems.filter(item => item.cartId !== cartId)
        }));
    },

    splitCartItem: (cartId) => {
        const { cartItems } = get();
        const item = cartItems.find(i => i.cartId === cartId);
        if (!item || item.qty < 2) return;

        // Split RFID x2 into 2 RFID x1
        // One keeps the client, one goes to "unassigned" (null)
        const item1 = { ...item, qty: 1, cartId: `${item.id}-split-1-${Date.now()}` };
        const item2 = { ...item, qty: item.qty - 1, clientId: null, cartId: `${item.id}-split-2-${Date.now()}` };

        set({
            cartItems: cartItems.flatMap(i => i.cartId === cartId ? [item1, item2] : [i])
        });
    },

    setManualOverride: (productId, value = true) => {
        set((state) => ({
            manualOverrides: { ...state.manualOverrides, [productId]: value }
        }));
    },

    resetCart: () => set({ cartItems: [], manualOverrides: {} }),

    // ROLLBACK METHODS
    setFinanceState: (partialState) => {
        set(partialState);
    }
}));
