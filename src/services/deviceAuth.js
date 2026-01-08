import * as Device from 'expo-device';
import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service to handle hardware-based authentication.
 * It identifies the device physical hardware ID and checks it against 
 * pre-authorized signatures in the database.
 */

const SALT = 'DigitalBoostEmpire_2024_SecuritySalt'; // Shared salt for hashing

export const DeviceAuthService = {
    /**
     * Obtains the unique hardware ID from the device.
     */
    getRawDeviceId: async () => {
        try {
            let id = null;

            if (Platform.OS === 'android') {
                id = Application.androidId;
            } else if (Platform.OS === 'ios') {
                id = await Application.getIosIdForVendorAsync();
            }

            // Fallback 1: Device Build ID (often available in Expo Go)
            if (!id || id === 'null') {
                id = Device.osBuildId;
            }

            // Fallback 2: Composite ID based on hardware (extremely robust)
            if (!id || id === 'null') {
                id = `HW-${Device.manufacturer}-${Device.modelName}-${Device.totalMemory}-${Device.osInternalBuildId || 'V1'}`;
            }

            console.log('Final Device ID Source found:', id ? 'YES' : 'NO');
            return id;
        } catch (e) {
            console.error('Error getting hardware ID:', e);
            return null;
        }
    },

    getDeviceSignature: async () => {
        const rawId = await DeviceAuthService.getRawDeviceId();
        if (!rawId) return null;

        // Combine ID with Salt and Hash it (SHA-256)
        const hash = await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            rawId + SALT
        );

        // Format to human-readable (promised format: X78Y-Z21)
        // Taking first 8 chars: XXXX-XXXX
        const clean = hash.toUpperCase().replace(/[^A-Z0-0]/g, '');
        const part1 = clean.substring(0, 4);
        const part2 = clean.substring(4, 8);
        return `${part1}-${part2}`;
    },

    /**
     * Checks if this device is authorized and returns its assigned role.
     */
    checkAuthorization: async () => {
        const signature = await DeviceAuthService.getDeviceSignature();
        if (!signature) return null;

        try {
            const { data, error } = await supabase
                .from('authorized_devices')
                .select('role')
                .eq('device_signature', signature)
                .single();

            if (error || !data) return null;

            // Save role locally as well for offline/fast access
            await AsyncStorage.setItem('user_role', data.role);
            return data.role;
        } catch (e) {
            console.error('Error checking device authorization:', e);
            return null;
        }
    },

    /**
     * For Debugging: Gets the signature to manually register it in SQL.
     */
    getDebugInfo: async () => {
        const raw = await DeviceAuthService.getRawDeviceId();
        const sig = await DeviceAuthService.getDeviceSignature();
        const name = `${Device.manufacturer || ''} ${Device.modelName || 'Device'} (${Platform.OS})`;
        const details = `Model: ${Device.modelName}, Brand: ${Device.brand}, OS: ${Device.osName}`;
        return { raw, sig, name, details };
    }
};
