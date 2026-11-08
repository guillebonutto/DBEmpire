import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';

export const useClientStore = create((set, get) => ({
    clients: [],
    loadingClients: false,
    isInitialized: false,

    initStore: async (forceRefresh = false) => {
        if (get().isInitialized && !forceRefresh) return;
        try {
            const cached = await LocalDbService.getAll('clients');
            set({
                clients: (cached && cached.length > 0) ? cached.sort((a,b) => a.name.localeCompare(b.name)) : [],
                isInitialized: true
            });
        } catch (err) {
            console.error('[ClientStore] Init error:', err);
            set({ isInitialized: true });
        }
    },

    fetchClients: async (forceRefresh = false) => {
        if (get().clients.length > 0 && !forceRefresh) return;

        if (get().clients.length === 0) {
            set({ loadingClients: true });
        }
        try {
            const { data, error } = await supabase
                .from('clients')
                .select('*')
                .order('name');
            
            if (error) throw error;
            if (data && data.length > 0) {
                // Persist to local SQLite (which automatically preserves pending offline changes)
                await LocalDbService.replaceFullTable('clients', data);
                // Load consistent data from SQLite
                const consistentClients = await LocalDbService.getAll('clients');
                set({ clients: (consistentClients && consistentClients.length > 0 ? consistentClients : data).sort((a,b) => a.name.localeCompare(b.name)) });
            }
        } catch (err) {
            console.log('Supabase unreachable, loading clients from SQLite...', err.message);
            const cached = await LocalDbService.getAll('clients');
            if (cached && cached.length > 0) {
                set({ clients: cached.sort((a,b) => a.name.localeCompare(b.name)) });
            }
        } finally {
            set({ loadingClients: false });
        }
    },

    // OPTIMISTIC UPDATES
    addClientLocally: async (client) => {
        await LocalDbService.saveItem('clients', client);
        set((state) => {
            const newList = [...state.clients, client].sort((a,b) => a.name.localeCompare(b.name));
            return { clients: newList };
        });
    },

    updateClientLocally: async (client) => {
        await LocalDbService.saveItem('clients', client);
        set((state) => {
            const updated = state.clients.map(c => c.id === client.id ? { ...c, ...client } : c);
            return { clients: updated };
        });
    },

    deleteClientLocally: async (id) => {
        await LocalDbService.deleteItem('clients', id);
        set((state) => ({
            clients: state.clients.filter(c => c.id !== id)
        }));
    }
}));

