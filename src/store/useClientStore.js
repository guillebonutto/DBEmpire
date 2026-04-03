import { create } from 'zustand';
import { supabase } from '../services/supabase';

export const useClientStore = create((set, get) => ({
    clients: [],
    loadingClients: false,

    fetchClients: async (forceRefresh = false) => {
        if (get().clients.length > 0 && !forceRefresh) return;

        set({ loadingClients: true });
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name');
            
            if (error) throw error;
            set({ clients: data || [] });
        } catch (err) {
            console.log('Error fetching clients:', err);
        } finally {
            set({ loadingClients: false });
        }
    },

    // OPTIMISTIC UPDATES
    addClientLocally: (client) => {
        set((state) => {
            const newList = [...state.clients, client];
            return { clients: newList.sort((a,b) => a.name.localeCompare(b.name)) };
        });
    },

    updateClientLocally: (client) => {
        set((state) => ({
            clients: state.clients.map(c => c.id === client.id ? { ...c, ...client } : c)
        }));
    }
}));
