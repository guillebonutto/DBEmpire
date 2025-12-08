import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';

export default function StockScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);

    // Function to fetch products
    const fetchProducts = async () => {
        setLoading(true);
        try {
            // 1. Try to fetch from Supabase
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                setProducts(data);
            } else {
                // Fallback/Initial state if empty
                setProducts([]);
            }
        } catch (error) {
            console.log('Error fetching products:', error.message);
            // For development purposes, if Supabase fails (e.g. no keys), show mock data
            // Only do this if we are in dev/initial setup
            // setProducts(MOCK_PRODUCTS); 
            // Alert.alert('Error', 'Could not fetch products. Check internet or API keys.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch when screen comes into focus
    useFocusEffect(
        useCallback(() => {
            fetchProducts();
        }, [])
    );

    const renderProductItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('AddProduct', { product: item })} // Edit mode
        >
            <View style={styles.cardHeader}>
                <Text style={styles.productName}>{item.name}</Text>
                <Text style={styles.priceTag}>${item.sale_price}</Text>
            </View>
            <View style={styles.detailsRow}>
                <Text style={[styles.stockBadge, item.current_stock < 5 ? styles.lowStock : styles.goodStock]}>
                    Stock: {item.current_stock}
                </Text>
                <Text style={styles.subtext}>Costo: ${item.cost_price} | Margen: {item.profit_margin_percent}%</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>INVENTARIO ({products.length})</Text>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => navigation.navigate('AddProduct')}
                >
                    <Text style={styles.addButtonText}>+ NUEVO</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={products}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={renderProductItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchProducts} tintColor="#d4af37" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Bóveda vacía.</Text>
                        <Text style={styles.emptySubtext}>Añade activos para comenzar.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#1a1a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: { fontSize: 18, fontWeight: '900', color: '#d4af37', letterSpacing: 1 },
    addButton: {
        backgroundColor: '#d4af37',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addButtonText: { color: 'black', fontWeight: 'bold' },
    listContent: { padding: 15 },
    card: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    priceTag: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71' },
    detailsRow: { flexDirection: 'column', gap: 5 },
    stockBadge: { fontWeight: '600', fontSize: 14 },
    lowStock: { color: '#e74c3c' },
    goodStock: { color: '#888' },
    subtext: { color: '#666', fontSize: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
    emptySubtext: { fontSize: 14, color: '#444', fontStyle: 'italic', marginTop: 5 }
});
