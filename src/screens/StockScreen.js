import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
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

    const handleDelete = async (product) => {
        Alert.alert(
            'Eliminar Producto',
            `¿Estás seguro de que quieres eliminar "${product.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error: deleteError } = await supabase
                                .from('products')
                                .delete()
                                .eq('id', product.id);

                            if (deleteError) {
                                // If product has sales history, archive it
                                if (deleteError.message.includes('foreign key constraint') ||
                                    deleteError.code === '23503') {
                                    const { error: archiveError } = await supabase
                                        .from('products')
                                        .update({ active: false })
                                        .eq('id', product.id);

                                    if (archiveError) {
                                        throw archiveError;
                                    }

                                    Alert.alert(
                                        'Producto Archivado',
                                        'Este producto tiene ventas registradas y se ha archivado para mantener el historial.',
                                        [{ text: 'Entendido' }]
                                    );
                                } else {
                                    throw deleteError;
                                }
                            } else {
                                Alert.alert('✅ Eliminado', 'Producto eliminado correctamente');
                            }

                            fetchProducts(); // Refresh list
                        } catch (err) {
                            console.log('Error deleting product:', err);
                            Alert.alert('Error', 'No se pudo eliminar el producto');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
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
                    <View style={styles.contentRow}>
                        {/* Info Column (Left) */}
                        <View style={styles.infoColumn}>
                            <Text style={styles.productName}>{item.name}</Text>
                            <View style={styles.detailsRow}>
                                <Text style={[styles.stockBadge, item.current_stock < 5 ? styles.lowStock : styles.goodStock]}>
                                    Stock: {item.current_stock}
                                </Text>
                                <Text style={styles.subtext}>Costo: ${item.cost_price} | Margen: {item.profit_margin_percent}%</Text>
                            </View>
                        </View>

                        {/* Price Column (Right) */}
                        <View style={styles.priceColumn}>
                            <Text style={styles.priceTag}>${item.sale_price}</Text>
                            <TouchableOpacity
                                onPress={() => handleDelete(item)}
                                style={styles.deleteIcon}
                            >
                                <MaterialCommunityIcons name="delete" size={20} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>
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
    contentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    infoColumn: { flex: 1, marginRight: 10 },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    priceColumn: { alignItems: 'flex-end', gap: 4 },
    deleteIcon: { padding: 4 },
    priceTag: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71' },
    detailsRow: { flexDirection: 'column', gap: 2 },
    stockBadge: { fontWeight: '600', fontSize: 13 },
    lowStock: { color: '#e74c3c' },
    goodStock: { color: '#888' },
    subtext: { color: '#666', fontSize: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
    emptySubtext: { fontSize: 14, color: '#444', fontStyle: 'italic', marginTop: 5 }
});
