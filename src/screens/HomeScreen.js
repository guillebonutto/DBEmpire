import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, RefreshControl, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';

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
    }, []);

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);
        setIsScanning(false);

        try {
            // 1. Check local DB
            const { data: product, error } = await supabase
                .from('products')
                .select('*')
                .eq('barcode', data)
                .single();

            if (product) {
                navigation.navigate('NewSale', { preselectedProduct: product });
            } else {
                // 2. Not found locally, fetch from Open Food Facts
                let scannedName = '';
                let scannedDescription = '';
                let scannedImage = null;

                try {
                    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
                    const json = await response.json();
                    if (json.status === 1) {
                        const product = json.product;
                        scannedName = product.product_name || '';
                        scannedDescription = product.generic_name || product.product_name || '';
                        scannedImage = product.image_url ||
                            product.image_front_url ||
                            product.selected_images?.front?.display?.es ||
                            product.selected_images?.front?.display?.en ||
                            null;
                    }
                } catch (e) {
                    console.log("Error fetching from external API:", e);
                }

                navigation.navigate('AddProduct', {
                    scannedBarcode: data,
                    scannedName: scannedName,
                    scannedDescription: scannedDescription,
                    scannedImage: scannedImage
                });
            }
        } catch (err) {
            console.log("Error searching product:", err);
            navigation.navigate('AddProduct', { scannedBarcode: data });
        } finally {
            setScanned(false);
        }
    };

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

            // 1. Fetch Today's Sales & Profit
            const { data: sales } = await supabase
                .from('sales')
                .select('total_amount, profit_generated, commission_amount, status')
                .gte('created_at', startOfDay);

            let todaySales = 0;
            let grossProfit = 0;
            let commissions = 0;

            if (sales) {
                sales.forEach(s => {
                    if (s.status === 'completed') {
                        todaySales += (s.total_amount || 0);
                        grossProfit += (s.profit_generated || 0);
                        commissions += (s.commission_amount || 0);
                    }
                });
            }

            // 2. Fetch Expenses for today
            const { data: expenses } = await supabase
                .from('expenses')
                .select('amount')
                .gte('created_at', startOfDay);

            const totalExpenses = expenses ? expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) : 0;

            // 3. Fetch Budgets (Total pending)
            const { data: allBudgets } = await supabase
                .from('sales')
                .select('total_amount')
                .eq('status', 'budget');

            const totalBudgets = allBudgets ? allBudgets.reduce((acc, s) => acc + (s.total_amount || 0), 0) : 0;

            // 4. Fetch Debts (Supplier orders not received)
            const { data: pendingOrders } = await supabase
                .from('supplier_orders')
                .select('total_cost')
                .neq('status', 'received');

            const totalDebts = pendingOrders ? pendingOrders.reduce((acc, order) => acc + (parseFloat(order.total_cost) || 0), 0) : 0;

            // 5. Fetch Low Stock Count
            const { data: lowStockItems, error: lsError } = await supabase
                .from('products')
                .select('id')
                .eq('active', true)
                .lte('current_stock', 5);

            const lowStockCount = lowStockItems ? lowStockItems.length : 0;

            setStats({
                todaySales,
                budgetSales: totalBudgets,
                debtSupplier: totalDebts,
                netProfit: grossProfit - commissions - totalExpenses,
                lowStockCount
            });

        } catch (error) {
            console.log('Error fetching dashboard stats:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchDashboardStats();
        }, [])
    );

    // Compact Nav Item Component
    const CompactNavItem = ({ title, icon, color, onPress }) => (
        <TouchableOpacity style={styles.compactNavItem} onPress={onPress}>
            <View style={[styles.compactIconContainer, { backgroundColor: color + '20' }]}>
                <MaterialCommunityIcons name={icon} size={20} color={color} />
            </View>
            <Text style={styles.compactNavTitle} numberOfLines={1}>{title}</Text>
        </TouchableOpacity>
    );

    // Nav Item Component
    const NavItem = ({ title, icon, color, onPress, description }) => (
        <TouchableOpacity style={[styles.navItem, { borderColor: color + '30' }]} onPress={onPress} activeOpacity={0.7}>
            <LinearGradient colors={['#1a1a1a', '#0a0a0a']} style={styles.navItemInner}>
                <View style={[styles.navIconContainer, { backgroundColor: color + '20' }]}>
                    <MaterialCommunityIcons name={icon} size={24} color={color} />
                </View>
                <View style={styles.navTextContainer}>
                    <Text style={styles.navTitle}>{title}</Text>
                    <Text style={styles.navDesc} numberOfLines={1}>{description}</Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={18} color="#444" />
            </LinearGradient>
        </TouchableOpacity>
    );

    if (isScanning) {
        return (
            <SafeAreaView style={styles.scannerContainer}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
                <TouchableOpacity style={styles.closeScanner} onPress={() => setIsScanning(false)}>
                    <MaterialCommunityIcons name="close-circle" size={50} color="#fff" />
                </TouchableOpacity>
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerRim} />
                    <Text style={styles.scannerText}>Apunta a un código de barras</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <SafeAreaView style={styles.safeContainer} edges={['top']}>
                {/* Header Row */}
                <View style={styles.headerRow}>
                    <View>
                        <Text style={styles.greeting}>COMANDANTE,</Text>
                        <Text style={styles.username}>{userRole === 'admin' ? 'LÍDER SUPREMO' : 'NICO A LA ALIANZA'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.logoutBtn}>
                        <MaterialCommunityIcons name="logout" size={20} color="#666" />
                    </TouchableOpacity>
                </View>

                {/* Compact Menu Row */}
                <View style={styles.menuContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.menuScroll}>
                        <CompactNavItem
                            title="Inventario"
                            icon="package-variant-closed"
                            color="#d4af37"
                            onPress={() => navigation.navigate('Stock')}
                        />
                        <CompactNavItem
                            title="Importaciones"
                            icon="airplane"
                            color="#3498db"
                            onPress={() => navigation.navigate('SupplierOrders')}
                        />
                        <CompactNavItem
                            title="Clientes"
                            icon="account-group"
                            color="#a29bfe"
                            onPress={() => navigation.navigate('Clients')}
                        />
                        <CompactNavItem
                            title="Ventas"
                            icon="chart-line"
                            color="#2ecc71"
                            onPress={() => navigation.navigate('Sales')}
                        />
                        <CompactNavItem
                            title="Pedidos"
                            icon="truck-delivery"
                            color="#e67e22"
                            onPress={() => navigation.navigate('Orders')}
                        />
                        {userRole === 'admin' && (
                            <CompactNavItem
                                title="Panel Admin"
                                icon="shield-account"
                                color="#e74c3c"
                                onPress={() => navigation.navigate('Admin')}
                            />
                        )}
                    </ScrollView>
                </View>

                {/* Main Scanner Section */}
                <View style={styles.centerSection}>
                    <TouchableOpacity
                        style={styles.giantScannerBtn}
                        onPress={async () => {
                            if (permission && !permission.granted) {
                                const result = await requestPermission();
                                if (!result.granted) return;
                            }
                            setIsScanning(true);
                        }}
                        activeOpacity={0.8}
                    >
                        <LinearGradient colors={['#d4af37', '#b8942d']} style={styles.scannerCircle}>
                            <MaterialCommunityIcons name="barcode-scan" size={80} color="#000" />
                            <Text style={styles.scannerBtnText}>NUEVA VENTA</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <Text style={styles.centerDesc}>Escanea para empezar a vender</Text>
                </View>

                {/* Optional Alert Banner */}
                {stats.lowStockCount > 0 && (
                    <TouchableOpacity
                        style={styles.alertBanner}
                        onPress={() => navigation.navigate('Stock', { filter: 'low' })}
                    >
                        <LinearGradient colors={['#e74c3c', '#d63031']} style={styles.alertGradient}>
                            <MaterialCommunityIcons name="alert-decagram" size={20} color="#fff" />
                            <Text style={styles.alertText}>ALERTA: {stats.lowStockCount} Activos bajos</Text>
                            <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    safeContainer: { flex: 1, paddingHorizontal: 20 },
    headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 20 },
    greeting: { color: '#666', fontSize: 10, letterSpacing: 2, fontWeight: '900' },
    username: { color: '#d4af37', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
    logoutBtn: { padding: 8, backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#333' },

    menuContainer: { marginHorizontal: -20, marginBottom: 20 },
    menuScroll: { paddingHorizontal: 20, gap: 15 },
    compactNavItem: { alignItems: 'center', width: 75 },
    compactIconContainer: { width: 50, height: 50, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
    compactNavTitle: { color: '#888', fontSize: 10, fontWeight: '600', textAlign: 'center' },

    centerSection: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    giantScannerBtn: { width: 220, height: 220, borderRadius: 110, elevation: 15, shadowColor: '#d4af37', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 15 },
    scannerCircle: { flex: 1, borderRadius: 110, justifyContent: 'center', alignItems: 'center' },
    scannerBtnText: { color: '#000', fontSize: 16, fontWeight: '900', marginTop: 15, letterSpacing: 1 },
    centerDesc: { color: '#444', fontSize: 12, marginTop: 25, fontWeight: '600', letterSpacing: 1, textTransform: 'uppercase' },

    alertBanner: { marginBottom: 20, borderRadius: 15, overflow: 'hidden' },
    alertGradient: { padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    alertText: { flex: 1, color: '#fff', fontSize: 12, fontWeight: '900', marginHorizontal: 10 },

    scannerContainer: { flex: 1, backgroundColor: '#000' },
    closeScanner: { position: 'absolute', top: 50, right: 30, zIndex: 10 },
    scannerOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
    scannerRim: { width: 250, height: 250, borderWidth: 2, borderColor: '#d4af37', borderRadius: 40, backgroundColor: 'transparent' },
    scannerText: { color: '#fff', marginTop: 20, fontWeight: 'bold', fontSize: 16, textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 10 }
});
