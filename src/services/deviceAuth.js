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
     * SQLite-first: instant offline response, no network hang.
     */
    checkAuthorization: async () => {
        const signature = await DeviceAuthService.getDeviceSignature();
        if (!signature) return null;

        const { LocalDbService } = require('./localDbService');

        // 1. Check SQLite FIRST — instant, works offline
        try {
            const localDevices = await LocalDbService.getAll('authorized_devices');
            const localDevice = localDevices.find(d => d.device_signature === signature && (d.is_active === 1 || d.is_active === true));
            if (localDevice) {
                console.log('[Auth] Authorized via SQLite:', localDevice.role);
                await AsyncStorage.setItem('user_role', localDevice.role);
                // Background-refresh from Supabase without blocking
                DeviceAuthService.refreshAuthFromServer(signature, localDevice, LocalDbService).catch(() => {});
                return localDevice.role;
            }
        } catch (e) {
            console.warn('[Auth] SQLite check failed:', e.message);
        }

        // 2. Not in SQLite? Try Supabase with a timeout
        try {
            const timeout = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('timeout')), 5000)
            );
            const fetchPromise = supabase
                .from('authorized_devices')
                .select('*')
                .eq('device_signature', signature)
                .eq('is_active', true)
                .limit(1);

            const { data, error } = await Promise.race([fetchPromise, timeout]);

            if (!error && data && data.length > 0) {
                const device = data[0];
                await LocalDbService.saveItem('authorized_devices', {
                    id: device.id,
                    device_signature: signature,
                    role: device.role,
                    is_active: 1
                });
                await AsyncStorage.setItem('user_role', device.role);
                return device.role;
            }
        } catch (e) {
            console.warn('[Auth] Supabase check failed or timed out:', e.message);
        }

        return null;
    },

    refreshAuthFromServer: async (signature, localDevice, LocalDbService) => {
        try {
            const { data, error } = await supabase
                .from('authorized_devices')
                .select('*')
                .eq('device_signature', signature)
                .limit(1);
            if (!error && data && data.length > 0) {
                const device = data[0];
                await LocalDbService.saveItem('authorized_devices', {
                    id: device.id,
                    device_signature: signature,
                    role: device.role,
                    is_active: device.is_active ? 1 : 0
                });
            }
        } catch {}
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
