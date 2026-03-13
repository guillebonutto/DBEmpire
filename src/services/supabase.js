
import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

// 🔐 PREMIUM HYBRID STORAGE:
// - Android/iOS → expo-secure-store (Android Keystore / iOS Keychain, hardware-level encryption)
// - Web         → localStorage (SecureStore is native-only and crashes on web)
//
// Uses lazy require() so the web bundler NEVER loads expo-secure-store,
// preventing the "getValueWithKeyAsync is not a function" crash.
const buildStorage = () => {
    if (Platform.OS === 'web') {
        return {
            getItem: (key) => {
                try { return Promise.resolve(localStorage.getItem(key)); }
                catch { return Promise.resolve(null); }
            },
            setItem: (key, value) => {
                try { localStorage.setItem(key, value); } catch {}
                return Promise.resolve();
            },
            removeItem: (key) => {
                try { localStorage.removeItem(key); } catch {}
                return Promise.resolve();
            },
        };
    }

    // Native only — lazy require so web bundler never touches this
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const SecureStore = require('expo-secure-store');
    return {
        getItem: (key) => SecureStore.getItemAsync(key),
        setItem: (key, value) => SecureStore.setItemAsync(key, value),
        removeItem: (key) => SecureStore.deleteItemAsync(key),
    };
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        storage: buildStorage(),
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
});
