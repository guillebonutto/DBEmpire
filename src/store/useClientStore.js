import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';

export const useClientStore = create((set, get) => ({
    clients: [],
    loadingClients: false,
    isInitialized: false,

    initStore: async () => {
        if (get().isInitialized) return;
        try {
            const cached = await LocalDbService.getAll('clients');
            if (cached && cached.length > 0) {
                set({ clients: cached.sort((a,b) => a.name.localeCompare(b.name)), isInitialized: true });
            }
        } catch (err) {
            console.error('[ClientStore] Init error:', err);
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
                set({ clients: data });
                // Persist to local SQLite
                await LocalDbService.saveItems('clients', data);
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
    }
}));

