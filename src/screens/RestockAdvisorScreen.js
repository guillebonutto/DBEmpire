
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function RestockAdvisorScreen({ navigation }) {
    const [loading, setLoading] = useState(true);
    const [recommendations, setRecommendations] = useState([]);

    useEffect(() => {
        calculateAdvice();
    }, []);

    const calculateAdvice = async () => {
        setLoading(true);
        try {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

            // 1. Fetch Products
            const { data: products } = await supabase
                .from('products')
                .select('id, name, current_stock, image_url')
                .eq('active', true);

            // 2. Fetch Sales Items from last 30 days
            const { data: saleItems } = await supabase
                .from('sale_items')
                .select('product_id, quantity, created_at')
                .gte('created_at', thirtyDaysAgo.toISOString());

            if (!products) return;

            // 3. Map Sales per Product
            const salesMap = {};
            saleItems?.forEach(item => {
                salesMap[item.product_id] = (salesMap[item.product_id] || 0) + (item.quantity || 0);
            });

            // 4. Process Recommendations
            const processed = products.map(p => {
                const soldIn30 = salesMap[p.id] || 0;
                const dailyVelocity = soldIn30 / 30;
                const stock = p.current_stock || 0;

                let daysRemaining = dailyVelocity > 0 ? stock / dailyVelocity : 999;

                return {
                    ...p,
                    soldIn30,
                    dailyVelocity,
                    daysRemaining
                };
            }).sort((a, b) => a.daysRemaining - b.daysRemaining);

            setRecommendations(processed);
        } catch (error) {
            console.error('Restock calculation error:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => {
        let statusColor = '#2ecc71';
        let statusText = 'Stock Seguro';

        if (item.daysRemaining <= 3) {
            statusColor = '#e74c3c';
            statusText = 'CRÍTICO: Reponer ya';
        } else if (item.daysRemaining <= 10) {
            statusColor = '#f1c40f';
            statusText = 'Próximo a agotarse';
        } else if (item.daysRemaining > 365) {
            statusText = 'Sin ventas recientes';
            statusColor = '#666';
        }

        return (
            <View style={styles.card}>
                <View style={styles.cardMain}>
                    <View style={styles.info}>
                        <Text style={styles.prodName}>{item.name}</Text>
                        <View style={styles.badgeRow}>
                            <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
                                <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
                            </View>
                            <Text style={styles.stockLabel}>Stock: {item.current_stock}</Text>
                        </View>
                    </View>
                    <View style={styles.daysBox}>
                        <Text style={[styles.daysValue, { color: statusColor }]}>
                            {item.daysRemaining > 365 ? '∞' : Math.round(item.daysRemaining)}
                        </Text>
                        <Text style={styles.daysLabel}>DÍAS</Text>
                    </View>
                </View>
                <View style={styles.detailsRow}>
                    <Text style={styles.detailText}>Ventas (30d): {item.soldIn30}</Text>
                    <Text style={styles.detailText}>Ritmo: {item.dailyVelocity.toFixed(2)}/día</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.title}>ASESOR DE REPOSICIÓN</Text>
                    <Text style={styles.subtitle}>Predicción basada en ventas de los últimos 30 días</Text>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#d4af37" />
                    <Text style={styles.loadingText}>Analizando ritmos de venta...</Text>
                </View>
            ) : (
                <FlatList
                    data={recommendations}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <View style={styles.empty}>
                            <MaterialCommunityIcons name="check-decagram" size={60} color="#222" />
                            <Text style={styles.emptyText}>Inventario Equilibrado</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 15 },
    title: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    subtitle: { color: '#666', fontSize: 10, fontWeight: 'bold', marginTop: 2 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#d4af37', marginTop: 15, fontWeight: 'bold' },
    list: { padding: 15 },
    card: { backgroundColor: '#0a0a0a', borderRadius: 15, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
    cardMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    info: { flex: 1 },
    prodName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 },
    badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 5, borderWidth: 1 },
    statusText: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    stockLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
    daysBox: { alignItems: 'center', minWidth: 60 },
    daysValue: { fontSize: 24, fontWeight: '900' },
    daysLabel: { fontSize: 10, color: '#444', fontWeight: 'bold' },
    detailsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#111' },
    detailText: { color: '#444', fontSize: 11, fontWeight: 'bold' },
    empty: { marginTop: 100, alignItems: 'center' },
    emptyText: { color: '#222', fontSize: 16, fontWeight: 'bold', marginTop: 15 }
});
