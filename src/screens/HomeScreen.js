import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Dimensions, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { NotificationService } from '../services/notificationService';
import { SyncService } from '../services/syncService';
import NetInfo from '@react-native-community/netinfo';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const [userRole, setUserRole] = useState('seller');
    const [stats, setStats] = useState({
        todaySales: 0,
        budgetSales: 0,
        debtSupplier: 0,
        netProfit: 0,
        lowStockCount: 0
    });
    const [loading, setLoading] = useState(false);

    // Camera State
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setUserRole(role);
        });
        NotificationService.requestPermissions();

        // Initial sync attempt
        SyncService.syncPending();

        // Listen for reconnect
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected) {
                SyncService.syncPending().then(success => {
                    if (success) {
                        fetchDashboardStats(); // Refresh stats after sync
                    }
                });
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

            const { data: sales } = await supabase
                .from('sales')
                .select('total_amount, profit_generated, commission_amount, status')
                .gte('created_at', startOfDay);

            let todaySales = 0;
            let grossProfit = 0;
            let commissions = 0;

            if (sales) {
                sales.forEach(s => {
                    const status = (s.status || '').toLowerCase();
                    if (status === 'completed' || status === 'exitosa' || status === '') {
                        todaySales += (s.total_amount || 0);
                        grossProfit += (s.profit_generated || 0);
                        commissions += (s.commission_amount || 0);
                    }
                });
            }

            const { data: expenses } = await supabase.from('expenses').select('amount').gte('created_at', startOfDay);
            const totalExpenses = expenses ? expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) : 0;
            const { data: budgets } = await supabase.from('sales').select('total_amount').eq('status', 'budget');
            const { data: lowStock } = await supabase.from('products').select('id').eq('active', true).lte('current_stock', 5);

            setStats({
                todaySales,
                budgetSales: budgets ? budgets.reduce((acc, s) => acc + (s.total_amount || 0), 0) : 0,
                netProfit: grossProfit - commissions - totalExpenses,
                lowStockCount: lowStock ? lowStock.length : 0
            });
        } catch (error) {
            console.log('Stats error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAICounsel = () => {
        if (loading) return "Consultando al Oráculo...";
        if (stats.lowStockCount > 3) return "⚠️ Stock crítico detectado. Reabastece pronto.";
        if (stats.budgetSales > 0) return `💡 Tienes $${stats.budgetSales} en presupuestos pendientes.`;
        return "Buen trabajo, Comandante. El imperio crece.";
    };

    useFocusEffect(useCallback(() => { fetchDashboardStats(); }, []));

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned) return;

        let barcodeData = data;
        // SMART QR HANDLE
        if (data.includes('linktr.ee/digital_boost_empire')) {
            const parts = data.split('barcode=');
            if (parts.length > 1) barcodeData = parts[1];
        }

        setScanned(true);
        setIsScanning(false);
        try {
            const { data: product } = await supabase.from('products').select('*').eq('barcode', barcodeData).single();
            if (product) {
                navigation.navigate('NewSale', { preselectedProduct: product });
            } else {
                navigation.navigate('AddProduct', { scannedBarcode: barcodeData });
            }
        } catch (err) {
            navigation.navigate('AddProduct', { scannedBarcode: barcodeData });
        } finally {
            setScanned(false);
        }
    };

    const MinimalModule = ({ title, icon, color, isNew, onPress }) => (
        <TouchableOpacity style={styles.miniCard} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.miniIcon, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.miniTitle}>{title}</Text>
            {isNew && <View style={styles.miniBadge} />}
        </TouchableOpacity>
    );

    if (isScanning) {
        return (
            <View style={styles.scannerFull}>
                <CameraView style={StyleSheet.absoluteFillObject} onBarcodeScanned={scanned ? undefined : handleBarcodeScanned} />
                <TouchableOpacity style={styles.closeBtn} onPress={() => setIsScanning(false)}>
                    <MaterialCommunityIcons name="close-circle" size={50} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#121212']} style={styles.background} />

            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.brandName}>EMPIRE 👑</Text>
                        <Text style={styles.headerRole}>{userRole === 'admin' ? 'Líder Supremo' : 'Aliado'}</Text>
                    </View>
                    <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('user_role'); navigation.replace('Login'); }}>
                        <MaterialCommunityIcons name="logout-variant" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Minimal Insight */}
                    <View style={styles.insightBox}>
                        <LinearGradient colors={['rgba(212,175,55,0.1)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.insightGrad} />
                        <MaterialCommunityIcons name="lightning-bolt" size={18} color="#d4af37" />
                        <Text style={styles.insightText}>{getAICounsel()}</Text>
                    </View>

                    {/* Stats Bricks Clean */}
                    <View style={styles.statsGrid}>
                        <View style={styles.statBrick}>
                            <Text style={styles.statLab}>Ventas Hoy</Text>
                            <Text style={styles.statVal}>${stats.todaySales}</Text>
                        </View>
                        <View style={styles.statBrick}>
                            <Text style={styles.statLab}>Balance Neto</Text>
                            <Text style={[styles.statVal, { color: stats.netProfit >= 0 ? '#00ff88' : '#ff4444' }]}>
                                ${stats.netProfit}
                            </Text>
                        </View>
                    </View>

                    {/* Minimalist Grid of Actions */}
                    <Text style={styles.sectionLabel}>MÓDULOS DEL IMPERIO</Text>
                    <View style={styles.actionGrid}>
                        <MinimalModule title="Plan IA" icon="robot-happy" color="#3498db" isNew onPress={() => Alert.alert('Empire AI Coach', getAICounsel())} />
                        <MinimalModule title="Catálogo" icon="cellphone-link" color="#00ff88" onPress={() => navigation.navigate('Catalog')} />
                        <MinimalModule title="Clientes" icon="account-group" color="#9b59b6" onPress={() => navigation.navigate('Clients')} />
                        <MinimalModule title="Historial" icon="history" color="#bdc3c7" onPress={() => navigation.navigate('Sales')} />
                        <MinimalModule title="Presupuesto" icon="file-document-edit" color="#e67e22" onPress={() => navigation.navigate('NewSale', { mode: 'quote' })} />
                        <MinimalModule title="Reportes" icon="chart-bar" color="#f1c40f" onPress={() => navigation.navigate('Reports')} />
                    </View>

                    {/* Primary Action: Minimalist Giant Scanner */}
                    <View style={styles.scannerCenter}>
                        <TouchableOpacity style={styles.scannerTap} onPress={() => setIsScanning(true)}>
                            <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.scannerCircle}>
                                <MaterialCommunityIcons name="barcode-scan" size={45} color="#000" />
                                <Text style={styles.scannerLabel}>ESCANEAR PRODUCTO</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    background: { ...StyleSheet.absoluteFillObject },
    safe: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 20 },
    brandName: { color: '#d4af37', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
    headerRole: { color: '#666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

    scroll: { paddingBottom: 120 },

    insightBox: { marginHorizontal: 25, flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', overflow: 'hidden' },
    insightGrad: { ...StyleSheet.absoluteFillObject },
    insightText: { color: '#bbb', fontSize: 13, fontWeight: '600', marginLeft: 10 },

    statsGrid: { flexDirection: 'row', gap: 12, paddingHorizontal: 25, marginTop: 20 },
    statBrick: { flex: 1, backgroundColor: '#0a0a0a', padding: 18, borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a' },
    statLab: { color: '#555', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    statVal: { color: '#fff', fontSize: 18, fontWeight: '900', marginTop: 6 },

    sectionLabel: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 2, paddingHorizontal: 25, marginTop: 30, marginBottom: 15 },

    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
    miniCard: { width: (width - 60) / 3, backgroundColor: '#0a0a0a', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
    miniIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginBottom: 10 },
    miniTitle: { color: '#888', fontSize: 10, fontWeight: '800' },
    miniBadge: { position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: '#d4af37' },

    scannerCenter: { alignItems: 'center', marginTop: 40 },
    scannerTap: { width: 180, height: 180, borderRadius: 90, elevation: 20, shadowColor: '#d4af37', shadowOpacity: 0.3, shadowRadius: 20 },
    scannerCircle: { flex: 1, borderRadius: 90, justifyContent: 'center', alignItems: 'center', padding: 20 },
    scannerLabel: { color: '#000', fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 10, letterSpacing: 1 },

    scannerFull: { flex: 1, backgroundColor: '#000' },
    closeBtn: { position: 'absolute', top: 50, right: 30 }
});
