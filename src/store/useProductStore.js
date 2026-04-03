import { create } from 'zustand';
import { supabase } from '../services/supabase';

export const useProductStore = create((set, get) => ({
    products: [],
    loadingProducts: false,

    fetchProducts: async (forceRefresh = false) => {
        if (get().products.length > 0 && !forceRefresh) return;
        
        set({ loadingProducts: true });
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('name');
            
            if (error) throw error;
            set({ products: data || [] });
        } catch (err) {
            console.log('Error fetching products:', err);
        } finally {
            set({ loadingProducts: false });
        }
    },

    // OPTIMISTIC UPDATES
    updateProductStock: (productId, qtyToDeductLocal, qtyToDeductTotal) => {
        set((state) => ({
            products: state.products.map(p => {
                if (p.id === productId) {
                    return {
                        ...p,
                        stock_local: Math.max(0, (p.stock_local || 0) - qtyToDeductLocal),
                        current_stock: Math.max(0, (p.current_stock || 0) - qtyToDeductTotal)
                    };
                }
                return p;
            })
        }));
    },

    addProductLocally: (product) => {
        set((state) => {
            const newList = [...state.products, product];
            return { products: newList.sort((a,b) => a.name.localeCompare(b.name)) };
        });
    },

    updateProductLocally: (product) => {
        set((state) => ({
            products: state.products.map(p => p.id === product.id ? { ...p, ...product } : p)
        }));
    },
    
    deleteProductLocally: (productId) => {
        set((state) => ({
            products: state.products.filter(p => p.id !== productId)
        }));
    },

    setProducts: (newProductsData) => {
        set({ products: newProductsData });
    }
}));
