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
                { data: promotions },
                { data: sales },
                { data: supplierOrders },
                { data: supplierOrderItems },
                { data: saleItems },
                { data: reminders }
            ] = await Promise.all([
                supabase.from('products').select('*').order('name'),
                supabase.from('clients').select('*').order('name'),
                supabase.from('settings').select('*'),
                supabase.from('expenses').select('*').order('created_at', { ascending: false }),
                supabase.from('suppliers').select('*').order('name'),
                supabase.from('promotions').select('*').eq('active', true),
                supabase.from('sales').select('*').order('created_at', { ascending: false }),
                supabase.from('supplier_orders').select('*').order('created_at', { ascending: false }),
                supabase.from('supplier_order_items').select('*'),
                supabase.from('sale_items').select('*'),
                supabase.from('reminders').select('*').order('due_date', { ascending: true })
            ]);

            // 3. Update memory cache and SQLite
            if (products) {
                memoryCache.products = products;
                await LocalDbService.replaceFullTable('products', products);
            }
            if (clients) {
                memoryCache.clients = clients;
                await LocalDbService.replaceFullTable('clients', clients);
            }
            if (settings && Array.isArray(settings)) {
                const settingsMap = {};
                settings.forEach(s => {
                    if (s && s.key) settingsMap[s.key] = s.value;
                });
                memoryCache.settings = settingsMap;
                await LocalDbService.replaceFullTable('settings', settings);
            }
            if (expenses) await LocalDbService.replaceFullTable('expenses', expenses);
            if (suppliers) await LocalDbService.replaceFullTable('suppliers', suppliers);
            if (sales) await LocalDbService.replaceFullTable('sales', sales);
            if (supplierOrders) await LocalDbService.replaceFullTable('supplier_orders', supplierOrders);
            if (supplierOrderItems) await LocalDbService.replaceFullTable('supplier_order_items', supplierOrderItems);
            if (saleItems) await LocalDbService.replaceFullTable('sale_items', saleItems);
            if (reminders) await LocalDbService.replaceFullTable('reminders', reminders);
            if (promotions) {
                memoryCache.promotions = promotions;
                await LocalDbService.replaceFullTable('promotions', promotions);
            }

            console.log('[GlobalDataService] Database synced to SQLite successfully with 0 ghost rows.');
            return true;
        } catch (error) {
            console.error('[GlobalDataService] Preload error:', error);
            return false;
        }
    },

    loadFromSQLite: async () => {
        try {
            const [products, clients, settings, promotions] = await Promise.all([
                LocalDbService.getAll('products'),
                LocalDbService.getAll('clients'),
                LocalDbService.getAll('settings'),
                LocalDbService.getAll('promotions')
            ]);

            if (products) memoryCache.products = products;
            if (clients) memoryCache.clients = clients;
            if (promotions) memoryCache.promotions = promotions;
            
            if (settings && Array.isArray(settings)) {
                const settingsMap = {};
                settings.forEach(s => {
                    if (s && s.key) settingsMap[s.key] = s.value;
                });
                memoryCache.settings = settingsMap;
            }
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

