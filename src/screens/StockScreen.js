import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons'; // Assuming Ionicons is available or use text

export default function StockScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
                // Client-side filtering for 'active' to be safe if column doesn't exist yet (treated as true/null)
                // We only hide if active === false.
                const validProducts = data.filter(p => p.active !== false);
                setProducts(validProducts);
                setFilteredProducts(validProducts);
            } else {
                setProducts([]);
                setFilteredProducts([]);
            }
        } catch (error) {
            console.log('Error fetching products:', error.message);
        } finally {
            setLoading(false);
        }
    };

    // Filter logic
    useEffect(() => {
        if (searchQuery) {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.provider && p.provider.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts(products);
        }
    }, [searchQuery, products]);

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
            <View style={styles.cardContent}>
                {/* Image */}
                <View style={styles.imageContainer}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.productImage} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Text style={styles.placeholderText}>No img</Text>
                        </View>
                    )}
                </View>

                {/* Details */}
                <View style={styles.detailsContainer}>
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
                </View>
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

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar producto..."
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={renderProductItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchProducts} tintColor="#d4af37" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{searchQuery ? 'No encontrado.' : 'Bóveda vacía.'}</Text>
                        {!searchQuery && <Text style={styles.emptySubtext}>Añade activos para comenzar.</Text>}
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

    searchContainer: { padding: 15, backgroundColor: '#111' },
    searchInput: {
        backgroundColor: '#222',
        color: '#fff',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333'
    },

    listContent: { padding: 15 },
    card: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    imageContainer: { marginRight: 15 },
    productImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333' },
    placeholderImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
    placeholderText: { color: '#666', fontSize: 10 },

    detailsContainer: { flex: 1 },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#fff', flex: 1 },
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
