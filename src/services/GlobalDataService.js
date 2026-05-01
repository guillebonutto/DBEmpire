import { supabase } from './supabase';
import { LocalDbService } from './localDbService';

// In-memory cache for ultra-fast access
let memoryCache = {
    products: [],
    clients: [],
    profiles: [],
    promotions: [],
    settings: {}
};

export const GlobalDataService = {
    /**
     * Downloads ALL essential data from Supabase and caches it locally in SQLite.
     */
    preloadAll: async () => {
        console.log('[GlobalDataService] Starting full database download to SQLite...');
        try {
            // 1. Load from SQLite first (instant start)
            await GlobalDataService.loadFromSQLite();

            // 2. Fetch fresh data from Supabase in parallel
            const [
                { data: products },
                { data: clients },
                { data: settings }
            ] = await Promise.all([
                supabase.from('products').select('*').eq('active', true).order('name'),
                supabase.from('clients').select('*').order('name'),
                supabase.from('settings').select('*')
            ]);

            // 3. Update memory cache and SQLite
            if (products) {
                memoryCache.products = products;
                await LocalDbService.saveItems('products', products);
            }
            if (clients) {
                memoryCache.clients = clients;
                await LocalDbService.saveItems('clients', clients);
            }
            if (settings) {
                const settingsMap = {};
                settings.forEach(s => settingsMap[s.key] = s.value);
                memoryCache.settings = settingsMap;
                await LocalDbService.saveItems('settings', settings);
            }

            console.log('[GlobalDataService] Database synced to SQLite successfully.');
            return true;
        } catch (error) {
            console.error('[GlobalDataService] Preload error:', error);
            return false;
        }
    },

    loadFromSQLite: async () => {
        try {
            const [products, clients, settings] = await Promise.all([
                LocalDbService.getAll('products'),
                LocalDbService.getAll('clients'),
                LocalDbService.getAll('settings')
            ]);

            if (products) memoryCache.products = products;
            if (clients) memoryCache.clients = clients;
            
            if (settings) {
                const settingsMap = {};
                settings.forEach(s => settingsMap[s.key] = s.value);
                memoryCache.settings = settingsMap;
            }
        } catch (e) {
            console.error('[GlobalDataService] Load from SQLite error:', e);
        }
    },

    // Fast Getters
    getProducts: () => memoryCache.products,
    getClients: () => memoryCache.clients,
    getSetting: (key) => memoryCache.settings[key],
    getAllSettings: () => memoryCache.settings,

    // Manual Refresh
    refreshTable: async (table) => {
        try {
            const { data } = await supabase.from(table).select('*');
            if (data) {
                memoryCache[table] = data;
                await LocalDbService.saveItems(table, data);
            }
        } catch (e) {
            console.error(`[GlobalDataService] Refresh error for ${table}:`, e);
        }
    }
};

