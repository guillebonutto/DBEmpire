import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export default function ReportsScreen() {
    const [dailyReports, setDailyReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [monthTotal, setMonthTotal] = useState(0);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            // Fetch all sales ordered by date
            const { data, error } = await supabase
                .from('sales')
                .select('created_at, total_amount, status')
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
        const currentMonth = new Date().getMonth();

        sales.forEach(sale => {
            const date = new Date(sale.created_at);
            const dateKey = date.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });

            // Monthly Total
            if (date.getMonth() === currentMonth) {
                currentMonthTotal += sale.total_amount;
            }

            if (!grouped[dateKey]) {
                grouped[dateKey] = { date: dateKey, total: 0, count: 0, closed: true };
            }
            grouped[dateKey].total += sale.total_amount;
            grouped[dateKey].count += 1;
        });

        // Convert to array
        const reportArray = Object.values(grouped);
        setDailyReports(reportArray);
        setMonthTotal(currentMonthTotal);
    };

    const renderHeader = () => (
        <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
            <Text style={styles.headerTitle}>HISTORIAL DEL IMPERIO</Text>
            <View style={styles.monthBadge}>
                <Text style={styles.monthLabel}>TOTAL MES ACTUAL</Text>
                <Text style={styles.monthAmount}>${monthTotal.toFixed(2)}</Text>
            </View>
        </LinearGradient>
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

    header: { padding: 25, paddingTop: 40, borderBottomWidth: 1, borderBottomColor: '#222', paddingBottom: 40 },
    headerTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', marginBottom: 25, textAlign: 'center', letterSpacing: 2 },
    monthBadge: { backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 20, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#d4af37' },
    monthLabel: { color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 5, textTransform: 'uppercase' },
    monthAmount: { color: '#d4af37', fontSize: 36, fontWeight: 'bold' },

    list: { padding: 20 },
    card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, marginBottom: 15, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    dateContainer: { flexDirection: 'row', alignItems: 'center' },
    dateText: { fontSize: 16, fontWeight: 'bold', color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 },
    salesCount: { color: '#666', fontSize: 12, marginTop: 4 },
    dayTotal: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
    statusBadge: { backgroundColor: 'rgba(46, 204, 113, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: 'flex-end', borderWidth: 1, borderColor: 'rgba(46, 204, 113, 0.3)' },
    statusText: { color: '#2ecc71', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' }
});
