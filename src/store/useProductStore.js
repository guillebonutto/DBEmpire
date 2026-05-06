import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';
import NetInfo from '@react-native-community/netinfo';

export const useProductStore = create((set, get) => ({
    products: [],
    loadingProducts: false,
    isInitialized: false,
    lastFetch: null,

    initStore: async () => {
        if (get().isInitialized) return;
        try {
            const local = await LocalDbService.getAll('products');
            set({ 
                products: local || [], 
                isInitialized: true,
                loadingProducts: false 
            });
            console.log('[ProductStore] Local stock loaded instantly.');
        } catch (err) {
            console.error('[ProductStore] Init error:', err);
            set({ isInitialized: true, loadingProducts: false });
        }
    },

    fetchProducts: async (force = false) => {
        if (!get().isInitialized) {
            await get().initStore();
        }

        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) return;

        const cacheDuration = 10 * 60 * 1000;
        if (!force && get().lastFetch && (Date.now() - get().lastFetch < cacheDuration)) return;

        if (get().products.length === 0) {
            set({ loadingProducts: true });
        }

        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('active', true)
                .order('name');

            if (error) throw error;
            if (data) {
                await LocalDbService.saveItems('products', data);
                set({ products: data, lastFetch: Date.now() });
            }
        } catch (e) {
            console.warn('[ProductStore] Background refresh failed:', e.message);
        } finally {
            set({ loadingProducts: false });
        }
    },
    updateProductStock: (productId, newStock) => {
        set(state => ({
            products: state.products.map(p => 
                p.id === productId ? { ...p, current_stock: newStock } : p
            )
        }));
    },
}));
