import * as Device from 'expo-device';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { LocalDbService } from './localDbService';
import { supabase } from './supabase';

export const DeviceAuthService = {
    getDeviceSignature: async () => {
        if (Platform.OS === 'web') return 'web-client';
        const deviceId = Platform.OS === 'android' 
            ? Application.androidId 
            : await Application.getIosIdForVendorAsync();
        return `${Device.modelName}-${deviceId}`;
    },

    checkAuthorization: async () => {
        try {
            const signature = await DeviceAuthService.getDeviceSignature();
            
            // 1. INTENTO LOCAL PRIMERO (Para que sea instantáneo y offline)
            const localDevices = await LocalDbService.getAll('authorized_devices');
            const localMatch = localDevices.find(d => d.device_signature === signature && d.is_active);
            
            if (localMatch) {
                console.log('[Auth] Authorized via local DB:', localMatch.role);
                return { isAuthorized: true, role: localMatch.role, device: localMatch };
            }

            // 2. SI NO ESTÁ LOCAL, SOLO AHÍ BUSCO EN SUPABASE (Requiere internet)
            const { data, error } = await supabase
                .from('authorized_devices')
                .select('*')
                .eq('device_signature', signature)
                .eq('is_active', true)
                .single();

            if (data) {
                // Guardar localmente para la próxima vez
                await LocalDbService.saveItem('authorized_devices', data);
                return { isAuthorized: true, role: data.role, device: data };
            }

            return { isAuthorized: false, role: null };
        } catch (e) {
            console.warn('[Auth] Check failed:', e.message);
            return { isAuthorized: false, role: null };
        }
    }
};
