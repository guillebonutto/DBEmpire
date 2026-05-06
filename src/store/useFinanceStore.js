import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';
import NetInfo from '@react-native-community/netinfo';

export const useFinanceStore = create((set, get) => ({
    sales: [],
    expenses: [],
    supplierOrders: [],
    supplierOrderItems: [],
    saleItems: [],
    settings: [],
    cartItems: [], // 🛒 RESTORED
    manualOverrides: {}, // 🛠️ RESTORED
    isLoading: false,
    isInitialized: false,
    lastFetch: null,

    initStore: async () => {
        if (get().isInitialized) return;
        try {
            const [sales, expenses, orders, sItems, items, settings] = await Promise.all([
                LocalDbService.getAll('sales'),
                LocalDbService.getAll('expenses'),
                LocalDbService.getAll('supplier_orders'),
                LocalDbService.getAll('supplier_order_items'),
                LocalDbService.getAll('sale_items'),
                LocalDbService.getAll('settings'),
            ]);
            set({ 
                sales: sales || [], 
                expenses: expenses || [], 
                supplierOrders: orders || [], 
                supplierOrderItems: sItems || [],
                saleItems: items || [],
                settings: settings || [],
                isInitialized: true,
                isLoading: false 
            });
            console.log('[FinanceStore] Local data loaded.');
        } catch (err) {
            console.error('[FinanceStore] Init error:', err);
            set({ isInitialized: true, isLoading: false });
        }
    },

    fetchAllData: async (force = false) => {
        if (!get().isInitialized) await get().initStore();

        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) return;

        const cacheDuration = 10 * 60 * 1000;
        if (!force && get().lastFetch && (Date.now() - get().lastFetch < cacheDuration)) return;

        if (get().sales.length === 0) set({ isLoading: true });

        try {
            const [salesRes, expRes, debtRes, dItemsRes, itemsRes, settingsRes] = await Promise.all([
                supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(500),
                supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(500),
                supabase.from('supplier_orders').select('*').order('created_at', { ascending: false }),
                supabase.from('supplier_order_items').select('*'),
                supabase.from('sale_items').select('*').limit(1000),
                supabase.from('settings').select('*')
            ]);

            if (salesRes.data) await LocalDbService.saveItems('sales', salesRes.data);
            if (expRes.data) await LocalDbService.saveItems('expenses', expRes.data);
            if (debtRes.data) await LocalDbService.saveItems('supplier_orders', debtRes.data);
            if (dItemsRes.data) await LocalDbService.saveItems('supplier_order_items', dItemsRes.data);
            if (itemsRes.data) await LocalDbService.saveItems('sale_items', itemsRes.data);
            if (settingsRes.data) await LocalDbService.saveItems('settings', settingsRes.data);

            set({
                sales: salesRes.data || get().sales,
                expenses: expRes.data || get().expenses,
                supplierOrders: debtRes.data || get().supplierOrders,
                supplierOrderItems: dItemsRes.data || get().supplierOrderItems,
                saleItems: itemsRes.data || get().saleItems,
                settings: settingsRes.data || get().settings,
                lastFetch: Date.now(),
                isLoading: false
            });
        } catch (e) {
            set({ isLoading: false });
        }
    },

    // 🛒 CART ACTIONS (RESTORED)
    addToCart: (product, qty = 1, clientId = null, color = null) => {
        const currentCart = get().cartItems;
        // Check if item with same ID and COLOR exists
        const existingIndex = currentCart.findIndex(item => item.id === product.id && item.color === color);

        if (existingIndex >= 0) {
            const newCart = [...currentCart];
            newCart[existingIndex].qty += qty;
            set({ cartItems: newCart });
        } else {
            set({ cartItems: [...currentCart, { ...product, qty, color, clientId }] });
        }
    },

    removeFromCart: (productId, color = null) => {
        set({ 
            cartItems: get().cartItems.filter(item => !(item.id === productId && item.color === color)) 
        });
    },

    updateCartQty: (productId, newQty, color = null) => {
        if (newQty <= 0) return get().removeFromCart(productId, color);
        set({
            cartItems: get().cartItems.map(item => 
                (item.id === productId && item.color === color) ? { ...item, qty: newQty } : item
            )
        });
    },

    splitCartItem: (productId, color = null) => {
        const currentCart = get().cartItems;
        const itemIndex = currentCart.findIndex(item => item.id === productId && item.color === color);
        if (itemIndex >= 0 && currentCart[itemIndex].qty > 1) {
            const newCart = [...currentCart];
            newCart[itemIndex].qty -= 1;
            // Add a duplicate with qty 1
            newCart.push({ ...newCart[itemIndex], qty: 1 });
            set({ cartItems: newCart });
        }
    },

    resetCart: () => set({ cartItems: [], manualOverrides: {} }),

    setManualOverride: (productId, field, value) => {
        set({
            manualOverrides: {
                ...get().manualOverrides,
                [`${productId}_${field}`]: value
            }
        });
    },

    setFinanceState: (newState) => set(newState),

    addSaleLocal: (newSale) => set((state) => ({ 
        sales: [newSale, ...state.sales] 
    })),

    addExpenseLocal: (newExpense) => set((state) => ({ 
        expenses: [newExpense, ...state.expenses] 
    })),
}));
