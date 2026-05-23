import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';
import NetInfo from '@react-native-community/netinfo';

export const useSupplierStore = create((set, get) => ({
    suppliers: [],
    loadingSuppliers: false,
    isInitialized: false,
    lastFetch: null,

    initStore: async (force = false) => {
        if (get().isInitialized && !force) return;
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

        let isConnected = true;
        try {
            const netInfo = await NetInfo.fetch();
            isConnected = !!netInfo?.isConnected;
        } catch (netErr) {
            console.warn('[SupplierStore] NetInfo fetch failed, defaulting to connected:', netErr.message);
        }

        if (!isConnected) return;

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
            
            let finalData = data || [];

            // --- SELF-HEALING SUPPLIER AUTO-IMPORT ---
            // If the remote database has 0 suppliers, we check our local database first to avoid overwriting.
            // If local is also empty, we extract unique provider names from existing products and seed them.
            if (finalData.length === 0) {
                const local = await LocalDbService.getAll('suppliers');
                if (local && local.length > 0) {
                    finalData = local;
                } else {
                    const { data: products } = await supabase
                        .from('products')
                        .select('provider');
                    
                    if (products && products.length > 0) {
                        const uniqueProviders = [...new Set(products.map(p => p.provider).filter(p => p && p.trim() !== ''))];
                        if (uniqueProviders.length > 0) {
                            const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                                const r = Math.random() * 16 | 0;
                                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                            });

                            const toInsert = uniqueProviders.map(name => ({
                                id: generateUUID(),
                                name: name.trim(),
                                phone: '',
                                email: '',
                                notes: 'Importado automáticamente desde productos existentes',
                                active: true,
                                created_at: new Date().toISOString()
                            }));

                            // We assign to finalData immediately so that if Supabase denies the insert due to RLS,
                            // we STILL retain the seeded suppliers locally and in Zustand state!
                            finalData = toInsert;

                            console.log(`[SupplierStore] Self-healing: Inserting ${toInsert.length} unique suppliers...`);
                            const { data: inserted, error: insertErr } = await supabase
                                .from('suppliers')
                                .insert(toInsert)
                                .select();
                            
                            if (!insertErr && inserted && inserted.length > 0) {
                                finalData = inserted;
                                console.log('[SupplierStore] Self-healing Supabase insert succeeded.');
                            } else {
                                console.warn('[SupplierStore] Self-healing Supabase insert failed (using secure local fallback):', insertErr);
                            }
                        }
                    }
                }
            }

            if (finalData && finalData.length > 0) {
                await LocalDbService.saveItems('suppliers', finalData);
                set({ suppliers: finalData, lastFetch: Date.now() });
            }
        } catch (e) {
            console.warn('[SupplierStore] Background refresh failed:', e.message);
        } finally {
            set({ loadingSuppliers: false });
        }
    },
}));
