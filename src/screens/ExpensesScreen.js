import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';

const CATEGORIAS_GASTOS = ['General', 'Alquiler', 'Servicios', 'Marketing', 'Inventario', 'Salarios', 'Otro'];

export default function ExpensesScreen({ navigation }) {
    const [viewMode, setViewMode] = useState('expenses'); // 'expenses' | 'purchases'

    // Expenses State
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');

    // Purchases (Supplier Orders) State
    const [orders, setOrders] = useState([]);

    const fetchExpenses = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setExpenses(data || []);
        } catch (error) {
            console.log('Error al cargar gastos:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_orders')
                .select('*, supplier_order_items(id, product_id, quantity, cost_per_unit, products(name))')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            if (viewMode === 'expenses') fetchExpenses();
            else fetchOrders();
        }, [viewMode])
    );

    // --- EXPENSES LOGIC ---
    const handleAddExpense = async () => {
        if (!description || !amount) {
            Alert.alert('Error', 'La descripción y el monto son obligatorios');
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            Alert.alert('Error', 'Ingresa un monto válido');
            return;
        }

        setAdding(true);
        try {
            const { error } = await supabase
                .from('expenses')
                .insert({
                    description: description.trim(),
                    amount: numAmount,
                    category
                });

            if (error) throw error;

            Alert.alert('✅ Éxito', 'Gasto registrado correctamente');
            setDescription('');
            setAmount('');
            setCategory('General');
            fetchExpenses();
        } catch (error) {
            console.log('Error al agregar gasto:', error);
            Alert.alert('Error', 'No se pudo guardar el gasto: ' + error.message);
        } finally {
            setAdding(false);
        }
    };

    const handleDeleteExpense = async (id) => {
        Alert.alert(
            'Confirmar Eliminación',
            '¿Estás seguro de que quieres eliminar este gasto?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase.from('expenses').delete().eq('id', id);
                            if (error) throw error;
                            fetchExpenses();
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo eliminar el gasto');
                        }
                    }
                }
            ]
        );
    };

    // --- PURCHASES (SUPPLIER ORDERS) LOGIC ---
    const handlePayInstallment = async (item) => {
        const currentPaid = item.installments_paid || 0;
        const total = item.installments_total || 1;

        if (currentPaid >= total) return;

        const { error } = await supabase
            .from('supplier_orders')
            .update({ installments_paid: currentPaid + 1 })
            .eq('id', item.id);

        if (error) {
            Alert.alert('Error', 'No se pudo actualizar la cuota');
        } else {
            fetchOrders();
        }
    };

    const handleReceiveOrder = async (order) => {
        if (order.status === 'received') return;

        Alert.alert('Recibir Mercadería', '¿Confirmar que llegó el pedido? Se sumará el stock automáticamente.', [
            { text: 'Cancelar' },
            {
                text: 'Confirmar',
                onPress: async () => {
                    setLoading(true);
                    try {
                        // 1. Update Stock
                        if (order.supplier_order_items && order.supplier_order_items.length > 0) {
                            for (const item of order.supplier_order_items) {
                                if (item.product_id) {
                                    const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
                                    if (prod) {
                                        const newStock = (prod.current_stock || 0) + (item.quantity || 0);
                                        await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
                                    }
                                }
                            }
                        }

                        // 2. Mark as Received
                        const { error } = await supabase
                            .from('supplier_orders')
                            .update({ status: 'received' })
                            .eq('id', order.id);

                        if (error) throw error;

                        Alert.alert('✅ Recibido', 'Stock actualizado.');
                        fetchOrders();
                    } catch (err) {
                        Alert.alert('Error', 'Falló la recepción: ' + err.message);
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    const handleDeleteOrder = (id) => {
        Alert.alert('Eliminar', '¿Borrar este pedido del historial?', [
            { text: 'Cancelar' },
            {
                text: 'Borrar',
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('supplier_orders').delete().eq('id', id);
                    fetchOrders();
                }
            }
        ]);
    };

    const handleTrack = (trackingNumber) => {
        if (!trackingNumber) return;
        const url = `https://t.17track.net/en#nums=${trackingNumber}`;
        Linking.openURL(url);
    };

    // --- RENDER ITEMS ---
    const renderExpenseItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.categoryBadge}>{item.category}</Text>
                <Text style={styles.dateText}>
                    {new Date(item.created_at).toLocaleDateString('es-ES')}
                </Text>
            </View>
            <View style={styles.cardBody}>
                <Text style={styles.description}>{item.description}</Text>
                <Text style={styles.amount}>-${parseFloat(item.amount).toFixed(2)}</Text>
            </View>
            <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteExpense(item.id)}>
                <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
        </View>
    );

    const renderOrderItem = ({ item }) => (
        <View style={styles.orderCard}>
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name={item.status === 'received' ? "check-decagram" : "cube-send"} size={24} color={item.status === 'received' ? "#2ecc71" : "#d4af37"} style={{ marginRight: 10 }} />
                    <View>
                        <Text style={styles.providerName}>{item.provider_name}</Text>
                        <Text style={[styles.date, { color: item.status === 'received' ? '#2ecc71' : '#666' }]}>
                            {item.status === 'received' ? 'RECIBIDO' : 'PENDIENTE'}
                        </Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => handleDeleteOrder(item.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#666" />
                </TouchableOpacity>
            </View>

            {/* Linked Items List */}
            {item.supplier_order_items && item.supplier_order_items.length > 0 ? (
                <View style={styles.itemsList}>
                    {item.supplier_order_items.map((prod, idx) => (
                        <Text key={idx} style={styles.itemText}>
                            • {prod.products?.name} (x{prod.quantity})
                        </Text>
                    ))}
                </View>
            ) : (
                <Text style={styles.desc}>{item.items_description}</Text>
            )}

            {item.total_cost > 0 && <Text style={styles.cost}>Costo: ${item.total_cost}</Text>}

            {/* Installments Section */}
            {item.installments_total > 1 && (
                <View style={styles.installmentContainer}>
                    <View>
                        <Text style={styles.installmentText}>
                            Cuotas: <Text style={{ color: '#fff' }}>{item.installments_paid || 0}/{item.installments_total}</Text>
                        </Text>
                        <Text style={styles.installmentText}>
                            Restantes: <Text style={{ color: '#e74c3c' }}>{item.installments_total - (item.installments_paid || 0)}</Text>
                        </Text>
                    </View>
                    {(item.installments_paid || 0) < item.installments_total && (
                        <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handlePayInstallment(item)}
                        >
                            <Text style={styles.payBtnText}>PAGAR CUOTA</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Receive Button */}
            {item.status !== 'received' && (
                <TouchableOpacity style={styles.receiveBtn} onPress={() => handleReceiveOrder(item)}>
                    <Text style={styles.receiveBtnText}>MARCAR COMO RECIBIDO (+ STOCK)</Text>
                </TouchableOpacity>
            )}

            {/* Tracking Section */}
            {item.tracking_number ? (
                <TouchableOpacity style={styles.trackRow} onPress={() => handleTrack(item.tracking_number)}>
                    <MaterialCommunityIcons name="radar" size={20} color="#3498db" />
                    <Text style={styles.trackText}>{item.tracking_number}</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#666" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            ) : null}

            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>ADMINISTRACIÓN</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Tabs */}
                <View style={styles.tabContainer}>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'expenses' && styles.activeTab]}
                        onPress={() => setViewMode('expenses')}
                    >
                        <Text style={[styles.tabText, viewMode === 'expenses' && styles.activeTabText]}>GASTOS</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, viewMode === 'purchases' && styles.activeTab]}
                        onPress={() => setViewMode('purchases')}
                    >
                        <Text style={[styles.tabText, viewMode === 'purchases' && styles.activeTabText]}>COMPRAS</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* EXPENSES VIEW */}
            {viewMode === 'expenses' && (
                <>
                    <View style={styles.formContainer}>
                        <Text style={styles.sectionTitle}>Nuevo Gasto</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Descripción (ej. Factura de Internet)"
                            placeholderTextColor="#666"
                            value={description}
                            onChangeText={setDescription}
                        />
                        <View style={styles.row}>
                            <TextInput
                                style={[styles.input, { flex: 1, marginRight: 10 }]}
                                placeholder="Monto ($)"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />
                            <TouchableOpacity style={styles.categorySelector}>
                                <Text style={styles.categoryText}>{category}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Category Pills */}
                        <View style={styles.categoryList}>
                            {CATEGORIAS_GASTOS.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    style={[styles.catPill, category === cat && styles.catPillActive]}
                                    onPress={() => setCategory(cat)}
                                >
                                    <Text style={[styles.catPillText, category === cat && styles.catPillTextActive]}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={handleAddExpense}
                            disabled={adding}
                        >
                            {adding ? <ActivityIndicator color="#000" /> : <Text style={styles.addButtonText}>AGREGAR GASTO</Text>}
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={expenses}
                        keyExtractor={item => item.id}
                        renderItem={renderExpenseItem}
                        contentContainerStyle={styles.listContent}
                        ListHeaderComponent={<Text style={styles.listTitle}>Historial Reciente</Text>}
                        ListEmptyComponent={<Text style={styles.emptyText}>No hay gastos registrados</Text>}
                        refreshControl={
                            <RefreshControl refreshing={loading} onRefresh={fetchExpenses} tintColor="#d4af37" colors={['#d4af37']} />
                        }
                    />
                </>
            )}

            {/* PURCHASES VIEW */}
            {viewMode === 'purchases' && (
                <>
                    <View style={styles.actionContainer}>
                        <TouchableOpacity
                            style={styles.newOrderBtn}
                            onPress={() => navigation.navigate('NewSupplierOrder')}
                        >
                            <LinearGradient colors={['#d4af37', '#b8942e']} style={styles.btnGradient}>
                                <MaterialCommunityIcons name="plus" size={24} color="#000" />
                                <Text style={styles.newOrderText}>NUEVA ORDEN DE COMPRA</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={orders}
                        keyExtractor={item => item.id}
                        renderItem={renderOrderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={<Text style={styles.emptyText}>No hay órdenes de compra.</Text>}
                        refreshControl={
                            <RefreshControl refreshing={loading} onRefresh={fetchOrders} tintColor="#d4af37" colors={['#d4af37']} />
                        }
                    />
                </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: {
        paddingTop: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 15
    },
    backButton: { padding: 5 },
    headerTitle: { fontSize: 18, fontWeight: '900', color: '#d4af37', letterSpacing: 2 },

    tabContainer: { flexDirection: 'row' },
    tab: { flex: 1, paddingVertical: 15, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: '#d4af37' },
    tabText: { color: '#666', fontWeight: 'bold', letterSpacing: 1 },
    activeTabText: { color: '#d4af37', fontWeight: '900' },

    formContainer: {
        padding: 20,
        backgroundColor: '#111',
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    sectionTitle: { color: '#d4af37', fontSize: 14, marginBottom: 15, fontWeight: '900', letterSpacing: 1 },
    input: {
        backgroundColor: '#222',
        color: '#fff',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
        fontSize: 16
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    categoryList: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 15 },
    catPill: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1e1e1e',
        marginRight: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#333'
    },
    catPillActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    catPillText: { color: '#888', fontSize: 12, fontWeight: '600' },
    catPillTextActive: { color: '#000', fontWeight: '900' },

    addButton: {
        backgroundColor: '#d4af37',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
    },
    addButtonText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

    categorySelector: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 15,
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        height: 52,
        borderWidth: 1,
        borderColor: '#333'
    },
    categoryText: {
        color: '#d4af37',
        fontWeight: 'bold',
        fontSize: 14
    },

    listContent: { padding: 20, paddingBottom: 100 },
    listTitle: { color: '#888', marginBottom: 15, fontSize: 12, textTransform: 'uppercase', fontWeight: '900', letterSpacing: 1 },
    emptyText: { textAlign: 'center', color: '#666', marginTop: 50, fontStyle: 'italic' },

    card: {
        backgroundColor: '#1e1e1e',
        borderRadius: 15,
        padding: 20,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#333'
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    categoryBadge: { color: '#d4af37', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    dateText: { color: '#666', fontSize: 12 },
    cardBody: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    description: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1 },
    amount: { color: '#e74c3c', fontSize: 20, fontWeight: '900' },
    deleteButton: { alignSelf: 'flex-end' },
    deleteText: { color: '#666', fontSize: 13, fontWeight: '600' },

    // Purchases Styles
    actionContainer: { padding: 20 },
    newOrderBtn: { borderRadius: 12, overflow: 'hidden' },
    btnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, gap: 10 },
    newOrderText: { color: '#000', fontWeight: '900', letterSpacing: 1 },

    orderCard: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    providerName: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    desc: { color: '#ccc', marginBottom: 10, fontSize: 14 },
    cost: { color: '#fff', fontWeight: 'bold', marginBottom: 10 },
    installmentContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2c3e50', padding: 10, borderRadius: 8, marginBottom: 10 },
    installmentText: { color: '#bdc3c7', fontSize: 12, fontWeight: 'bold' },
    payBtn: { backgroundColor: '#27ae60', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
    payBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    receiveBtn: { backgroundColor: '#333', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#2ecc71' },
    receiveBtnText: { color: '#2ecc71', fontWeight: '900', fontSize: 12, letterSpacing: 1 },
    itemsList: { marginBottom: 10, padding: 10, backgroundColor: '#111', borderRadius: 8 },
    itemText: { color: '#ccc', fontSize: 13, marginBottom: 2 },
    trackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 15, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#333' },
    trackText: { color: '#3498db', marginLeft: 10, fontWeight: '600', letterSpacing: 1 },
    date: { color: '#666', fontSize: 12 }
});
