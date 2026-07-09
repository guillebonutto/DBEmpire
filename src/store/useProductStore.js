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
            const parsedLocal = (local || []).map(prod => {
                let variants = [];
                try {
                    variants = prod.variants_json 
                        ? JSON.parse(prod.variants_json) 
                        : (prod.variants ? (Array.isArray(prod.variants) ? prod.variants : JSON.parse(prod.variants)) : []);
                } catch (e) {
                    console.log('Error parsing local variants in initStore:', e);
                }
                return {
                    ...prod,
                    variants: Array.isArray(variants) ? variants : []
                };
            });
            set({ 
                products: parsedLocal, 
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
                // --- PENDING SYNC RECONCILIATION ---
                // Query pending syncs to adjust stock with sales that are still queued
                const pendingSyncs = await LocalDbService.getPendingSyncs();
                const adjustedProducts = data.map(prod => {
                    const matchedSales = pendingSyncs.filter(ps => ps.table_name === 'sales' && ps.action === 'INSERT');
                    
                    let localStock = parseInt(prod.stock_local) || 0;
                    let cordobaStock = parseInt(prod.stock_cordoba) || 0;
                    let variants = [];
                    try {
                        variants = Array.isArray(prod.variants) 
                            ? prod.variants 
                            : (typeof prod.variants === 'string' ? JSON.parse(prod.variants) : []);
                    } catch (e) {
                        console.log('Error parsing variants in fetchProducts:', e);
                    }

                    matchedSales.forEach(ps => {
                        let payload = {};
                        let metadata = {};
                        try {
                            payload = JSON.parse(ps.payload);
                            metadata = JSON.parse(ps.metadata);
                        } catch (e) {
                            console.log('Error parsing pending sync payload:', e);
                        }

                        if (metadata.items && Array.isArray(metadata.items)) {
                            const matchedItem = metadata.items.find(item => item.id === prod.id);
                            if (matchedItem) {
                                const qty = parseInt(matchedItem.qty) || 0;
                                const saleLocation = payload.sale_location || 'local';
                                
                                // Decrement stock for the location
                                if (saleLocation === 'cordoba') {
                                    cordobaStock = Math.max(0, cordobaStock - qty);
                                } else {
                                    localStock = Math.max(0, localStock - qty);
                                }

                                // Decrement stock for variant color
                                if (matchedItem.color && Array.isArray(variants)) {
                                    const cleanColor = matchedItem.color.trim().toLowerCase();
                                    const vIdx = variants.findIndex(v => v.color?.trim().toLowerCase() === cleanColor);
                                    if (vIdx >= 0) {
                                        const currentVarStock = parseInt(variants[vIdx].stock) || 0;
                                        variants[vIdx].stock = Math.max(0, currentVarStock - qty).toString();
                                    }
                                }
                            }
                        }
                    });

                    return {
                        ...prod,
                        stock_local: localStock,
                        stock_cordoba: cordobaStock,
                        current_stock: localStock + cordobaStock,
                        variants: variants
                    };
                });

                await LocalDbService.saveItems('products', adjustedProducts);
                set({ products: adjustedProducts, lastFetch: Date.now() });
            }
        } catch (e) {
            console.warn('[ProductStore] Background refresh failed:', e.message);
        } finally {
            set({ loadingProducts: false });
        }
    },
    updateProductStock: async (productId, qtySold, saleLocation, color = null) => {
        const products = get().products;
        const product = products.find(p => p.id === productId);
        if (!product) return;

        // Clone product so we don't mutate state directly
        const updatedProduct = { ...product };
        const qty = parseInt(qtySold) || 0;

        // 1. Decrement correct location stock
        if (saleLocation === 'cordoba') {
            const currentCba = parseInt(updatedProduct.stock_cordoba) || 0;
            updatedProduct.stock_cordoba = Math.max(0, currentCba - qty);
        } else {
            const currentLocal = parseInt(updatedProduct.stock_local) || 0;
            updatedProduct.stock_local = Math.max(0, currentLocal - qty);
        }

        // Recalculate total current stock
        const stockLocal = parseInt(updatedProduct.stock_local) || 0;
        const stockCba = parseInt(updatedProduct.stock_cordoba) || 0;
        updatedProduct.current_stock = stockLocal + stockCba;

        // 2. Decrement variants stock if color is passed
        if (color && updatedProduct.variants) {
            let loadedVariants = [];
            try {
                loadedVariants = Array.isArray(updatedProduct.variants) 
                    ? JSON.parse(JSON.stringify(updatedProduct.variants))
                    : (typeof updatedProduct.variants === 'string' ? JSON.parse(updatedProduct.variants) : []);
            } catch (e) {
                console.log('Error parsing variants:', e);
            }

            if (Array.isArray(loadedVariants)) {
                const cleanColor = color.trim().toLowerCase();
                const vIdx = loadedVariants.findIndex(v => v.color?.trim().toLowerCase() === cleanColor);
                if (vIdx >= 0) {
                    const currentVarStock = parseInt(loadedVariants[vIdx].stock) || 0;
                    loadedVariants[vIdx].stock = Math.max(0, currentVarStock - qty).toString();
                }
                updatedProduct.variants = loadedVariants;
            }
        }

        // 3. Save to SQLite database (instant local consistency)
        try {
            await LocalDbService.saveItem('products', updatedProduct);
            console.log('[ProductStore] Local stock discounted in SQLite.');
        } catch (dbErr) {
            console.error('[ProductStore] Failed to save discounted stock in SQLite:', dbErr);
        }

        // 4. Update Zustand state
        set(state => ({
            products: state.products.map(p => p.id === productId ? updatedProduct : p)
        }));
    },
}));
