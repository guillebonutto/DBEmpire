import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, StatusBar, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ManualStockAdjustmentScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [userRole, setUserRole] = useState('seller');

    useEffect(() => {
        const getRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role) setUserRole(role);
        };
        getRole();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, stock_local, stock_cordoba, current_stock')
                .eq('active', true)
                .order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            console.log(err);
            Alert.alert('Error', 'No se pudieron cargar los productos');
        } finally {
            setLoading(false);
        }
    };

    const updateStock = async (productId, location, delta) => {
        const product = products.find(p => p.id === productId);
        if (!product) return;

        const currentLocal = product.stock_local || 0;
        const currentCordoba = product.stock_cordoba || 0;

        let newLocal = currentLocal;
        let newCordoba = currentCordoba;

        if (location === 'jujuy') {
            newLocal = Math.max(0, currentLocal + delta);
        } else {
            newCordoba = Math.max(0, currentCordoba + delta);
        }

        const newTotal = newLocal + newCordoba;

        // Optimistic update
        setProducts(prev => prev.map(p =>
            p.id === productId
                ? { ...p, stock_local: newLocal, stock_cordoba: newCordoba, current_stock: newTotal }
                : p
        ));

        try {
            const { error } = await supabase
                .from('products')
                .update({
                    stock_local: newLocal,
                    stock_cordoba: newCordoba,
                    current_stock: newTotal
                })
                .eq('id', productId);

            if (error) throw error;
        } catch (err) {
            console.log(err);
            // Rollback on error
            setProducts(prev => prev.map(p =>
                p.id === productId
                    ? product
                    : p
            ));
            Alert.alert('Error', 'No se pudo actualizar el stock en la base de datos');
        }
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const renderItem = ({ item }) => (
        <View style={styles.productCard}>
            <Text style={styles.productName}>{item.name}</Text>

            <View style={styles.locationsRow}>
                {/* JUJUY SECTION */}
                <View style={styles.locationBox}>
                    <Text style={styles.locationTitle}>JUJUY</Text>
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={styles.controlBtn}
                            onPress={() => updateStock(item.id, 'jujuy', -1)}
                        >
                            <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.qtyBox}>
                            <Text style={styles.qtyText}>{item.stock_local || 0}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.controlBtn, { backgroundColor: '#d4af37' }]}
                            onPress={() => updateStock(item.id, 'jujuy', 1)}
                        >
                            <MaterialCommunityIcons name="plus" size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.divider} />

                {/* CORDOBA SECTION */}
                <View style={styles.locationBox}>
                    <Text style={[styles.locationTitle, { color: '#3498db' }]}>CÓRDOBA</Text>
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={styles.controlBtn}
                            onPress={() => updateStock(item.id, 'cordoba', -1)}
                        >
                            <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.qtyBox}>
                            <Text style={styles.qtyText}>{item.stock_cordoba || 0}</Text>
                        </View>

                        <TouchableOpacity
                            style={[styles.controlBtn, { backgroundColor: '#3498db' }]}
                            onPress={() => updateStock(item.id, 'cordoba', 1)}
                        >
                            <MaterialCommunityIcons name="plus" size={20} color="#000" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>AJUSTE DE STOCK</Text>
                <View style={{ width: 44 }} />
            </View>

            <View style={styles.searchBar}>
                <MaterialCommunityIcons name="magnify" size={20} color="#666" style={{ marginLeft: 15 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar producto..."
                    placeholderTextColor="#444"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            {loading ? (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#d4af37" />
                </View>
            ) : (
                <FlatList
                    data={filteredProducts}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    ListEmptyComponent={
                        <Text style={styles.emptyText}>No hay productos para mostrar</Text>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 1 },

    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222',
        height: 50
    },
    searchInput: { flex: 1, color: '#fff', paddingHorizontal: 10 },

    list: { padding: 20, paddingBottom: 50 },
    productCard: {
        backgroundColor: '#0a0a0a',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#1a1a1a'
    },
    productName: { color: '#fff', fontSize: 15, fontWeight: 'bold', marginBottom: 15 },
    locationsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    locationBox: { flex: 1, alignItems: 'center' },
    locationTitle: { fontSize: 10, fontWeight: '900', color: '#666', marginBottom: 10, letterSpacing: 1 },
    controls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    controlBtn: { width: 32, height: 32, backgroundColor: '#222', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    qtyBox: { width: 40, alignItems: 'center' },
    qtyText: { color: '#fff', fontSize: 18, fontWeight: '900' },
    divider: { width: 1, height: 40, backgroundColor: '#1a1a1a' },

    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#444', textAlign: 'center', marginTop: 50, fontWeight: 'bold' }
});
