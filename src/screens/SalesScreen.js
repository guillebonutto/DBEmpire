import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SalesScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ today: 0, month: 0, countToday: 0, commissions: 0 });
    const [recentSales, setRecentSales] = useState([]);

    const [expandedSale, setExpandedSale] = useState(null);

    const fetchSalesData = async () => {
        setLoading(true);
        try {
            // Get COMPLETED and BUDGET sales with items
            const { data, error } = await supabase
                .from('sales')
                .select('*, profiles(full_name), clients(name), sale_items(*, products(name))')
                .in('status', ['completed', 'budget', 'pending', 'exitosa', ''])
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
            const status = (sale.status || '').toLowerCase();
            const isCompleted = status === 'completed' || status === 'exitosa' || status === '' || status === 'vended' || !status;

            if (!isCompleted) return; // Skip budgets and other non-finalized statuses for money stats

            const saleDate = new Date(sale.created_at).getTime();

            // Calculate total commissions globally
            if (sale.commission_amount) {
                totalCommissions += sale.commission_amount;
            }

            if (saleDate >= startOfMonth) {
                totalMonth += (sale.total_amount || 0);
            }
            if (saleDate >= startOfDay) {
                totalToday += (sale.total_amount || 0);
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

    const handleConvertToSale = async (sale) => {
        Alert.alert(
            'Confirmar Venta',
            '¿Deseas convertir este presupuesto en una venta real? Esto descontará los productos del inventario.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'SÍ, CONVERTIR',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Fetch items
                            const { data: items, error: itemsError } = await supabase
                                .from('sale_items')
                                .select('product_id, quantity, products(current_stock)')
                                .eq('sale_id', sale.id);

                            if (itemsError) throw itemsError;

                            // 2. Update status and timestamp to now
                            const { error: updateError } = await supabase
                                .from('sales')
                                .update({
                                    status: 'completed',
                                    created_at: new Date().toISOString()
                                })
                                .eq('id', sale.id);

                            if (updateError) throw updateError;

                            // 3. Update stock (Try-catch for non-critical failure)
                            try {
                                for (const item of items) {
                                    const currentStock = item.products?.current_stock || 0;
                                    const newStock = currentStock - item.quantity;
                                    await supabase
                                        .from('products')
                                        .update({ current_stock: newStock })
                                        .eq('id', item.product_id);
                                }
                            } catch (stockError) {
                                console.error('Stock Update Error during conversion:', stockError);
                                Alert.alert('Aviso', 'Venta confirmada, pero hubo un error actualizando el inventario.');
                            }

                            Alert.alert('✅ Convertido', 'Venta finalizada con éxito.');
                            fetchSalesData();
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'No se pudo completar la operación.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderSaleItem = ({ item }) => {
        const isBudget = item.status === 'budget';
        const isPending = item.status === 'pending';
        const isExpanded = expandedSale === item.id;

        return (
            <TouchableOpacity
                style={[styles.saleItem, (isBudget || isPending) && styles.saleItemPending, isExpanded && styles.saleItemExpanded]}
                onPress={() => setExpandedSale(isExpanded ? null : item.id)}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.saleHeader}>
                            <Text style={styles.saleId}>Venta #{item.id.slice(0, 4)}</Text>
                            {isBudget && <View style={styles.budgetBadge}><Text style={styles.budgetText}>PRESUPUESTO</Text></View>}
                            {isPending && <View style={[styles.budgetBadge, { backgroundColor: '#ff4444' }]}><Text style={styles.budgetText}>DEUDA</Text></View>}
                        </View>
                        <Text style={styles.saleDate}>{new Date(item.created_at).toLocaleDateString()} - {new Date(item.created_at).toLocaleTimeString()}</Text>

                        <Text style={styles.clientName}>
                            Cliente: {item.clients ? item.clients.name : 'Anónimo'}
                        </Text>

                        {item.profiles && <Text style={styles.sellerName}>Por: {item.profiles.full_name}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.saleAmount, isBudget && { color: '#e67e22' }]}>${item.total_amount}</Text>
                        {!isBudget && <Text style={styles.saleProfit}>(G: ${item.profit_generated})</Text>}
                        <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#555" style={{ marginTop: 5 }} />
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.itemsDetail}>
                        {item.sale_items?.map((detail, idx) => (
                            <View key={idx} style={styles.detailRow}>
                                <Text style={styles.detailText} numberOfLines={1}>{detail.products?.name || 'Item'}</Text>
                                <Text style={styles.detailQty}>x{detail.quantity}</Text>
                                <Text style={styles.detailPrice}>${detail.unit_price_at_sale}</Text>
                            </View>
                        ))}
                        {isBudget && (
                            <TouchableOpacity
                                style={styles.convertBtn}
                                onPress={() => handleConvertToSale(item)}
                                disabled={loading}
                            >
                                <MaterialCommunityIcons name="check-decagram" size={14} color="#000" />
                                <Text style={styles.convertBtnText}>COBRAR AHORA</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

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
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                renderItem={renderSaleItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSalesData} />}
                ListEmptyComponent={<Text style={styles.empty}>No hay ventas registradas.</Text>}
            />
        </SafeAreaView>
    );
}

import { MaterialCommunityIcons } from '@expo/vector-icons';

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },

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
    saleItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    saleItemExpanded: { borderColor: '#d4af37' },
    saleId: { fontWeight: 'bold', color: '#fff' },
    saleDate: { fontSize: 12, color: '#666' },
    clientName: { fontSize: 13, fontWeight: '600', color: '#a29bfe', marginTop: 2 },
    sellerName: { fontSize: 12, color: '#ccc', marginTop: 2 },
    saleAmount: { fontSize: 16, fontWeight: 'bold', color: '#2ecc71' }, // Green for positives stays good
    saleProfit: { fontSize: 10, color: '#888' },

    // Details styles
    itemsDetail: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    detailText: { color: '#ccc', fontSize: 12, flex: 2 },
    detailQty: { color: '#fff', fontSize: 12, flex: 0.5, textAlign: 'center', fontWeight: 'bold' },
    detailPrice: { color: '#fff', fontSize: 12, flex: 1, textAlign: 'right' },

    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' },

    // New styles for budget conversion
    saleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    budgetBadge: { backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    budgetText: { color: '#000', fontSize: 8, fontWeight: 'bold' },
    saleItemPending: { borderColor: '#444', borderStyle: 'dashed' },
    convertBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d4af37',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 10,
        gap: 5
    },
    convertBtnText: { color: '#000', fontSize: 10, fontWeight: '900' }
});
