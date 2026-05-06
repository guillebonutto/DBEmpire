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
                { data: settings },
                { data: expenses },
                { data: suppliers },
                { data: promotions }
            ] = await Promise.all([
                supabase.from('products').select('*').eq('active', true).order('name'),
                supabase.from('clients').select('*').order('name'),
                supabase.from('settings').select('*'),
                supabase.from('expenses').select('*').order('created_at', { ascending: false }).limit(200),
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('promotions').select('*').eq('active', true)
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
            if (settings && Array.isArray(settings)) {
                const settingsMap = {};
                settings.forEach(s => {
                    if (s && s.key) settingsMap[s.key] = s.value;
                });
                memoryCache.settings = settingsMap;
                await LocalDbService.saveItems('settings', settings);
            }
            if (expenses) await LocalDbService.saveItems('expenses', expenses);
            if (suppliers) await LocalDbService.saveItems('suppliers', suppliers);
            if (promotions) memoryCache.promotions = promotions;

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
            
            if (settings && Array.isArray(settings)) {
                const settingsMap = {};
                settings.forEach(s => {
                    if (s && s.key) settingsMap[s.key] = s.value;
                });
                memoryCache.settings = settingsMap;
            }
            // Note: expenses and suppliers are primarily used through their own stores
            // But we ensure the DB is initialized.
        } catch (e) {
            console.error('[GlobalDataService] Load from SQLite error:', e);
        }
    },

    // Fast Getters
    getProducts: () => memoryCache.products,
    getClients: () => memoryCache.clients,
    getPromotions: () => memoryCache.promotions || [],
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

