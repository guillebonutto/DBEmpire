import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, RefreshControl } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
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

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setUserRole(role);
        });
    }, []);

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

    // Mini Dash Stat Component
    const MiniDashboardStat = ({ label, value, color, icon }) => (
        <View style={[styles.miniStatCard, { borderColor: color + '40' }]}>
            <LinearGradient colors={[color + '15', 'transparent']} style={styles.miniStatGradient}>
                <View style={styles.miniStatHeader}>
                    <MaterialCommunityIcons name={icon} size={14} color={color} />
                    <Text style={[styles.miniStatLabel, { color }]}>{label}</Text>
                </View>
                <Text style={styles.miniStatValue}>${value.toFixed(0)}</Text>
            </LinearGradient>
        </View>
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

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#121212']}
                style={styles.headerBackground}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
            >
                <SafeAreaView style={styles.headerContent} edges={['top']}>
                    <View style={styles.topRow}>
                        <View>
                            <Text style={styles.greeting}>COMANDANTE,</Text>
                            <Text style={styles.username}>{userRole === 'admin' ? 'LÍDER SUPREMO' : 'NICO A LA ALIANZA'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.logoutBtn}>
                            <MaterialCommunityIcons name="logout" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Stats Dashboard */}
                    <View style={styles.dashboardContainer}>
                        {stats.lowStockCount > 0 && (
                            <TouchableOpacity
                                style={styles.alertBanner}
                                onPress={() => navigation.navigate('Stock', { filter: 'low' })}
                                activeOpacity={0.8}
                            >
                                <LinearGradient colors={['#e74c3c', '#c0392b']} style={styles.alertGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}>
                                    <View style={styles.alertContent}>
                                        <MaterialCommunityIcons name="alert-decagram" size={20} color="#fff" />
                                        <Text style={styles.alertText}>
                                            ALERTA CRÍTICA: {stats.lowStockCount} Activos con stock bajo
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                        <View style={styles.statsRow}>
                            <MiniDashboardStat
                                label="VENTAS HOY"
                                value={stats.todaySales}
                                color="#2ecc71"
                                icon="currency-usd"
                            />
                            <MiniDashboardStat
                                label="GANANCIA"
                                value={stats.netProfit}
                                color="#d4af37"
                                icon="bank-transfer-in"
                            />
                        </View>
                        <View style={[styles.statsRow, { marginTop: 10 }]}>
                            <MiniDashboardStat
                                label="PRESUPUESTOS"
                                value={stats.budgetSales}
                                color="#3498db"
                                icon="file-document-outline"
                            />
                            <MiniDashboardStat
                                label="DEUDAS PEND."
                                value={stats.debtSupplier}
                                color="#e74c3c"
                                icon="account-cash-outline"
                            />
                        </View>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.bodyContainer}>
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchDashboardStats} tintColor="#d4af37" />}
                >
                    <Text style={styles.sectionLabel}>SISTEMAS DEL IMPERIO</Text>

                    {/* Main Priority Action */}
                    <TouchableOpacity
                        style={styles.mainActionCard}
                        onPress={() => navigation.navigate('NewSale')}
                        activeOpacity={0.8}
                    >
                        <LinearGradient colors={['#d4af37', '#b8942d']} style={styles.mainActionGradient}>
                            <View style={styles.mainActionLeft}>
                                <MaterialCommunityIcons name="cash-register" size={32} color="#000" />
                                <View style={styles.mainActionText}>
                                    <Text style={styles.mainActionTitle}>NUEVA VENTA</Text>
                                    <Text style={styles.mainActionDesc}>Registrar operación inmediata</Text>
                                </View>
                            </View>
                            <MaterialCommunityIcons name="arrow-right-circle" size={28} color="#000" />
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Secondary Navigation Grid */}
                    <View style={styles.navGrid}>
                        <NavItem
                            title="Inventario"
                            description={`${userRole === 'admin' ? 'Bóveda de activos' : 'Stock actual'}`}
                            icon="package-variant-closed"
                            color="#d4af37"
                            onPress={() => navigation.navigate('Stock')}
                        />
                        <NavItem
                            title="Importaciones"
                            description="Pedidos a proveedores"
                            icon="airplane"
                            color="#3498db"
                            onPress={() => navigation.navigate('SupplierOrders')}
                        />
                        <NavItem
                            title="Clientes"
                            description="Base de datos VIP"
                            icon="account-group"
                            color="#a29bfe"
                            onPress={() => navigation.navigate('Clients')}
                        />
                        <NavItem
                            title="Ventas Totales"
                            description="Histórico y cierres"
                            icon="chart-line"
                            color="#2ecc71"
                            onPress={() => navigation.navigate('Sales')}
                        />
                        <NavItem
                            title="Pedidos"
                            description="Entregas pendientes"
                            icon="truck-delivery"
                            color="#e67e22"
                            onPress={() => navigation.navigate('Orders')}
                        />
                        <NavItem
                            title="Panel Admin"
                            description="Control total"
                            icon="shield-account"
                            color="#e74c3c"
                            onPress={() => navigation.navigate('Admin')}
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    headerBackground: { paddingBottom: 25, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerContent: { marginTop: 10 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    greeting: { color: '#666', fontSize: 10, letterSpacing: 2, fontWeight: '900' },
    username: { color: '#d4af37', fontSize: 22, fontWeight: '900', letterSpacing: 1 },
    logoutBtn: { padding: 8, backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#333' },

    dashboardContainer: { width: '100%' },
    alertBanner: { marginBottom: 15, borderRadius: 12, overflow: 'hidden', elevation: 5 },
    alertGradient: { paddingVertical: 10, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    alertContent: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    alertText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

    statsRow: { flexDirection: 'row', gap: 10 },
    miniStatCard: { flex: 1, borderRadius: 15, borderWidth: 1, backgroundColor: '#0a0a0a', overflow: 'hidden' },
    miniStatGradient: { padding: 12 },
    miniStatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
    miniStatLabel: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    miniStatValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

    bodyContainer: { flex: 1, marginTop: 5 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    sectionLabel: { fontSize: 10, fontWeight: '900', color: '#444', marginBottom: 15, marginTop: 25, letterSpacing: 3, textTransform: 'uppercase' },

    mainActionCard: { marginBottom: 20, borderRadius: 20, overflow: 'hidden', elevation: 10, shadowColor: '#d4af37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    mainActionGradient: { padding: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    mainActionLeft: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    mainActionText: { justifyContent: 'center' },
    mainActionTitle: { color: '#000', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
    mainActionDesc: { color: 'rgba(0,0,0,0.6)', fontSize: 11, fontWeight: '600' },

    navGrid: { gap: 10 },
    navItem: { borderRadius: 18, borderWidth: 1, overflow: 'hidden' },
    navItemInner: { padding: 18, flexDirection: 'row', alignItems: 'center', gap: 15 },
    navIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    navTextContainer: { flex: 1 },
    navTitle: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 2 },
    navDesc: { color: '#666', fontSize: 11 },
});
