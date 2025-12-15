import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

export default function SalesScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ today: 0, month: 0, countToday: 0, commissions: 0 });
    const [recentSales, setRecentSales] = useState([]);

    const fetchSalesData = async () => {
        setLoading(true);
        try {
            // Get all COMPLETED sales
            const { data, error } = await supabase
                .from('sales')
                .select('*, profiles(full_name), clients(name)') // Join with profile AND clients
                .eq('status', 'completed')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                processStats(data);
                setRecentSales(data.slice(0, 10)); // Show last 10
            }
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    const processStats = (sales) => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let totalToday = 0;
        let totalMonth = 0;
        let count = 0;
        let totalCommissions = 0;

        sales.forEach(sale => {
            const saleDate = new Date(sale.created_at).getTime();

            // Calculate total commissions globally (or add date filter if needed)
            if (sale.commission_amount) {
                totalCommissions += sale.commission_amount;
            }

            if (saleDate >= startOfMonth) {
                totalMonth += sale.total_amount;
            }
            if (saleDate >= startOfDay) {
                totalToday += sale.total_amount;
                count++;
            }
        });

        // Store commission in stats
        setStats({ today: totalToday, month: totalMonth, countToday: count, commissions: totalCommissions });
    };

    useFocusEffect(
        useCallback(() => {
            fetchSalesData();
        }, [])
    );

    const renderSaleItem = ({ item }) => (
        <View style={styles.saleItem}>
            <View>
                <Text style={styles.saleId}>Venta #{item.id.slice(0, 4)}</Text>
                <Text style={styles.saleDate}>{new Date(item.created_at).toLocaleDateString()} - {new Date(item.created_at).toLocaleTimeString()}</Text>

                {/* Client Name Display */}
                <Text style={styles.clientName}>
                    Cliente: {item.clients ? item.clients.name : 'Anónimo'}
                </Text>

                {item.profiles && <Text style={styles.sellerName}>Vendió: {item.profiles.full_name}</Text>}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.saleAmount}>+${item.total_amount}</Text>
                <Text style={styles.saleProfit}>(G: ${item.profit_generated})</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {/* Cards Header */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Vendido Hoy ({stats.countToday})</Text>
                    <Text style={styles.statValue}>${stats.today.toFixed(2)}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Este Mes</Text>
                    <Text style={styles.statValue}>${stats.month.toFixed(2)}</Text>
                </View>
            </View>

            {/* COMMISSION CARD */}
            <TouchableOpacity
                style={[styles.commissionCard]}
                activeOpacity={0.9}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.goldIcon}>
                        <Text style={{ fontSize: 20 }}>🤝</Text>
                    </View>
                    <View>
                        <Text style={styles.commissionLabel}>COMISIONES A PAGAR</Text>
                        <Text style={styles.commissionValue}>${stats.commissions ? stats.commissions.toFixed(2) : '0.00'}</Text>
                    </View>
                </View>
            </TouchableOpacity>

            <View style={styles.btnRow}>
                {/* Visualizar Históricos */}
                <TouchableOpacity
                    style={styles.historyBtn}
                    onPress={() => navigation.navigate('Reports')}
                >
                    <Text style={styles.historyBtnText}>📅 Ver Cierres Diarios</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Historial Reciente</Text>

            <FlatList
                data={recentSales}
                keyExtractor={item => item.id}
                renderItem={renderSaleItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSalesData} />}
                ListEmptyComponent={<Text style={styles.empty}>No hay ventas registradas.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000', padding: 20 },

    // Stats Cards
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    statCard: { width: '48%', padding: 20, borderRadius: 15, elevation: 3, borderWidth: 1, borderColor: '#333', backgroundColor: '#1e1e1e' },
    statLabel: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    statValue: { color: '#d4af37', fontSize: 24, fontWeight: '900', marginTop: 5 }, // Gold text

    // Commission Card (Gold Highlight)
    commissionCard: {
        backgroundColor: '#1a1a1a',
        padding: 20,
        borderRadius: 15,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#d4af37', // Gold Border
        shadowColor: '#d4af37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5
    },
    goldIcon: { marginRight: 15, backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 12, borderRadius: 30 },
    commissionLabel: { color: '#d4af37', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    commissionValue: { color: 'white', fontSize: 28, fontWeight: 'bold' },

    // Buttons
    btnRow: { marginBottom: 25 },
    historyBtn: { backgroundColor: '#222', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#444' },
    historyBtnText: { color: '#ccc', fontWeight: 'bold', letterSpacing: 0.5 },
    newSaleBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 10, alignItems: 'center', shadowColor: '#d4af37', shadowOpacity: 0.3, elevation: 10 },
    newSaleText: { color: '#000', fontWeight: '900', fontSize: 18, letterSpacing: 1 },

    // List & Items
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#666', marginBottom: 15, letterSpacing: 1, textTransform: 'uppercase' },
    list: { paddingBottom: 20 },
    saleItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    saleId: { fontWeight: 'bold', color: '#fff' },
    saleDate: { fontSize: 12, color: '#666' },
    clientName: { fontSize: 13, fontWeight: '600', color: '#a29bfe', marginTop: 2 },
    sellerName: { fontSize: 12, color: '#ccc', marginTop: 2 },
    saleAmount: { fontSize: 16, fontWeight: 'bold', color: '#2ecc71' }, // Green for positives stays good
    saleProfit: { fontSize: 10, color: '#888' },
    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' }
});
