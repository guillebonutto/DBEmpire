import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, StatusBar, Dimensions, ScrollView, Alert } from 'react-native';
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

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            // Fetch all sales ordered by date
            const { data, error } = await supabase
                .from('sales')
                .select('created_at, total_amount, profit_generated, status')
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
        let currentMonthTotal = 0;
        let currentMonthProfit = 0;
        const currentMonth = new Date().getMonth();

        // For Chart (Last 7 days)
        const last7Days = {};
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(today.getDate() - i);
            const key = d.toISOString().split('T')[0];
            last7Days[key] = 0;
        }

        sales.forEach(sale => {
            const status = (sale.status || '').toLowerCase();
            const isFinalized = status === 'completed' || status === 'exitosa' || status === 'vended' || status === '';

            if (!isFinalized) return; // Skip budgets/pending from financial reports

            const date = new Date(sale.created_at);
            const dateKey = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
            const isoDate = date.toISOString().split('T')[0];

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
                grouped[dateKey] = { date: dateKey, total: 0, profit: 0, count: 0, closed: true };
            }
            grouped[dateKey].total += (sale.total_amount || 0);
            grouped[dateKey].profit += (sale.profit_generated || 0);
            grouped[dateKey].count += 1;
        });

        // Prepare Chart Data
        const chartLabels = Object.keys(last7Days).map(k => k.split('-')[2]); // Just the day
        const chartValues = Object.values(last7Days);

        setChartData({
            labels: chartLabels,
            datasets: [{ data: chartValues }]
        });

        // Convert to array
        const reportArray = Object.values(grouped);
        setDailyReports(reportArray);
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
            <View style={styles.listHeader}>
                <Text style={styles.listHeaderTitle}>DETALLE DIARIO</Text>
            </View>
        </View>
    );

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.dateContainer}>
                <MaterialCommunityIcons name="calendar-check" size={24} color="#d4af37" />
                <View style={{ marginLeft: 15 }}>
                    <Text style={styles.dateText}>{item.date}</Text>
                    <Text style={styles.salesCount}>{item.count} ventas cerradas</Text>
                </View>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.dayTotal}>${item.total.toFixed(2)}</Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>Cierre OK</Text>
                </View>
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
                    data={dailyReports}
                    keyExtractor={item => item.date}
                    renderItem={renderItem}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={<Text style={styles.empty}>No hay historial disponible aún.</Text>}
                />
            )}
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
    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' }
});
