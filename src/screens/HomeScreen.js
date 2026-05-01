import React, { useEffect, useState } from 'react';
import { View, StyleSheet, StatusBar, ActivityIndicator } from 'react-native';
import { useAuthStore } from '../store/useAuthStore';
import { DeviceAuthService } from '../services/deviceAuthService';
import { LocalDbService } from '../services/localDbService';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';

export default function HomeScreen({ navigation }) {
    const { login } = useAuthStore();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const runAuthFlow = async () => {
            try {
                // 1. Inicializar DB y Stores de forma ultrarrápida
                await LocalDbService.init();
                await Promise.all([
                    useFinanceStore.getState().initStore(),
                    useProductStore.getState().initStore()
                ]);

                // 2. Verificación silenciosa
                const auth = await DeviceAuthService.checkAuthorization();
                
                if (auth.isAuthorized) {
                    login(auth.role, auth.device);
                    if (auth.role === 'leader' || auth.role === 'admin') {
                        navigation.replace('Admin');
                        return;
                    }
                    navigation.replace('Main');
                    return;
                }
                
                // Si no está autorizado, lo dejamos en el dashboard (pero ya no debería pasar si es su dispositivo)
                navigation.replace('Dashboard'); 
            } catch (err) {
                navigation.replace('Dashboard');
            } finally {
                setIsChecking(false);
            }
        };

        runAuthFlow();
    }, []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ActivityIndicator size="large" color="#d4af37" />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }
});
