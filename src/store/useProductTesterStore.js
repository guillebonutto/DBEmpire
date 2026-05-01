import { create } from 'zustand';
import { supabase } from '../services/supabase';

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
        } catch (error) {
            console.error('Error fetching test products:', error);
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
        } catch (error) {
            console.error('Error fetching street results:', error);
        }
    },

    addTestProduct: async (productData) => {
        try {
            const { data, error } = await supabase
                .from('test_products')
                .insert([productData])
                .select()
                .single();
            
            if (error) throw error;
            set(state => ({ testProducts: [data, ...state.testProducts] }));
            return data;
        } catch (error) {
            console.error('Error adding test product:', error);
            throw error;
        }
    },

    submitStreetTestResult: async (testData) => {
        try {
            const { error } = await supabase
                .from('street_test_results')
                .insert([testData]);
            
            if (error) throw error;
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

            const { error } = await supabase
                .from('test_products')
                .update({ [field]: currentItem[field] })
                .eq('id', id);

            if (error) throw error;
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

            const { error } = await supabase
                .from('test_products')
                .update({ status })
                .eq('id', id);

            if (error) throw error;
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
            const { error } = await supabase.from('test_products').delete().eq('id', id);
            if (error) throw error;
        } catch (error) {
            console.error('Error deleting test product:', error);
            get().fetchTestProducts();
        }
    }
}));
