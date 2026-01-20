import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const INCIDENT_TYPES = [
    { id: 'faltante_caja', label: 'Faltó plata', icon: 'cash-remove', color: '#e74c3c' },
    { id: 'devolucion_producto', label: 'Producto devuelto', icon: 'package-variant-minus', color: '#3498db' },
    { id: 'queja_cliente', label: 'Cliente se quejó', icon: 'account-alert', color: '#f1c40f' },
    { id: 'otro', label: 'Otro', icon: 'dots-horizontal-circle', color: '#95a5a6' }
];

const RETURN_REASONS = [
    { id: 'no_gusto', label: 'No le gustó (Reponer Stock)', icon: 'thumb-down', restock: true },
    { id: 'danado', label: 'Vino roto/dañado (Tirar)', icon: 'delete', restock: false }
];

export default function IncidentsScreen({ navigation }) {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [type, setType] = useState('faltante_caja');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    // Devolución specifics
    const [returnReason, setReturnReason] = useState('no_gusto');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);

    // Sale & Client tracking
    const [selectedSale, setSelectedSale] = useState(null);
    const [recentSales, setRecentSales] = useState([]);
    const [loadingSales, setLoadingSales] = useState(false);

    // Dynamic Logic
    const showAmount = type === 'faltante_caja' || type === 'devolucion_producto';
    const showReturnOptions = type === 'devolucion_producto';

    useFocusEffect(
        useCallback(() => {
            const checkRole = async () => {
                const role = await AsyncStorage.getItem('user_role');
                if (role !== 'admin') {
                    Alert.alert('Acceso Denegado', 'Esta sección es confidencial.');
                    navigation.navigate('Home');
                }
            };
            checkRole();
            fetchIncidents();
        }, [])
    );

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('incidents')
                .select('*, clients(name, phone), products(name), sales(total_amount)')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setIncidents(data || []);
        } catch (error) {
            console.log('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchRecentSales = async (productId) => {
        setLoadingSales(true);
        try {
            const { data } = await supabase
                .from('sales')
                .select(`
                    id,
                    created_at,
                    total_amount,
                    clients(id, name, phone),
                    sale_items!inner(product_id, quantity, unit_price)
                `)
                .eq('sale_items.product_id', productId)
                .order('created_at', { ascending: false })
                .limit(10);

            setRecentSales(data || []);
        } catch (e) {
            console.log('Error fetching sales:', e);
        } finally {
            setLoadingSales(false);
        }
    };

    const searchProducts = async (query) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setSearchResults([]);
            return;
        }

        setSearching(true);
        try {
            const { data } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(5);
            setSearchResults(data || []);
        } catch (e) { console.log(e) }
        finally { setSearching(false); }
    };

    const handleSaveIncident = async () => {
        if (!description && type !== 'faltante_caja' && type !== 'devolucion_producto') {
            Alert.alert('Error', 'La descripción es obligatoria');
            return;
        }

        if (showAmount && !amount) {
            Alert.alert('Error', 'El monto es obligatorio para este tipo de reporte.');
            return;
        }

        if (type === 'devolucion_producto' && !selectedProduct) {
            Alert.alert('Error', 'Selecciona qué producto devolvieron para ajustar el stock.');
            return;
        }

        if (type === 'devolucion_producto' && !selectedSale) {
            Alert.alert('Error', 'Selecciona de qué venta viene esta devolución para hacer seguimiento del cliente.');
            return;
        }

        setAdding(true);
        try {
            const clientName = selectedSale?.clients?.name || 'Cliente desconocido';
            const finalDesc = type === 'devolucion_producto'
                ? `Devolución: ${selectedProduct.name} - ${returnReason === 'no_gusto' ? 'No le gustó' : 'Dañado'}. Cliente: ${clientName}. ${description}`
                : description.trim() || (type === 'faltante_caja' ? 'Faltante de caja' : 'Incidente reportado');

            // 1. Create Incident Report
            const { error } = await supabase
                .from('incidents')
                .insert({
                    type,
                    description: finalDesc,
                    amount: parseFloat(amount) || 0,
                    sale_id: selectedSale?.id || null,
                    client_id: selectedSale?.clients?.id || null,
                    product_id: selectedProduct?.id || null,
                    created_at: new Date().toISOString()
                });
            if (error) throw error;

            // 2. Logic for Money Deduction (Expense)
            if (showAmount) {
                await supabase.from('expenses').insert({
                    description: `[AUTO-GENERADO] ${type === 'faltante_caja' ? 'Faltante de Caja' : 'Reembolso por Devolución'}`,
                    amount: parseFloat(amount),
                    category: 'Otro',
                    date: new Date().toISOString()
                });
            }

            // 3. Logic for Stock Restock
            if (type === 'devolucion_producto' && returnReason === 'no_gusto' && selectedProduct) {
                const { error: stockError } = await supabase.rpc('increment_stock', { p_id: selectedProduct.id, quantity: 1 });
                if (stockError) {
                    // Fallback if RPC doesn't exist, though typically used. Assuming direct update works too if no RPC.
                    // But let's assume direct update for safety if RPC fails or not exists.
                    await supabase
                        .from('products')
                        .update({ stock: selectedProduct.stock + 1 })
                        .eq('id', selectedProduct.id);
                }
            }

            Alert.alert('✅ Procesado', 'Incidente guardado. Caja y stock actualizados según corresponda.');
            setDescription('');
            setAmount('');
            setSelectedProduct(null);
            setSelectedSale(null);
            setRecentSales([]);
            setSearchQuery('');
            fetchIncidents();
        } catch (error) {
            Alert.alert('Error', 'No se pudo procesar el incidente completely.');
            console.log(error);
        } finally {
            setAdding(false);
        }
    };

    const renderHeader = () => (
        <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>REGISTRO DE INCIDENTES</Text>
                <View style={{ width: 40 }} />
            </View>
        </LinearGradient>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {renderHeader()}

            <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.label}>TIPO DE INCIDENTE:</Text>
                <View style={styles.typeGrid}>
                    {INCIDENT_TYPES.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.typeCard,
                                type === item.id && { borderColor: item.color, backgroundColor: `${item.color}20` }
                            ]}
                            onPress={() => setType(item.id)}
                        >
                            <MaterialCommunityIcons name={item.icon} size={24} color={type === item.id ? item.color : '#666'} />
                            <Text style={[styles.typeLabel, type === item.id && { color: item.color }]}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {showReturnOptions && (
                    <View style={styles.returnSection}>
                        <Text style={styles.label}>MOTIVO DE DEVOLUCIÓN:</Text>
                        <View style={styles.tabContainer}>
                            {RETURN_REASONS.map(r => (
                                <TouchableOpacity
                                    key={r.id}
                                    style={[styles.tab, returnReason === r.id && { backgroundColor: r.restock ? '#2ecc71' : '#e74c3c' }]}
                                    onPress={() => setReturnReason(r.id)}
                                >
                                    <MaterialCommunityIcons name={r.icon} size={20} color="white" />
                                    <View>
                                        <Text style={styles.tabTitle}>{r.label}</Text>
                                        <Text style={styles.tabSubtitle}>{r.restock ? '+ RESTAURA STOCK' : '❌ NO RESTAURA STOCK'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={styles.label}>PRODUCTO A DEVOLVER:</Text>
                        {!selectedProduct ? (
                            <View>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Buscar producto..."
                                    placeholderTextColor="#666"
                                    value={searchQuery}
                                    onChangeText={searchProducts}
                                />
                                {searchResults.length > 0 && (
                                    <View style={styles.searchResults}>
                                        {searchResults.map(p => (
                                            <TouchableOpacity key={p.id} style={styles.resultItem} onPress={() => {
                                                setSelectedProduct(p);
                                                setSearchResults([]);
                                                setSearchQuery('');
                                                fetchRecentSales(p.id);
                                            }}>
                                                <Text style={{ color: 'white' }}>{p.name}</Text>
                                                <Text style={{ color: '#666' }}>${p.price}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View>
                                <View style={styles.selectedProductBadge}>
                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{selectedProduct.name}</Text>
                                    <TouchableOpacity onPress={() => { setSelectedProduct(null); setSelectedSale(null); setRecentSales([]); }}>
                                        <MaterialCommunityIcons name="close-circle" size={24} color="#e74c3c" />
                                    </TouchableOpacity>
                                </View>

                                <Text style={[styles.label, { marginTop: 15 }]}>¿DE QUÉ VENTA VIENE?</Text>
                                {loadingSales ? (
                                    <ActivityIndicator color="#d4af37" style={{ marginVertical: 10 }} />
                                ) : recentSales.length === 0 ? (
                                    <Text style={{ color: '#666', fontStyle: 'italic', marginBottom: 15, padding: 10 }}>No hay ventas recientes de este producto</Text>
                                ) : (
                                    <View style={styles.salesList}>
                                        {recentSales.map(sale => (
                                            <TouchableOpacity
                                                key={sale.id}
                                                style={[styles.saleItem, selectedSale?.id === sale.id && { borderColor: '#2ecc71', backgroundColor: 'rgba(46, 204, 113, 0.1)' }]}
                                                onPress={() => setSelectedSale(sale)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={{ color: 'white', fontWeight: 'bold' }}>{sale.clients?.name || 'Sin cliente'}</Text>
                                                    <Text style={{ color: '#666', fontSize: 12 }}>{new Date(sale.created_at).toLocaleDateString()}</Text>
                                                    {sale.clients?.phone && <Text style={{ color: '#888', fontSize: 11 }}>{sale.clients.phone}</Text>}
                                                </View>
                                                <Text style={{ color: '#d4af37' }}>${sale.total_amount}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </View>
                        )}
                    </View>
                )}

                <Text style={styles.label}>DESCRIPCIÓN (DETALLES):</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Explica qué pasó..."
                    placeholderTextColor="#666"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                />

                {showAmount && (
                    <>
                        <Text style={styles.label}>DINERO A RESTAR DE CAJA:</Text>
                        <TextInput
                            style={[styles.input, { borderColor: '#e74c3c', color: '#e74c3c', fontWeight: 'bold' }]}
                            placeholder="Monto ($)"
                            placeholderTextColor="#666"
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="numeric"
                        />
                    </>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveIncident} disabled={adding}>
                    {adding ? <ActivityIndicator color="black" /> : (
                        <>
                            <MaterialCommunityIcons name="alert-circle-check" size={24} color="black" />
                            <Text style={styles.saveBtnText}>REPORTAR NOVEDAD</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>ÚLTIMOS REPORTES</Text>

                {loading ? (
                    <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} />
                ) : (
                    incidents.map((item, index) => {
                        const typeInfo = INCIDENT_TYPES.find(t => t.id === item.type) || INCIDENT_TYPES[3];
                        return (
                            <View key={item.id} style={styles.incidentCard}>
                                <View style={[styles.iconBadge, { backgroundColor: `${typeInfo.color}20` }]}>
                                    <MaterialCommunityIcons name={typeInfo.icon} size={20} color={typeInfo.color} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 15 }}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardType}>{typeInfo.label.toUpperCase()}</Text>
                                        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.cardDesc}>{item.description}</Text>
                                    {item.amount > 0 && <Text style={styles.cardAmount}>Monto: ${item.amount}</Text>}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    backBtn: { padding: 5 },

    form: { padding: 20 },
    label: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    typeCard: { width: '48%', backgroundColor: '#111', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222', gap: 8 },
    typeLabel: { color: '#666', fontSize: 12, fontWeight: 'bold' },

    input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
    textArea: { height: 100, textAlignVertical: 'top' },

    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },

    divider: { height: 1, backgroundColor: '#222', marginVertical: 30 },
    sectionTitle: { color: '#d4af37', fontSize: 14, fontWeight: '900', marginBottom: 20, letterSpacing: 2 },

    incidentCard: { backgroundColor: '#111', padding: 15, borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#222' },
    iconBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    cardType: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    cardDate: { color: '#666', fontSize: 10 },
    cardDesc: { color: '#aaa', fontSize: 14, lineHeight: 20 },
    cardAmount: { color: '#e74c3c', fontSize: 12, fontWeight: 'bold', marginTop: 5 },

    returnSection: { marginBottom: 20, backgroundColor: '#1a1a1a', padding: 10, borderRadius: 10 },
    tabContainer: { gap: 10, marginBottom: 20 },
    tab: { flexDirection: 'row', padding: 15, borderRadius: 8, backgroundColor: '#333', alignItems: 'center', gap: 15 },
    tabTitle: { color: 'white', fontWeight: 'bold' },
    tabSubtitle: { color: 'rgba(255,255,255,0.7)', fontSize: 10 },
    searchResults: { backgroundColor: '#222', borderRadius: 8, marginTop: -15, marginBottom: 15 },
    resultItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333', flexDirection: 'row', justifyContent: 'space-between' },
    selectedProductBadge: { backgroundColor: '#2ecc71', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    salesList: { gap: 10, marginBottom: 20 },
    saleItem: { backgroundColor: '#222', padding: 15, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#333' }
});
