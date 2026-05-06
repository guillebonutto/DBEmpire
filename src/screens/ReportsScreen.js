import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, StatusBar, Dimensions, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { LineChart, BarChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

const screenWidth = Dimensions.get('window').width;

export default function ReportsScreen() {
    const navigation = useNavigation();
    const [dailyReports, setDailyReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthTotal, setMonthTotal] = useState(0);
    const [monthProfit, setMonthProfit] = useState(0);
    const [chartData, setChartData] = useState(null);
    const [selectedDaySales, setSelectedDaySales] = useState(null);
    const [showDayDetail, setShowDayDetail] = useState(false);
    const [productStats, setProductStats] = useState([]);
    const [viewType, setViewType] = useState('daily'); // 'daily' or 'products'

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            // Fetch all sales ordered by date
            const { data, error } = await supabase
                .from('sales')
                .select('*, clients(name), sale_items(*, products(name))')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) processData(data);
        } catch (e) {
            console.log(e);
        } finally {
            setLoading(false);
        }
    };

    const processData = (sales) => {
        const grouped = {};
        const productsCount = {};
        let currentMonthTotal = 0;
        let currentMonthProfit = 0;
        const currentMonth = new Date().getMonth();

        // For Chart (Last 7 days)
        const last7Days = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            // Get local date string YYYY-MM-DD
            const offset = d.getTimezoneOffset() * 60000;
            const localDate = new Date(d.getTime() - offset).toISOString().split('T')[0];
            last7Days[localDate] = 0;
        }

        sales.forEach(sale => {
            const status = (sale.status || '').toLowerCase();
            const isFinalized = status === 'completed' || status === 'exitosa' || status === 'vended' || status === '';

            if (!isFinalized) return; 

            const date = new Date(sale.created_at);
            const dateKey = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            
            // Get local date string for the sale
            const offset = date.getTimezoneOffset() * 60000;
            const isoDate = new Date(date.getTime() - offset).toISOString().split('T')[0];

            // Monthly Total
            if (date.getMonth() === currentMonth) {
                currentMonthTotal += (sale.total_amount || 0);
                currentMonthProfit += (sale.profit_generated || 0);
            }

            // Chart Data
            if (last7Days[isoDate] !== undefined) {
                last7Days[isoDate] += (sale.total_amount || 0);
            }

            if (!grouped[dateKey]) {
                grouped[dateKey] = { date: dateKey, total: 0, profit: 0, count: 0, sales: [], closed: true };
            }
            grouped[dateKey].total += (sale.total_amount || 0);
            grouped[dateKey].profit += (sale.profit_generated || 0);
            grouped[dateKey].count += 1;
            grouped[dateKey].sales.push(sale);

            // Product Stats
            sale.sale_items?.forEach(item => {
                const pName = item.products?.name || 'Producto Desconocido';
                if (!productsCount[pName]) {
                    productsCount[pName] = { name: pName, qty: 0, total: 0 };
                }
                productsCount[pName].qty += (item.quantity || 0);
                productsCount[pName].total += (item.unit_price_at_sale * item.quantity);
            });
        });

        // Prepare Chart Data
        const chartLabels = Object.keys(last7Days).map(k => k.split('-')[2]); // Just the day
        const chartValues = Object.values(last7Days);

        setChartData({
            labels: chartLabels,
            datasets: [{ data: chartValues }]
        });

        // Convert to arrays
        const reportArray = Object.values(grouped);
        const prodArray = Object.values(productsCount).sort((a, b) => b.qty - a.qty);

        setDailyReports(reportArray);
        setProductStats(prodArray);
        setMonthTotal(currentMonthTotal);
        setMonthProfit(currentMonthProfit);
    };

    const renderHeader = () => (
        <View>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <Text style={styles.headerTitle}>HISTORIAL DEL IMPERIO</Text>

                <View style={styles.statsRow}>
                    <View style={[styles.monthBadge, { flex: 1, marginRight: 10 }]}>
                        <Text style={styles.monthLabel}>VENTAS MES</Text>
                        <Text style={styles.monthAmount}>${monthTotal.toFixed(0)}</Text>
                    </View>
                    <View style={[styles.monthBadge, { flex: 1, borderColor: '#2ecc71' }]}>
                        <Text style={[styles.monthLabel, { color: '#2ecc71' }]}>GANANCIA NETO</Text>
                        <Text style={[styles.monthAmount, { color: '#2ecc71' }]}>${monthProfit.toFixed(0)}</Text>
                    </View>
                </View>

                {chartData && (
                    <View style={styles.chartContainer}>
                        <Text style={styles.chartTitle}>TENDENCIA ÚLTIMOS 7 DÍAS</Text>
                        <LineChart
                            data={chartData}
                            width={screenWidth - 50}
                            height={180}
                            chartConfig={{
                                backgroundColor: '#1a1a1a',
                                backgroundGradientFrom: '#1a1a1a',
                                backgroundGradientTo: '#1a1a1a',
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(212, 175, 55, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                style: { borderRadius: 16 },
                                propsForDots: { r: '4', strokeWidth: '2', stroke: '#d4af37' }
                            }}
                            bezier
                            style={{ marginVertical: 8, borderRadius: 16 }}
                        />
                    </View>
                )}
            </LinearGradient>
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tabBtn, viewType === 'daily' && styles.tabActive]} 
                    onPress={() => setViewType('daily')}
                >
                    <Text style={[styles.tabText, viewType === 'daily' && styles.tabTextActive]}>CIERRES DIARIOS</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabBtn, viewType === 'products' && styles.tabActive]} 
                    onPress={() => setViewType('products')}
                >
                    <Text style={[styles.tabText, viewType === 'products' && styles.tabTextActive]}>RANKING PRODUCTOS</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>
                    {viewType === 'daily' ? 'DETALLE DIARIO' : 'RENDIMIENTO POR PRODUCTO'}
                </Text>
            </View>
        </View>
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => {
                setSelectedDaySales(item);
                setShowDayDetail(true);
            }}
            activeOpacity={0.8}
        >
            <View style={styles.dateContainer}>
                <MaterialCommunityIcons name="calendar-check" size={24} color="#d4af37" />
                <View style={{ marginLeft: 15 }}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    <Text style={styles.salesCount}>{item.count} ventas cerradas</Text>
                </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dayTotal}>${item.total.toFixed(2)}</Text>
                <View style={[styles.statusBadge, { flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                    <Text style={styles.statusText}>VER DETALLE</Text>
                    <MaterialCommunityIcons name="chevron-right" size={12} color="#2ecc71" />
                </View>
            </View>
        </TouchableOpacity>
    );

    const renderProductItem = ({ item, index }) => (
        <View style={[styles.card, { borderColor: index === 0 ? '#d4af37' : '#333' }]}>
            <View style={styles.dateContainer}>
                <View style={[styles.rankBadge, { backgroundColor: index < 3 ? '#d4af37' : '#1a1a1a' }]}>
                    <Text style={[styles.rankText, { color: index < 3 ? '#000' : '#d4af37' }]}>{index + 1}</Text>
                </View>
                <View style={{ marginLeft: 15, flex: 1 }}>
                    <Text style={styles.dateText} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.salesCount}>Promedio: ${(item.total / (item.qty || 1)).toFixed(0)} /u</Text>
                </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dayTotal}>{item.qty} u.</Text>
                <Text style={[styles.statusText, { color: '#d4af37', fontSize: 12 }]}>${item.total.toFixed(0)}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {renderHeader()}

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#d4af37" />
                </View>
            ) : (
                <FlatList
                    data={viewType === 'daily' ? dailyReports : productStats}
                    keyExtractor={(item, index) => item.date || item.name + index}
                    renderItem={viewType === 'daily' ? renderItem : renderProductItem}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={styles.empty}>No hay historial disponible aún.</Text>}
                />
            )}

            {/* MODAL DETALLE DE DÍA */}
            <Modal
                visible={showDayDetail}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowDayDetail(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={styles.modalTitle}>{selectedDaySales?.date}</Text>
                                <Text style={styles.modalSubTitle}>{selectedDaySales?.count} operaciones realizadas</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowDayDetail(false)} style={styles.closeBtn}>
                                <MaterialCommunityIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={selectedDaySales?.sales}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <View style={styles.saleDetailCard}>
                                    <View style={styles.saleHeaderSmall}>
                                        <Text style={styles.saleIdText}>Venta #{item.id.slice(0, 4).toUpperCase()}</Text>
                                        <Text style={styles.saleTimeText}>{new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                                    </View>
                                    
                                    <Text style={styles.saleClientText}>Cliente: {item.clients?.name || 'Anónimo'}</Text>
                                    
                                    <View style={styles.divider} />
                                    
                                    {item.sale_items?.map((prod, pIdx) => (
                                        <View key={pIdx} style={styles.itemRow}>
                                            <Text style={styles.itemNameText}>{prod.products?.name || 'Producto'}</Text>
                                            <Text style={styles.itemQtyText}>x{prod.quantity}</Text>
                                            <Text style={styles.itemPriceText}>${(prod.unit_price_at_sale * prod.quantity).toFixed(0)}</Text>
                                        </View>
                                    ))}

                                    <View style={styles.saleFooterSmall}>
                                        <Text style={styles.totalLabelSmall}>TOTAL COBRADO:</Text>
                                        <Text style={styles.totalValueSmall}>${item.total_amount.toFixed(0)}</Text>
                                    </View>
                                </View>
                            )}
                            contentContainerStyle={{ padding: 20 }}
                        />

                        <View style={styles.modalFooter}>
                            <View style={styles.modalTotalBox}>
                                <Text style={styles.totalLabel}>TOTAL DEL DÍA</Text>
                                <Text style={styles.totalAmount}>${selectedDaySales?.total.toFixed(0)}</Text>
                            </View>
                            <TouchableOpacity style={styles.closeActionBtn} onPress={() => setShowDayDetail(false)}>
                                <Text style={styles.closeActionText}>CERRAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    header: { padding: 25, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', marginBottom: 25, textAlign: 'center', letterSpacing: 2 },
    statsRow: { flexDirection: 'row', marginBottom: 20 },
    monthBadge: { backgroundColor: 'rgba(212, 175, 55, 0.05)', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#d4af37' },
    monthLabel: { color: '#888', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 5, textTransform: 'uppercase' },
    monthAmount: { color: '#d4af37', fontSize: 24, fontWeight: 'bold' },

    chartContainer: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.03)', padding: 10, borderRadius: 20, borderWidth: 1, borderColor: '#222' },
    chartTitle: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10, textAlign: 'center' },

    listHeader: { paddingHorizontal: 25, paddingVertical: 15, backgroundColor: '#0a0a0a' },
    listHeaderTitle: { color: '#444', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

    list: { padding: 20, paddingTop: 10 },
    card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    dateContainer: { flexDirection: 'row', alignItems: 'center' },
    dateText: { fontSize: 16, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
    salesCount: { color: '#666', fontSize: 12, marginTop: 4 },
    dayTotal: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
    statusBadge: { backgroundColor: 'rgba(46, 204, 113, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-end', borderWidth: 1, borderColor: 'rgba(46, 204, 113, 0.3)' },
    statusText: { color: '#2ecc71', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#111', height: '85%', borderTopLeftRadius: 30, borderTopRightRadius: 30, shadowColor: '#d4af37', shadowRadius: 20, shadowOpacity: 0.2 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderBottomColor: '#222' },
    modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
    modalSubTitle: { color: '#666', fontSize: 12, marginTop: 4 },
    closeBtn: { backgroundColor: '#222', padding: 8, borderRadius: 12 },
    
    // Tab Styles
    tabContainer: { flexDirection: 'row', backgroundColor: '#000', paddingHorizontal: 20, paddingBottom: 10 },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
    tabActive: { borderBottomColor: '#d4af37' },
    tabText: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    tabTextActive: { color: '#d4af37' },

    // Rank Badge
    rankBadge: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    rankText: { fontSize: 13, fontWeight: 'bold' },

    saleDetailCard: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    saleHeaderSmall: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    saleIdText: { color: '#d4af37', fontWeight: 'bold', fontSize: 13 },
    saleTimeText: { color: '#444', fontSize: 11 },
    saleClientText: { color: '#fff', fontSize: 15, fontWeight: '600', marginBottom: 10 },
    divider: { height: 1, backgroundColor: '#222', marginVertical: 10 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
    itemNameText: { color: '#aaa', fontSize: 12, flex: 2 },
    itemQtyText: { color: '#fff', fontSize: 12, flex: 0.5, textAlign: 'center' },
    itemPriceText: { color: '#fff', fontSize: 12, flex: 1, textAlign: 'right', fontWeight: 'bold' },
    
    saleFooterSmall: { marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#222', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabelSmall: { color: '#666', fontSize: 10, fontWeight: 'bold' },
    totalValueSmall: { color: '#fff', fontSize: 16, fontWeight: '900' },
    
    modalFooter: { padding: 25, backgroundColor: '#0a0a0a', borderTopWidth: 1, borderTopColor: '#222', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    modalTotalBox: { flex: 1 },
    totalLabel: { color: '#888', fontSize: 10, fontWeight: 'bold' },
    totalAmount: { color: '#d4af37', fontSize: 24, fontWeight: '900' },
    closeActionBtn: { backgroundColor: '#d4af37', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
    closeActionText: { color: '#000', fontWeight: 'bold' }
});
