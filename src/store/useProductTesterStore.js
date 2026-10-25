import { create } from 'zustand';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncService } from '../services/syncService';

export const useProductTesterStore = create((set, get) => ({
    testProducts: [],
    streetResults: [],
    isLoading: false,
    
    fetchTestProducts: async () => {
        set({ isLoading: true });
        try {
            const { data, error } = await supabase
                .from('test_products')
                .select('*')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            set({ testProducts: data || [] });
            await AsyncStorage.setItem('cached_test_products', JSON.stringify(data || []));
        } catch (error) {
            console.log('Offline: reading test products from cache...');
            try {
                const cached = await AsyncStorage.getItem('cached_test_products');
                if (cached) set({ testProducts: JSON.parse(cached) });
            } catch (e) {}
        } finally {
            set({ isLoading: false });
        }
    },
    
    fetchStreetResults: async () => {
        try {
            const { data, error } = await supabase
                .from('street_test_results')
                .select('*, test_products(name)')
                .order('created_at', { ascending: false });
            
            if (error) throw error;
            set({ streetResults: data || [] });
            await AsyncStorage.setItem('cached_street_results', JSON.stringify(data || []));
        } catch (error) {
            console.log('Offline: reading street results from cache...');
            try {
                const cached = await AsyncStorage.getItem('cached_street_results');
                if (cached) set({ streetResults: JSON.parse(cached) });
            } catch (e) {}
        }
    },

    addTestProduct: async (productData) => {
        try {
            const newProduct = {
                id: 'local-tp-' + Date.now(),
                ...productData,
                created_at: new Date().toISOString()
            };
            await SyncService.queueAction('test_product', newProduct, {}, 'INSERT');
            
            set(state => ({ testProducts: [newProduct, ...state.testProducts] }));
            return newProduct;
        } catch (error) {
            console.error('Error adding test product:', error);
            throw error;
        }
    },

    submitStreetTestResult: async (testData) => {
        try {
            const newResult = {
                id: 'local-str-' + Date.now(),
                ...testData,
                created_at: new Date().toISOString()
            };
            await SyncService.queueAction('street_test_result', newResult, {}, 'INSERT');
        } catch (error) {
            console.error('Error saving street test result:', error);
            throw error;
        }
    },

    updateMetric: async (id, field, increment) => {
        try {
            // Optimistic update
            set(state => ({
                testProducts: state.testProducts.map(p => {
                    if (p.id === id) {
                        return { ...p, [field]: (p[field] || 0) + increment };
                    }
                    return p;
                })
            }));

            // Sync with DB using RPC or just regular update by pulling current first
            // To be entirely safe without RPC, we can just push the exact incremented value
            const currentItem = get().testProducts.find(p => p.id === id);
            if (!currentItem) return;

            await SyncService.queueAction('test_product', {
                id,
                [field]: currentItem[field]
            }, {}, 'UPDATE');
        } catch (error) {
            console.error('Error updating metric:', error);
            get().fetchTestProducts(); // Revert optimistic assuming something failed
        }
    },

    updateStatus: async (id, status) => {
        try {
            set(state => ({
                testProducts: state.testProducts.map(p => 
                    p.id === id ? { ...p, status } : p
                )
            }));

            await SyncService.queueAction('test_product', { id, status }, {}, 'UPDATE');
        } catch (error) {
            console.error('Error updating status:', error);
            get().fetchTestProducts();
        }
    },
    
    deleteTestProduct: async (id) => {
        try {
            set(state => ({
                testProducts: state.testProducts.filter(p => p.id !== id)
            }));
            await SyncService.queueAction('test_product', { id }, {}, 'DELETE');
        } catch (error) {
            console.error('Error deleting test product:', error);
            get().fetchTestProducts();
        }
    }
}));
