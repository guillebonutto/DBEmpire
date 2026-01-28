import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [starProduct, setStarProduct] = useState(null);
    const [clavoProduct, setClavoProduct] = useState(null);
    const [comparisons, setComparisons] = useState({
        today: { current: 0, prev: 0, diff: 0 },
        week: { current: 0, prev: 0, diff: 0 },
        month: { current: 0, prev: 0, diff: 0 }
    });

    useEffect(() => {
        fetchAnalytics();
    }, []);

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchProductPerformance(),
                fetchComparisons()
            ]);
        } catch (error) {
            console.log('Error fetching analytics:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProductPerformance = async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // Fetch sales items from last 30 days by joining with sales table
        const { data: items, error } = await supabase
            .from('sale_items')
            .select('quantity, product_id, products(id, name, sale_price), sales!inner(created_at)')
            .gte('sales.created_at', thirtyDaysAgo.toISOString());

        if (error) throw error;

        const performanceMap = {};
        items.forEach(item => {
            if (!performanceMap[item.product_id]) {
                performanceMap[item.product_id] = {
                    count: 0,
                    product: item.products
                };
            }
            performanceMap[item.product_id].count += item.quantity;
        });

        const sorted = Object.values(performanceMap).sort((a, b) => b.count - a.count);

        if (sorted.length > 0) {
            setStarProduct(sorted[0]);
            // For Clavo, we need products with 0 sales too
            const { data: allProducts } = await supabase.from('products').select('*').eq('active', true);
            const soldIds = new Set(Object.keys(performanceMap));
            const unsold = allProducts.filter(p => !soldIds.has(p.id));

            if (unsold.length > 0) {
                setClavoProduct({ count: 0, product: unsold[0] });
            } else {
                setClavoProduct(sorted[sorted.length - 1]);
            }
        }
    };

    const fetchComparisons = async () => {
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);

        // Today vs Yesterday
        const { data: todaySales } = await supabase.from('sales').select('total_amount').gte('created_at', startOfToday.toISOString());
        const { data: yesterdaySales } = await supabase.from('sales').select('total_amount').gte('created_at', startOfYesterday.toISOString()).lt('created_at', startOfToday.toISOString());

        const todayTotal = todaySales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;
        const yesterdayTotal = yesterdaySales?.reduce((sum, s) => sum + (s.total_amount || 0), 0) || 0;

        setComparisons(prev => ({
            ...prev,
            today: {
                current: todayTotal,
                prev: yesterdayTotal,
                diff: yesterdayTotal === 0 ? 100 : ((todayTotal - yesterdayTotal) / yesterdayTotal) * 100
            }
        }));
    };

    const handleQuickAction = async (action, product) => {
        if (!product) return;

        Alert.alert(
            'Confirmar Acción',
            `¿Estás seguro de que quieres ${action} el producto "${product.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            if (action === 'subir precio') {
                                const newPrice = product.sale_price * 1.1;
                                await supabase.from('products').update({ sale_price: newPrice }).eq('id', product.id);
                                Alert.alert('✅ Éxito', 'Precio incrementado un 10%');
                            } else if (action === 'dejar de vender') {
                                await supabase.from('products').update({ active: false }).eq('id', product.id);
                                Alert.alert('✅ Éxito', 'Producto desactivado');
                            }
                            fetchAnalytics();
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo completar la acción');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderComparisonCard = (title, data) => (
        <View style={styles.compCard}>
            <Text style={styles.compTitle}>{title}</Text>
            <View style={styles.compRow}>
                <Text style={styles.compValue}>${data.current.toFixed(0)}</Text>
                <View style={[styles.badge, { backgroundColor: data.diff >= 0 ? '#2ecc7120' : '#e74c3c20' }]}>
                    <MaterialCommunityIcons
                        name={data.diff >= 0 ? "arrow-up" : "arrow-down"}
                        size={14}
                        color={data.diff >= 0 ? "#2ecc71" : "#e74c3c"}
                    />
                    <Text style={[styles.badgeText, { color: data.diff >= 0 ? "#2ecc71" : "#e74c3c" }]}>
                        {Math.abs(data.diff).toFixed(1)}%
                    </Text>
                </View>
            </View>
            <Text style={styles.compSub}>vs anterior: ${data.prev.toFixed(0)}</Text>
        </View>
    );

    const renderProductCard = (title, item, type) => {
        if (!item) return null;
        const { product, count } = item;
        const isStar = type === 'star';

        return (
            <View style={[styles.productCard, { borderColor: isStar ? '#d4af37' : '#3498db' }]}>
                <View style={styles.cardHeader}>
                    <MaterialCommunityIcons name={isStar ? "star" : "anchor"} size={24} color={isStar ? "#d4af37" : "#3498db"} />
                    <Text style={[styles.cardTitle, { color: isStar ? "#d4af37" : "#3498db" }]}>{title}</Text>
                </View>

                <Text style={styles.prodName}>{product.name}</Text>
                <Text style={styles.prodStats}>{count} unidades vendidas (30d)</Text>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleQuickAction('subir precio', product)}>
                        <MaterialCommunityIcons name="trending-up" size={18} color="#2ecc71" />
                        <Text style={[styles.actionText, { color: '#2ecc71' }]}>SUBIR 10%</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleQuickAction('dejar de vender', product)}>
                        <MaterialCommunityIcons name="close-circle" size={18} color="#e74c3c" />
                        <Text style={[styles.actionText, { color: '#e74c3c' }]}>PAUSAR</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.actionBtn} onPress={() => navigation.navigate('Promotions', { selectProduct: product })}>
                        <MaterialCommunityIcons name="sale" size={18} color="#d4af37" />
                        <Text style={[styles.actionText, { color: '#d4af37' }]}>PROMO</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>ANALÍTICAS</Text>
                    <TouchableOpacity onPress={fetchAnalytics}>
                        <MaterialCommunityIcons name="refresh" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {loading && !starProduct && (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#d4af37" />
                    <Text style={{ color: '#666', marginTop: 10 }}>Analizando Imperio...</Text>
                </View>
            )}

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAnalytics} tintColor="#d4af37" />}
            >
                <Text style={styles.sectionTitle}>COMPARADOR DE RENDIMIENTO</Text>
                <View style={styles.compGrid}>
                    {renderComparisonCard('HOY VS AYER', comparisons.today)}
                </View>

                <Text style={styles.sectionTitle}>ANÁLISIS DE PRODUCTOS (30 DÍAS)</Text>
                {renderProductCard('PRODUCTO ESTRELLA', starProduct, 'star')}
                {renderProductCard('PRODUCTO CLAVO', clavoProduct, 'clavo')}

                <TouchableOpacity
                    style={styles.incidentBtn}
                    onPress={() => navigation.navigate('Incidents')}
                >
                    <LinearGradient colors={['#e74c3c', '#c0392b']} style={styles.btnGradient}>
                        <MaterialCommunityIcons name="alert-octagon" size={24} color="white" />
                        <Text style={styles.incidentBtnText}>REPORTAR ERROR / INCIDENTE</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

    content: { padding: 20 },
    sectionTitle: { color: '#666', fontSize: 12, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },

    compGrid: { marginBottom: 30 },
    compCard: { backgroundColor: '#111', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#222' },
    compTitle: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 10 },
    compRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 },
    compValue: { color: '#fff', fontSize: 28, fontWeight: '900' },
    compSub: { color: '#555', fontSize: 12 },
    badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, gap: 4 },
    badgeText: { fontSize: 12, fontWeight: 'bold' },

    productCard: { backgroundColor: '#111', padding: 20, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
    cardTitle: { fontSize: 14, fontWeight: '900', letterSpacing: 1 },
    prodName: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginBottom: 5 },
    prodStats: { color: '#666', fontSize: 14, marginBottom: 20 },

    actionRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#222', paddingTop: 15 },
    actionBtn: { alignItems: 'center', gap: 5 },
    actionText: { fontSize: 10, fontWeight: '900' },

    incidentBtn: { marginTop: 20, borderRadius: 15, overflow: 'hidden', marginBottom: 50 },
    btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
    incidentBtnText: { color: 'white', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});
