import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const CACHE_KEYS = {
    PRODUCTS: '@cache_products',
    CLIENTS: '@cache_clients',
    PROFILES: '@cache_profiles',
    PROMOTIONS: '@cache_promotions',
    SETTINGS: '@cache_settings'
};

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
     * Downloads ALL essential data from Supabase and caches it locally.
     * This improves app fluidity by avoiding constant network requests.
     */
    preloadAll: async () => {
        console.log('[GlobalDataService] Starting full database download...');
        try {
            // 1. Load from AsyncStorage first (instant start)
            await GlobalDataService.loadFromStorage();

            // 2. Fetch fresh data from Supabase in parallel
            const [
                { data: products },
                { data: clients },
                { data: profiles },
                { data: promotions },
                { data: settings }
            ] = await Promise.all([
                supabase.from('products').select('*').eq('active', true).order('name'),
                supabase.from('clients').select('*').order('name'),
                supabase.from('profiles').select('*'),
                supabase.from('promotions').select('*, promotion_products(*)').eq('active', true),
                supabase.from('settings').select('*')
            ]);

            // 3. Update memory cache
            if (products) memoryCache.products = products;
            if (clients) memoryCache.clients = clients;
            if (profiles) memoryCache.profiles = profiles;
            if (promotions) memoryCache.promotions = promotions;
            if (settings) {
                const settingsMap = {};
                settings.forEach(s => settingsMap[s.key] = s.value);
                memoryCache.settings = settingsMap;
            }

            // 4. Persistence
            await GlobalDataService.saveToStorage();
            console.log('[GlobalDataService] Database synced successfully.');
            return true;
        } catch (error) {
            console.error('[GlobalDataService] Preload error:', error);
            return false;
        }
    },

    loadFromStorage: async () => {
        try {
            const keys = Object.values(CACHE_KEYS);
            const stores = await AsyncStorage.multiGet(keys);
            stores.forEach(([key, value]) => {
                if (value) {
                    const parsed = JSON.parse(value);
                    if (key === CACHE_KEYS.PRODUCTS) memoryCache.products = parsed;
                    if (key === CACHE_KEYS.CLIENTS) memoryCache.clients = parsed;
                    if (key === CACHE_KEYS.PROFILES) memoryCache.profiles = parsed;
                    if (key === CACHE_KEYS.PROMOTIONS) memoryCache.promotions = parsed;
                    if (key === CACHE_KEYS.SETTINGS) memoryCache.settings = parsed;
                }
            });
        } catch (e) {
            console.error('[GlobalDataService] Load from storage error:', e);
        }
    },

    saveToStorage: async () => {
        try {
            const pairs = [
                [CACHE_KEYS.PRODUCTS, JSON.stringify(memoryCache.products)],
                [CACHE_KEYS.CLIENTS, JSON.stringify(memoryCache.clients)],
                [CACHE_KEYS.PROFILES, JSON.stringify(memoryCache.profiles)],
                [CACHE_KEYS.PROMOTIONS, JSON.stringify(memoryCache.promotions)],
                [CACHE_KEYS.SETTINGS, JSON.stringify(memoryCache.settings)]
            ];
            await AsyncStorage.multiSet(pairs);
        } catch (e) {
            console.error('[GlobalDataService] Save to storage error:', e);
        }
    },

    // Fast Getters
    getProducts: () => memoryCache.products,
    getClients: () => memoryCache.clients,
    getProfiles: () => memoryCache.profiles,
    getPromotions: () => memoryCache.promotions,
    getSetting: (key) => memoryCache.settings[key],
    getAllSettings: () => memoryCache.settings,

    // Manual Refresh
    refreshTable: async (table) => {
        try {
            const { data } = await supabase.from(table).select('*');
            if (data) {
                memoryCache[table] = data;
                await AsyncStorage.setItem(`@cache_${table}`, JSON.stringify(data));
            }
        } catch (e) {
            console.error(`[GlobalDataService] Refresh error for ${table}:`, e);
        }
    }
};
