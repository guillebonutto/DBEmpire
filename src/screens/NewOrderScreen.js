
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewOrderScreen({ navigation }) {
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState('seller');

    // Modals
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [clientModalVisible, setClientModalVisible] = useState(false);

    // New Client Form State
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [clientError, setClientError] = useState(false);
    const [creatingClient, setCreatingClient] = useState(false);

    // Selection State
    const [selectedClient, setSelectedClient] = useState(null);
    const [loading, setLoading] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');

    // Inline Quantity State
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [tempQty, setTempQty] = useState(1);

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setCurrentUserRole(role);
        });
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const productsReq = supabase.from('products').select('*').eq('active', true).order('name');
            const clientsReq = supabase.from('clients').select('*').order('created_at', { ascending: false });

            const [productsRes, clientsRes] = await Promise.all([productsReq, clientsReq]);

            if (productsRes.data) setProducts(productsRes.data);
            if (clientsRes.data) setClients(clientsRes.data || []);
        } catch (e) { console.log(e); }
    };

    const handleAddProductPress = () => {
        if (!selectedClient) {
            setClientError(true);
            return;
        }
        setProductModalVisible(true);
    };

    // Calculate dynamic availability
    const getAvailableStock = (item) => {
        const inCartItem = cart.find(c => c.id === item.id);
        const inCartQty = inCartItem ? inCartItem.qty : 0;
        return (item.current_stock || 0) - inCartQty;
    };

    const initiateProductSelection = (item) => {
        const available = getAvailableStock(item);

        if (available <= 0) {
            Alert.alert('Sin Stock', 'No queda stock disponible para este producto.');
            return;
        }

        setExpandedProductId(item.id);
        setTempQty(1);
    };

    const adjustTempQty = (delta, maxStock) => {
        setTempQty(prev => {
            const newVal = prev + delta;
            if (newVal < 1) return 1;
            if (newVal > maxStock) return maxStock;
            return newVal;
        });
    };

    const confirmAddToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + tempQty } : item);
            }
            return [...prev, { ...product, qty: tempQty }];
        });
        setExpandedProductId(null);
        setTempQty(1);
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const calculateTotals = () => {
        let total = 0;
        let totalProfit = 0;
        cart.forEach(item => {
            const itemTotal = item.sale_price * item.qty;
            const itemCost = item.cost_price * item.qty;
            total += itemTotal;
            totalProfit += (itemTotal - itemCost);
        });
        return { total, totalProfit };
    };

    const { total, totalProfit } = calculateTotals();

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!selectedClient) {
            setClientModalVisible(true);
            return;
        }

        Alert.alert(
            'Confirmar Pedido',
            'Se creará un pedido pendiente de cliente y se reservará el stock.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Crear Pedido', onPress: () => processOrder(selectedClient) }
            ]
        );
    };

    const createClientInline = async (name) => {
        setCreatingClient(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    name: name.trim(),
                    phone: '',
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;

            setClients(prev => [data, ...prev]);
            setSelectedClient(data);
            setSearchQuery('');
        } catch (error) {
            console.log('Error creating client inline:', error);
            Alert.alert('Error', 'No se pudo crear el cliente.');
        } finally {
            setCreatingClient(false);
        }
    };

    const filteredClients = searchQuery.length > 0
        ? clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const processOrder = async (client) => {
        setLoading(true);
        try {
            const { data: profiles } = await supabase.from('profiles').select('id').eq('role', currentUserRole).limit(1);
            let sellerId = profiles && profiles.length > 0 ? profiles[0].id : null;
            if (!sellerId) {
                const { data: allProfiles } = await supabase.from('profiles').select('id').limit(1);
                if (allProfiles && allProfiles.length > 0) sellerId = allProfiles[0].id;
            }

            // Insert Sale with PENDING status
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert({
                    seller_id: sellerId,
                    client_id: client ? client.id : null,
                    total_amount: total,
                    profit_generated: totalProfit,
                    commission_amount: 0, // No commission until completed? Or track it now. Let's track 0 for pending.
                    status: 'pending',
                    tracking_number: trackingNumber || null
                })
                .select()
                .single();

            if (saleError) throw saleError;

            // Insert Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: item.qty,
                unit_price_at_sale: item.sale_price,
                subtotal: item.sale_price * item.qty
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) throw itemsError;

            // Update Stock (Reserve it)
            for (const item of cart) {
                const newStock = (item.current_stock || 0) - item.qty;
                await supabase.from('products').update({ current_stock: newStock }).eq('id', item.id);
            }

            Alert.alert(
                '✅ Pedido Creado',
                `El pedido ha sido guardado y el stock reservado.`,
                [{
                    text: 'OK', onPress: () => {
                        setCart([]);
                        setSelectedClient(null);
                        navigation.goBack();
                    }
                }]
            );

        } catch (error) {
            console.log('Order Error:', error);
            Alert.alert('Error', 'No se pudo crear el pedido.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>NUEVO PEDIDO CLIENTE</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.totalBadge}>
                    <Text style={styles.totalLabel}>TOTAL PEDIDO</Text>
                    <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                    {selectedClient ? (
                        <Text style={styles.clientLabel}>CLIENTE: {selectedClient.name}</Text>
                    ) : (
                        <Text style={[styles.clientLabel, { color: '#888', fontStyle: 'italic' }]}>Seleccione Cliente</Text>
                    )}
                </View>
            </LinearGradient>

            {/* Tracking (Optional) */}
            <View style={styles.trackingContainer}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#d4af37" style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.trackingInput}
                    placeholder="Número de seguimiento (Opcional)"
                    placeholderTextColor="#666"
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                />
            </View>

            {/* Client Search */}
            <View style={styles.searchContainer}>
                {!selectedClient ? (
                    <TouchableOpacity
                        style={styles.searchBar}
                        onPress={() => setClientModalVisible(true)}
                    >
                        <MaterialCommunityIcons name="account-plus" size={24} color="#d4af37" />
                        <Text style={{ color: '#888', marginLeft: 10 }}>Seleccionar Cliente...</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.selectedClientRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.selectedAvatar}>
                                <Text style={{ color: '#000', fontWeight: 'bold' }}>{selectedClient.name.charAt(0)}</Text>
                            </View>
                            <Text style={styles.selectedName}>{selectedClient.name}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedClient(null)}>
                            <MaterialCommunityIcons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
                {clientError && !selectedClient && <Text style={{ color: '#e74c3c', fontSize: 12, marginTop: 5 }}>Requerido</Text>}
            </View>

            <FlatList
                data={cart}
                keyExtractor={item => item.id}
                contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemMeta}>Cant: {item.qty} x ${item.sale_price}</Text>
                        </View>
                        <Text style={styles.itemTotal}>${(item.sale_price * item.qty).toFixed(2)}</Text>
                        <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeBtn}>
                            <MaterialCommunityIcons name="delete-outline" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Lista Vacía</Text>
                        <Text style={styles.emptySubtext}>Agrega productos al pedido</Text>
                    </View>
                }
            />

            <View style={styles.footer}>
                <TouchableOpacity style={styles.addProductBtn} onPress={handleAddProductPress}>
                    <MaterialCommunityIcons name="plus" size={24} color="#000" />
                    <Text style={styles.addProductText}>AÑADIR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.checkoutBtn, cart.length === 0 && styles.disabled]}
                    onPress={handleCheckout}
                    disabled={cart.length === 0 || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <Text style={styles.checkoutText}>GUARDAR PEDIDO</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* PRODUCT MODAL */}
            <Modal visible={productModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Agregar al Pedido</Text>
                    <FlatList
                        data={products}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            const inCartItem = cart.find(c => c.id === item.id);
                            const inCartQty = inCartItem ? inCartItem.qty : 0;
                            const available = (item.current_stock || 0) - inCartQty;
                            const isExpanded = expandedProductId === item.id;

                            return (
                                <View style={[styles.productRow, isExpanded && { borderColor: '#d4af37', borderWidth: 2 }]}>
                                    {!isExpanded ? (
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}
                                            onPress={() => initiateProductSelection(item)}
                                        >
                                            <View>
                                                <Text style={styles.rowTitle}>{item.name}</Text>
                                                <Text style={[styles.rowSubtitle, { color: available < 5 ? '#e74c3c' : '#888' }]}>Disp: {available}</Text>
                                            </View>
                                            <Text style={styles.rowPrice}>${item.sale_price}</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                                                <Text style={styles.rowTitle}>{item.name}</Text>
                                                <Text style={styles.rowPrice}>${item.sale_price}</Text>
                                            </View>
                                            <View style={styles.qtyContainer}>
                                                <TouchableOpacity onPress={() => adjustTempQty(-1, available)} style={styles.qtyBtn}>
                                                    <MaterialCommunityIcons name="minus" size={24} color="#fff" />
                                                </TouchableOpacity>
                                                <Text style={styles.qtyText}>{tempQty}</Text>
                                                <TouchableOpacity onPress={() => adjustTempQty(1, available)} style={styles.qtyBtn}>
                                                    <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                            <View style={{ flexDirection: 'row', marginTop: 15, gap: 10 }}>
                                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#333' }]} onPress={() => setExpandedProductId(null)}>
                                                    <Text style={{ color: '#fff' }}>Cancelar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#d4af37', flex: 1 }]} onPress={() => confirmAddToCart(item)}>
                                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>AGREGAR</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setProductModalVisible(false)}>
                        <Text style={styles.closeText}>Listo</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* CLIENT MODAL (Reused logic) */}
            <Modal visible={clientModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Cliente del Pedido</Text>

                    {/* Simplified Search in Modal */}
                    <TextInput
                        style={styles.input}
                        placeholder="Buscar cliente..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />

                    {searchQuery.length > 0 && filteredClients.length === 0 && (
                        <TouchableOpacity style={styles.createOption} onPress={() => createClientInline(searchQuery)}>
                            <Text style={styles.createText}>Crear "{searchQuery}"</Text>
                        </TouchableOpacity>
                    )}

                    <FlatList
                        data={searchQuery ? filteredClients : clients}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.productRow} onPress={() => {
                                setSelectedClient(item);
                                setClientModalVisible(false);
                            }}>
                                <Text style={styles.rowTitle}>{item.name}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={24} color="#d4af37" />
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setClientModalVisible(false)}>
                        <Text style={styles.closeText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { padding: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { color: '#666', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    totalBadge: { alignItems: 'center', marginTop: 10 },
    totalLabel: { color: '#888', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
    totalAmount: { color: '#d4af37', fontSize: 42, fontWeight: '900' },
    clientLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 5 },

    trackingContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, margin: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
    trackingInput: { flex: 1, color: '#fff', fontSize: 16 },

    searchContainer: { paddingHorizontal: 15, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
    selectedClientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, borderColor: '#d4af37', borderWidth: 1 },
    selectedAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    selectedName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    cartItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    itemMeta: { color: '#888', fontSize: 12 },
    itemTotal: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginHorizontal: 10 },
    removeBtn: { padding: 5 },

    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#666', fontSize: 18, fontWeight: 'bold' },
    emptySubtext: { color: '#444', fontSize: 14 },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 50, backgroundColor: '#1a1a1a', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#333' },
    addProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 10, padding: 15, marginRight: 10 },
    addProductText: { color: '#fff', fontWeight: 'bold', marginLeft: 5 },
    checkoutBtn: { flex: 2, backgroundColor: '#d4af37', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    checkoutText: { color: '#000', fontWeight: '900' },
    disabled: { opacity: 0.5, backgroundColor: '#333' },

    modalContent: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 50 },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#d4af37', marginBottom: 20, textAlign: 'center' },
    productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 20, borderRadius: 12, marginBottom: 10 },
    rowTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    rowSubtitle: { color: '#888', fontSize: 12 },
    rowPrice: { color: '#d4af37', fontSize: 16, fontWeight: 'bold' },

    qtyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', padding: 10, borderRadius: 8 },
    qtyBtn: { backgroundColor: '#333', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    qtyText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },

    smallBtn: { padding: 12, borderRadius: 8, alignItems: 'center' },
    closeBtn: { marginTop: 20, padding: 15, backgroundColor: '#222', borderRadius: 12, alignItems: 'center' },
    closeText: { color: '#888', fontWeight: 'bold' },

    input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 15 },
    createOption: { backgroundColor: '#d4af37', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
    createText: { color: '#000', fontWeight: 'bold' }
});
