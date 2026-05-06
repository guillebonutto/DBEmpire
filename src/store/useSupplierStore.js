import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';
import NetInfo from '@react-native-community/netinfo';

export const useSupplierStore = create((set, get) => ({
    suppliers: [],
    loadingSuppliers: false,
    isInitialized: false,
    lastFetch: null,

    initStore: async () => {
        if (get().isInitialized) return;
        try {
            const local = await LocalDbService.getAll('suppliers');
            set({ 
                suppliers: local || [], 
                isInitialized: true,
                loadingSuppliers: false 
            });
            console.log('[SupplierStore] Local suppliers loaded.');
        } catch (err) {
            console.error('[SupplierStore] Init error:', err);
            set({ isInitialized: true, loadingSuppliers: false });
        }
    },

    fetchSuppliers: async (force = false) => {
        if (!get().isInitialized) {
            await get().initStore();
        }

        const netInfo = await NetInfo.fetch();
        if (!netInfo.isConnected) return;

        const cacheDuration = 10 * 60 * 1000;
        if (!force && get().lastFetch && (Date.now() - get().lastFetch < cacheDuration)) return;

        if (get().suppliers.length === 0) {
            set({ loadingSuppliers: true });
        }

        try {
            const { data, error } = await supabase
                .from('suppliers')
                .select('*')
                .order('name');

            if (error) throw error;
            if (data) {
                await LocalDbService.saveItems('suppliers', data);
                set({ suppliers: data, lastFetch: Date.now() });
            }
        } catch (e) {
            console.warn('[SupplierStore] Background refresh failed:', e.message);
        } finally {
            set({ loadingSuppliers: false });
        }
    },
}));
