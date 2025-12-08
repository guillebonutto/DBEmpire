import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function NewSaleScreen({ navigation }) {
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState('seller');

    // Modals
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [clientModalVisible, setClientModalVisible] = useState(false);

    // Selection State
    const [selectedClient, setSelectedClient] = useState(null);
    const [loading, setLoading] = useState(false);
    const [commissionRate, setCommissionRate] = useState(0.10);

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setCurrentUserRole(role);
        });
        fetchData();
        fetchCommissionRate();
    }, []);

    const fetchCommissionRate = async () => {
        try {
            const { data } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'commission_rate')
                .single();

            if (data) {
                setCommissionRate(parseFloat(data.value));
            }
        } catch (error) {
            console.log('Using default commission rate:', error);
        }
    };

    const fetchData = async () => {
        try {
            const productsReq = supabase.from('products').select('*');
            const clientsReq = supabase.from('clients').select('*');

            const [productsRes, clientsRes] = await Promise.all([productsReq, clientsReq]);

            if (productsRes.data) setProducts(productsRes.data);
            if (clientsRes.data) setClients(clientsRes.data);
        } catch (e) { console.log(e); }
    };

    const addToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
            }
            return [...prev, { ...product, qty: 1 }];
        });
        setProductModalVisible(false);
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
        const commission = currentUserRole === 'seller' ? totalProfit * commissionRate : 0;
        return { total, totalProfit, commission };
    };

    const { total, totalProfit, commission } = calculateTotals();

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!selectedClient) {
            Alert.alert(
                'Sin Cliente',
                'No has seleccionado un cliente. ¿Deseas registrarla como Venta Anónima?',
                [
                    { text: 'Seleccionar Cliente', onPress: () => setClientModalVisible(true) },
                    { text: 'Continuar Anónimo', onPress: () => processCheckout(null) }
                ]
            );
        } else {
            processCheckout(selectedClient);
        }
    };

    const processCheckout = async (client) => {
        setLoading(true);
        try {
            // 1. Get current user ID (mocked as anon since we are using simplified auth)
            // In a real app we would use: const { data: { user } } = await supabase.auth.getUser();
            // But since we rely on 'user_role' local storage and we inserted profiles manually or triggered them, 
            // we will need a valid uuid for the 'seller_id'. 
            // For MVP simplicity without login, we need to fetch ANY profile or the specific one.
            // Let's assume there's at least one profile or we create a fallback one.

            // Allow insert without foreign key constraint issues if possible, BUT our schema enforces seller_id.
            // Let's look up a profile based on role (Just picking the first match for MVP demo)
            const { data: profiles } = await supabase.from('profiles').select('id').eq('role', currentUserRole).limit(1);
            let sellerId = profiles && profiles.length > 0 ? profiles[0].id : null;

            // Fallback: If no profile exists yet (clean DB), we might need to handle this. 
            // But usually the user ran the setup script which might be empty of profiles until they sign up.
            // Actually, the setup script creates profiles on AUTH events. 
            // CRITICAL: If the user hasn't "Signed Up" via Supabase Auth, they have no Profile ID.
            // FIX: We will modify the query to get ANY profile, or if none, we can't save.
            // However, to unblock the user immediately, we can try to find *any* profile or insert a dummy one if needed? 
            // Better approach: Let's just try to get the first available profile, if not, create a dummy fallback in code is hard.
            // We will assumed the used created an account or we will use a known UUID if we could.
            // Let's just try to fetch the first profile.

            if (!sellerId) {
                const { data: allProfiles } = await supabase.from('profiles').select('id').limit(1);
                if (allProfiles && allProfiles.length > 0) sellerId = allProfiles[0].id;
            }

            // 2. Insert Sale
            const { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert({
                    seller_id: sellerId, // This might fail if DB is empty of users. 
                    client_id: client ? client.id : null,
                    total_amount: total,
                    profit_generated: totalProfit,
                    commission_amount: commission,
                    status: 'completed'
                })
                .select()
                .single();

            if (saleError) throw saleError;

            // 3. Insert Sale Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: item.qty,
                unit_price_at_sale: item.sale_price,
                subtotal: item.sale_price * item.qty
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) throw itemsError;

            // 4. Update Stock (Optional for MVP but recommended)
            for (const item of cart) {
                // We simply decrement. Concurrency issues ignored for MVP.
                const newStock = (item.current_stock || 0) - item.qty;
                await supabase.from('products').update({ current_stock: newStock }).eq('id', item.id);
            }

            Alert.alert(
                'Venta Registrada',
                `Total: $${total.toFixed(2)}\nCliente: ${client ? client.name : 'Anónimo'}\n\nSe ha guardado en la nube.`,
                [{
                    text: 'OK', onPress: () => {
                        setCart([]);
                        setSelectedClient(null);
                        navigation.navigate('Sales'); // Go to Dashboard/Report
                    }
                }]
            );

        } catch (error) {
            console.log('Checkout Error:', error);
            Alert.alert('Error', 'No se pudo guardar la venta. Verifica tu conexión o que existan usuarios (vendedores) en la base de datos.');
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#666" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>NUEVA VENTA</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.totalBadge}>
                <Text style={styles.totalLabel}>TOTAL A COBRAR</Text>
                <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                {currentUserRole === 'seller' && (
                    <Text style={styles.commissionLabel}>COMISIÓN: ${commission.toFixed(2)}</Text>
                )}
            </View>
        </LinearGradient>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {renderHeader()}

            <View style={styles.actionRow}>
                <TouchableOpacity
                    style={[styles.clientButton, selectedClient && styles.clientSelected]}
                    onPress={() => setClientModalVisible(true)}
                >
                    <MaterialCommunityIcons
                        name={selectedClient ? "account-check" : "account-search"}
                        size={24}
                        color={selectedClient ? "#000" : "#d4af37"}
                    />
                    <Text style={[styles.clientButtonText, selectedClient && styles.clientSelectedText]}>
                        {selectedClient ? selectedClient.name : "Vincular Cliente"}
                    </Text>
                    {selectedClient && (
                        <TouchableOpacity onPress={() => setSelectedClient(null)}>
                            <MaterialCommunityIcons name="close-circle" size={20} color="#000" style={{ marginLeft: 10 }} />
                        </TouchableOpacity>
                    )}
                </TouchableOpacity>
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
                        <MaterialCommunityIcons name="cart-off" size={60} color="#333" />
                        <Text style={styles.emptyText}>Bolsa Vacía</Text>
                        <Text style={styles.emptySubtext}>Añade productos del inventario</Text>
                    </View>
                }
            />

            <View style={styles.footer}>
                <TouchableOpacity style={styles.addProductBtn} onPress={() => setProductModalVisible(true)}>
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
                        <Text style={styles.checkoutText}>COBRAR ${total.toFixed(2)}</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* PRODUCT MODAL */}
            <Modal visible={productModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Seleccionar Producto</Text>
                    <FlatList
                        data={products}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.productRow} onPress={() => addToCart(item)}>
                                <View>
                                    <Text style={styles.rowTitle}>{item.name}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <Text style={[styles.rowSubtitle, { color: item.current_stock < 5 ? '#e74c3c' : '#888' }]}>
                                            Stock: {item.current_stock || 0}
                                        </Text>
                                    </View>
                                </View>
                                <Text style={styles.rowPrice}>${item.sale_price}</Text>
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setProductModalVisible(false)}>
                        <Text style={styles.closeText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* CLIENT MODAL */}
            <Modal visible={clientModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Cartera de Clientes</Text>
                    <FlatList
                        data={clients}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.productRow} onPress={() => {
                                setSelectedClient(item);
                                setClientModalVisible(false);
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.avatar}>
                                        <Text style={{ color: 'black', fontWeight: 'bold' }}>{item.name.charAt(0)}</Text>
                                    </View>
                                    <Text style={styles.rowTitle}>{item.name}</Text>
                                </View>
                                <MaterialCommunityIcons name="check-circle-outline" size={24} color="#d4af37" />
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>No hay clientes registrados.</Text>}
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

    header: { padding: 20, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { color: '#666', fontSize: 14, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
    totalBadge: { alignItems: 'center', marginTop: 10 },
    totalLabel: { color: '#888', fontSize: 10, letterSpacing: 2, fontWeight: '900', marginBottom: 5 },
    totalAmount: { color: '#d4af37', fontSize: 48, fontWeight: '900' }, // Huge Gold
    commissionLabel: { color: '#2ecc71', marginTop: 5, fontWeight: 'bold', fontSize: 12, letterSpacing: 1 },

    actionRow: { padding: 15 },
    clientButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333', justifyContent: 'center' },
    clientButtonText: { marginLeft: 10, fontSize: 16, color: '#ccc', fontWeight: '600', letterSpacing: 0.5 },
    clientSelected: { borderColor: '#d4af37', backgroundColor: '#d4af37' }, // Gold Background for active
    clientSelectedText: { color: 'black', fontWeight: 'bold' },

    cartItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    itemMeta: { color: '#888', fontSize: 12, marginTop: 4 },
    itemTotal: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginHorizontal: 15 },
    removeBtn: { padding: 5 },

    emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
    emptyText: { fontSize: 18, fontWeight: '900', marginTop: 10, color: '#666' },
    emptySubtext: { fontSize: 14, color: '#444' },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#1a1a1a', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row' },
    addProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ccc', borderRadius: 10, padding: 15, marginRight: 10 },
    addProductText: { marginLeft: 5, color: '#000', fontWeight: '900', letterSpacing: 0.5 },
    checkoutBtn: { flex: 2, backgroundColor: '#d4af37', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#d4af37', shadowOpacity: 0.3, elevation: 10 },
    disabled: { backgroundColor: '#333' },
    checkoutText: { color: 'black', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

    // Modals
    modalContent: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 40 },
    modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20, color: '#d4af37', textAlign: 'center', letterSpacing: 1 },
    productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 20, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    rowTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    rowSubtitle: { color: '#888', marginTop: 4, fontSize: 12 },
    rowPrice: { fontSize: 18, fontWeight: 'bold', color: '#d4af37' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    closeBtn: { marginTop: 20, padding: 15, backgroundColor: '#222', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    closeText: { color: '#888', fontWeight: 'bold' }
});
