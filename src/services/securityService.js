import { supabase } from './supabase';
import { DeviceAuthService } from './deviceAuth';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SecurityService = {
    /**
     * Logs a sensitive action performed by a user or device.
     * @param {string} action - Short code for the action (e.g., 'DELETE_PRODUCT', 'EDIT_PRICE')
     * @param {string} details - Human-readable description of what happened
     * @param {object} metadata - Optional JSON object with extra data (e.g., old_price, new_price)
     */
    logActivity: async (action, details, metadata = {}) => {
        try {
            const deviceSig = await DeviceAuthService.getDeviceSignature();
            const userRole = await AsyncStorage.getItem('user_role') || 'unknown';

            // Await the insert and check for errors
            const { error } = await supabase.from('activity_logs').insert({
                action_type: action,
                description: details,
                metadata: metadata,
                device_sig: deviceSig,
                user_role: userRole,
                created_at: new Date().toISOString()
            });

            if (error) throw error;
            return true;

        } catch (err) {
            console.log('Error logging security event:', err);
            throw err; // Re-throw so caller knows it failed
        }
    },

    /**
     * Fetches the activity log for the admin dashboard.
     */
    getLogs: async (limit = 50) => {
        const { data, error } = await supabase
            .from('activity_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data;
    }
};
