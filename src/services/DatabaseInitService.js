import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const DatabaseInitService = {
    /**
     * Runs schema synchronization.
     * It uses a master RPC function to ensure all columns and stored procedures exist.
     * Only runs once per app version or when forced.
     */
    init: async (force = false) => {
        try {
            const lastInit = await AsyncStorage.getItem('db_last_init');
            const currentVersion = '1.0.3'; // Increment this when schema changes

            if (lastInit === currentVersion && !force) {
                console.log('Database schema already up to date.');
                return;
            }

            console.log('Synchronizing database schema...');

            // Call the master initialization function
            // Note: This function must be created first in Supabase SQL editor
            const { data, error } = await supabase.rpc('initialize_app_schema');

            if (error) {
                if (error.message.includes('function "initialize_app_schema" does not exist')) {
                    console.warn('⚠️ Master init function not found in Supabase. Please run the SQL migration manually first.');
                } else {
                    console.error('Database Sync Error:', error);
                }
                return;
            }

            console.log('✅ Database Sync Success:', data);
            await AsyncStorage.setItem('db_last_init', currentVersion);
        } catch (err) {
            console.error('Failed to init database:', err);
        }
    }
};
