import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
    View, Text, StyleSheet, ScrollView, TouchableOpacity, 
    StatusBar, Alert, RefreshControl 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useFinanceStore } from '../store/useFinanceStore';
import { useAuthStore } from '../store/useAuthStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { OtaUpdateService } from '../services/OtaUpdateService';

const fmt = (n) => `$${Math.abs(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

export default function ProfileScreen({ navigation }) {
    const { sales, fetchAllData, isLoading } = useFinanceStore();
    const { userRole, userName } = useAuthStore();
    const [refreshing, setRefreshing] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchAllData(); 
        }, [fetchAllData])
    );

    const stats = useMemo(() => {
        const totalSales = sales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
        const totalProfit = sales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);
        const avgSale = sales.length > 0 ? totalSales / sales.length : 0;
        
        return { totalSales, totalProfit, avgSale };
    }, [sales]);

    const handleLogout = async () => {
        Alert.alert(
            "Cerrar Sesión",
            "¿Estás seguro de que quieres salir?",
            [
                { text: "Cancelar", style: "cancel" },
                { 
                    text: "Salir", 
                    style: "destructive", 
                    onPress: async () => {
                        await AsyncStorage.clear();
                        navigation.replace('Login', { fromLogout: true });
                    } 
                }
            ]
        );
    };

    const handleCheckForUpdates = () => {
        OtaUpdateService.checkAndPromptManual();
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerLabel}>LOGÍSTICA DEL IMPERIO</Text>
                    <Text style={styles.title}>CONFIGURACIÓN</Text>
                </View>
                <TouchableOpacity style={styles.headerBtn}>
                    <MaterialCommunityIcons name="cog-outline" size={24} color="#d4af37" />
                </TouchableOpacity>
            </View>

            <ScrollView 
                style={styles.scroll} 
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => fetchAllData(true)} tintColor="#d4af37" />}
            >
                {/* Profile Card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarLarge}>
                        <MaterialCommunityIcons name="account" size={50} color="#d4af37" />
                        <View style={styles.onlineDot} />
                    </View>
                    <View style={styles.profileInfo}>
                        <Text style={styles.userName}>{userName || 'Elite Member'}</Text>
                        <View style={styles.roleRow}>
                            <View style={styles.roleBadge}>
                                <Text style={styles.roleText}>{(userRole || 'Magnate').toUpperCase()}</Text>
                            </View>
                            <Text style={styles.dateText}>{new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}</Text>
                        </View>
                    </View>
                </View>

                {/* Commission Stats Card */}
                <View style={styles.statsCard}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.cardTitle}>Comisiones de Hoy</Text>
                        <MaterialCommunityIcons name="chart-line" size={20} color="#2ecc71" />
                    </View>
                    <View style={styles.chartContainer}>
                        <View style={styles.chartBarBackground}>
                            <View style={[styles.chartBarFill, { width: '65%' }]} />
                        </View>
                        <View style={styles.chartLabels}>
                            <Text style={styles.chartValue}>$42,500 / $60,000</Text>
                            <Text style={styles.chartPercent}>65% de la meta</Text>
                        </View>
                    </View>
                </View>

                {/* Performance Metrics */}
                <View style={styles.metricsList}>
                    <MetricItem 
                        icon="cash-multiple" 
                        label="Ventas Totales" 
                        value={fmt(stats.totalSales)} 
                        color="#d4af37"
                    />
                    <MetricItem 
                        icon="trending-up" 
                        label="Margen Acumulado" 
                        value={fmt(stats.totalProfit)} 
                        color="#2ecc71"
                    />
                    <MetricItem 
                        icon="calculator" 
                        label="Ticket Promedio" 
                        value={fmt(stats.avgSale)} 
                        color="#3498db"
                    />
                    <MetricItem 
                        icon="shield-check" 
                        label="Estado de Cuenta" 
                        value="Activo" 
                        color="#9b59b6"
                    />
                </View>

                {/* Settings Menu */}
                <Text style={styles.sectionTitle}>AJUSTES DEL SISTEMA</Text>
                <View style={styles.menu}>
                    <MenuItem icon="security" label="Seguridad y Privacidad" />
                    <MenuItem icon="headphones" label="Soporte y Ayuda" />
                    <MenuItem icon="bell-ring" label="Notificaciones Empire" />
                    <MenuItem icon="database-sync" label="Sincronización Cloud" />
                    <MenuItem icon="cellphone-arrow-down" label="Buscar Actualizaciones" onPress={handleCheckForUpdates} />
                    <MenuItem 
                        icon="logout" 
                        label="Cerrar Sesión" 
                        isDestructive 
                        onPress={handleLogout}
                    />
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function MetricItem({ icon, label, value, color }) {
    return (
        <View style={styles.metricItem}>
            <View style={[styles.miniIconBox, { backgroundColor: `${color}15` }]}>
                <MaterialCommunityIcons name={icon} size={18} color={color} />
            </View>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricValue}>{value}</Text>
        </View>
    );
}

function MenuItem({ icon, label, isDestructive, onPress }) {
    return (
        <TouchableOpacity style={styles.menuItem} onPress={onPress}>
            <MaterialCommunityIcons name={icon} size={22} color={isDestructive ? '#e74c3c' : '#d4af37'} />
            <Text style={[styles.menuLabel, isDestructive && { color: '#e74c3c' }]}>{label}</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#333" />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 15 },
    headerLabel: { color: '#222', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    title: { fontSize: 24, fontWeight: '900', color: '#d4af37', letterSpacing: 1 },
    headerBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0d0d0d', borderWidth: 1, borderColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20 },

    profileCard: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#0d0d0d', 
        padding: 20, 
        borderRadius: 20, 
        marginBottom: 20, 
        borderWidth: 1, 
        borderColor: '#1a1a1a' 
    },
    avatarLarge: { 
        width: 80, 
        height: 80, 
        borderRadius: 40, 
        backgroundColor: '#111', 
        justifyContent: 'center', 
        alignItems: 'center', 
        borderWidth: 2, 
        borderColor: '#d4af37' 
    },
    onlineDot: { 
        position: 'absolute', 
        bottom: 5, 
        right: 5, 
        width: 14, 
        height: 14, 
        borderRadius: 7, 
        backgroundColor: '#2ecc71', 
        borderWidth: 2, 
        borderColor: '#0d0d0d' 
    },
    profileInfo: { marginLeft: 20 },
    userName: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
    roleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 10 },
    roleBadge: { backgroundColor: '#d4af3720', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    roleText: { color: '#d4af37', fontSize: 10, fontWeight: '900' },
    dateText: { color: '#444', fontSize: 12 },

    statsCard: { 
        backgroundColor: '#0d0d0d', 
        padding: 20, 
        borderRadius: 20, 
        marginBottom: 20, 
        borderWidth: 1, 
        borderColor: '#1a1a1a' 
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    cardTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    chartContainer: { marginTop: 10 },
    chartBarBackground: { height: 8, backgroundColor: '#111', borderRadius: 4, overflow: 'hidden' },
    chartBarFill: { height: '100%', backgroundColor: '#2ecc71', borderRadius: 4 },
    chartLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    chartValue: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    chartPercent: { color: '#444', fontSize: 11 },

    metricsList: { marginBottom: 30 },
    metricItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        backgroundColor: '#0d0d0d', 
        padding: 15, 
        borderRadius: 15, 
        marginBottom: 10, 
        borderWidth: 1, 
        borderColor: '#1a1a1a' 
    },
    miniIconBox: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    metricLabel: { flex: 1, color: '#666', fontSize: 13, fontWeight: '600' },
    metricValue: { color: '#fff', fontSize: 15, fontWeight: 'bold' },

    sectionTitle: { color: '#222', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
    menu: { backgroundColor: '#0d0d0d', borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#1a1a1a' },
    menuItem: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 18, 
        borderBottomWidth: 1, 
        borderBottomColor: '#1a1a1a' 
    },
    menuLabel: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '600', marginLeft: 15 }
});
