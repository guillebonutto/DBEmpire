import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar, RefreshControl, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { GeminiService } from '../services/geminiService';

const CATEGORIAS_GASTOS = ['General', 'Alquiler', 'Servicios', 'Marketing', 'Inventario', 'Salarios', 'Descuento', 'Otro'];

export default function ExpensesScreen({ navigation }) {
    const [viewMode, setViewMode] = useState('expenses'); // 'expenses' | 'purchases'

    // Expenses State
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [scanning, setScanning] = useState(false);
    const [expandedExpenseId, setExpandedExpenseId] = useState(null);

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
                .select('*')
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

        // Si la categoría es Descuento, guardamos el monto como negativo para que reste de los totales
        const finalAmount = category === 'Descuento' ? -Math.abs(numAmount) : numAmount;

        setAdding(true);
        try {
            const { error } = await supabase
                .from('expenses')
                .insert({
                    description: description.trim(),
                    amount: finalAmount,
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

    const handleScanReceipt = async () => {
        try {
            const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
            if (permissionResult.granted === false) {
                Alert.alert("Permiso Denegado", "Se requiere acceso a la cámara para escanear recibos.");
                return;
            }

            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 0.5,
                base64: true,
            });

            if (!result.canceled) {
                setScanning(true);
                try {
                    const analysis = await GeminiService.analyzeReceipt(result.assets[0].base64);

                    if (analysis.total) setAmount(analysis.total.toString());
                    if (analysis.vendor && analysis.items) {
                        setDescription(`${analysis.items} (${analysis.vendor})`);
                    } else if (analysis.vendor) {
                        setDescription(`Compra en ${analysis.vendor}`);
                    } else if (analysis.items) {
                        setDescription(analysis.items);
                    }

                    if (analysis.date) {
                        // Optional: Could set a date state if we had one for expenses
                    }

                    Alert.alert('✅ Escaneado', 'Datos extraídos correctamente. Verifica y guarda.');
                } catch (error) {
                    Alert.alert('Error IA', 'No se pudo analizar el recibo. Intenta sacar la foto más clara.');
                } finally {
                    setScanning(false);
                }
            }
        } catch (error) {
            console.log(error);
            setScanning(false);
        }
    };

    // --- PURCHASES (SUPPLIER ORDERS) LOGIC ---
    const handlePayInstallment = async (item) => {
        const currentPaid = item.installments_paid || 0;
        const total = item.installments_total || 1;

        if (currentPaid >= total) return;

        const installmentAmount = item.total_cost / total;

        Alert.alert(
            'Pagar Cuota',
            `¿Registrar el pago de la Cuota ${currentPaid + 1}/${total} por $${installmentAmount.toLocaleString()}? Se descontará de la caja.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar Pago',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Create Expense Record
                            const { error: expenseError } = await supabase
                                .from('expenses')
                                .insert({
                                    description: `Cuota ${currentPaid + 1}/${total}: ${item.provider_name}`,
                                    amount: installmentAmount,
                                    category: 'Inventario',
                                    created_at: new Date().toISOString()
                                });

                            if (expenseError) throw expenseError;

                            // 2. Update Order Installments
                            const { error: updateError } = await supabase
                                .from('supplier_orders')
                                .update({ installments_paid: currentPaid + 1 })
                                .eq('id', item.id);

                            if (updateError) throw updateError;

                            Alert.alert('✅ Pago Registrado', 'Se generó el gasto y se actualizó la cuota.');
                            fetchOrders();
                        } catch (error) {
                            console.log('Error paying installment:', error);
                            Alert.alert('Error', 'No se pudo registrar el pago. Intente nuevamente.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
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
                        // 1. Update Stock in Parallel
                        if (order.supplier_order_items && order.supplier_order_items.length > 0) {
                            const updatePromises = order.supplier_order_items.map(async (item) => {
                                if (item.product_id) {
                                    const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.product_id).single();
                                    if (prod) {
                                        const newStock = (prod.current_stock || 0) + (item.quantity || 0);
                                        return supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
                                    }
                                }
                                return Promise.resolve();
                            });
                            await Promise.all(updatePromises);
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

    const handleTrack = (order) => {
        const tracking = order.tracking_number;
        const provider = (order.provider_name || '').toLowerCase();
        const courier = (order.notes || '').toLowerCase();

        if (!tracking) {
            Alert.alert('Sin Seguimiento', 'Este pedido no tiene un número de seguimiento asociado.');
            return;
        }

        let url;
        if (provider.includes('temu')) {
            if (courier.includes('oca')) {
                url = `https://www.oca.com.ar/Seguimiento/BuscarEnvio/paquetes/${tracking.trim()}`;
            } else if (courier.includes('andreani')) {
                url = `https://seguimiento.andreani.com/envio/${tracking.trim()}`;
            } else if (courier.includes('via cargo')) {
                url = `https://www.viacargo.com.ar/tracking`;
            } else {
                url = 'https://postal.ninja/es/p/tracking/temu';
            }
        } else {
            url = 'https://parcelsapp.com/es/shops/aliexpress';
        }

        Linking.openURL(url);
    };

    // --- RENDER ITEMS ---
    const renderExpenseItem = useCallback(({ item }) => {
        const isDiscount = item.category === 'Descuento' || item.amount < 0;
        const hasDetails = Array.isArray(item.details) && item.details.length > 0;
        const isExpanded = expandedExpenseId === item.id;

        return (
            <TouchableOpacity
                activeOpacity={hasDetails ? 0.7 : 1}
                onPress={() => hasDetails && setExpandedExpenseId(isExpanded ? null : item.id)}
                style={styles.card}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Text style={[styles.categoryBadge, isDiscount && { color: '#2ecc71' }]}>
                            {item.category}
                        </Text>
                        {hasDetails && (
                            <MaterialCommunityIcons
                                name={isExpanded ? "chevron-up" : "chevron-down"}
                                size={16}
                                color="#d4af37"
                                style={{ marginLeft: 5 }}
                            />
                        )}
                    </View>
                    <Text style={styles.dateText}>
                        {new Date(item.created_at).toLocaleDateString('es-ES')}
                    </Text>
                </View>
                <View style={styles.cardBody}>
                    <Text style={styles.description}>{item.description}</Text>
                    <Text style={[styles.amount, isDiscount && { color: '#2ecc71' }]}>
                        {isDiscount ? `+$${Math.abs(item.amount).toFixed(2)}` : `-$${parseFloat(item.amount).toFixed(2)}`}
                    </Text>
                </View>

                {isExpanded && hasDetails && (
                    <View style={styles.detailsContainer}>
                        <Text style={styles.detailsTitle}>DESGLOSE POR COLOR:</Text>
                        {item.details.map((detail, idx) => (
                            <View key={idx} style={styles.detailItem}>
                                <Text style={styles.detailText}>{detail.color || 'Sin color'}</Text>
                                <Text style={styles.detailQty}>x{detail.qty}</Text>
                            </View>
                        ))}
                    </View>
                )}

                <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteExpense(item.id)}>
                    <Text style={styles.deleteText}>Eliminar</Text>
                </TouchableOpacity>
            </TouchableOpacity>
        );
    }, [expandedExpenseId]);

    const renderOrderItem = useCallback(({ item }) => {
        const totalInstallments = item.installments_total || 1;
        const paidInstallments = item.installments_paid || 0;
        const effectiveTotal = (item.total_cost || 0) - (item.discount || 0);
        const amountPerInstallment = effectiveTotal / totalInstallments;
        const isPaidOff = paidInstallments >= totalInstallments;

        return (
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => navigation.navigate('NewSupplierOrder', { orderToEdit: item })}
            >
                <View style={[styles.orderCard, isPaidOff && { borderColor: '#2ecc71' }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name={item.status === 'received' ? "check-decagram" : "cube-send"} size={24} color={item.status === 'received' ? "#2ecc71" : "#d4af37"} style={{ marginRight: 10 }} />
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <Text style={styles.providerName}>{item.provider_name}</Text>
                                    {item.discount > 0 && (
                                        <View style={[styles.statusBadge, { backgroundColor: 'rgba(46, 204, 113, 0.2)', marginLeft: 8 }]}>
                                            <Text style={[styles.statusText, { color: '#2ecc71' }]}>-${item.discount.toFixed(0)}</Text>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                        </View>
                        <View style={[styles.statusBadge, { backgroundColor: item.status === 'received' ? '#27ae60' : '#e67e22' }]}>
                            <Text style={styles.statusText}>{item.status === 'received' ? 'RECIBIDO' : 'EN CAMINO'}</Text>
                        </View>
                    </View>

                    {/* Tracking Info Row (Always visible for pending) */}
                    {item.status !== 'received' && (
                        <View style={styles.trackingRow}>
                            <MaterialCommunityIcons name="truck-delivery" size={20} color={item.tracking_number ? "#d4af37" : "#444"} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={styles.trackingLabel}>NRO. SEGUIMIENTO</Text>
                                <Text style={[styles.trackingNumber, !item.tracking_number && { color: '#444' }]}>
                                    {item.tracking_number || 'Sin asignar'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={[styles.trackBtnFixed, !item.tracking_number && styles.trackBtnDisabled]}
                                onPress={() => handleTrack(item)}
                            >
                                <Text style={styles.trackBtnTextFixed}>RASTREAR</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Cost & Installments Summary */}
                    <View style={styles.summaryContainer}>
                        <View>
                            <Text style={styles.summaryLabel}>Total Pagado</Text>
                            <Text style={styles.summaryValue}>${effectiveTotal.toLocaleString()}</Text>
                        </View>
                        <View>
                            <Text style={styles.summaryLabel}>Plan de Cuotas</Text>
                            <Text style={styles.summaryValue}>{paidInstallments}/{totalInstallments}</Text>
                        </View>
                        <View>
                            <Text style={styles.summaryLabel}>Valor Cuota</Text>
                            <Text style={styles.summaryValue}>${amountPerInstallment.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</Text>
                        </View>
                    </View>

                    {/* Progress Bar */}
                    {totalInstallments > 1 && (
                        <View style={styles.progressContainer}>
                            <View style={styles.progressBarBg}>
                                <View
                                    style={[
                                        styles.progressBarFill,
                                        { width: `${(paidInstallments / totalInstallments) * 100}%` },
                                        isPaidOff && { backgroundColor: '#2ecc71' }
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressText}>
                                {isPaidOff ? '¡DEUDA PAGADA!' : `Restan ${totalInstallments - paidInstallments} cuotas`}
                            </Text>
                        </View>
                    )}

                    {/* Quick Action: Pay Next Installment */}
                    {!isPaidOff && totalInstallments > 1 && (
                        <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handlePayInstallment(item)}
                        >
                            <Text style={styles.payBtnText}>PAGAR CUOTA DE ESTE MES</Text>
                        </TouchableOpacity>
                    )}

                    {/* Receive Button (Critical for Stock) */}
                    {item.status !== 'received' && (
                        <TouchableOpacity style={styles.receiveBtn} onPress={() => handleReceiveOrder(item)}>
                            <Text style={styles.receiveBtnText}>MARCAR COMO RECIBIDO (+ STOCK)</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </TouchableOpacity>
        );
    }, []);

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

            {/* LOADING OVERLAY (Optional but helpful if list is empty and loading) */}
            {loading && expenses.length === 0 && orders.length === 0 && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#d4af37" />
                    <Text style={{ color: '#666', marginTop: 10 }}>Cargando datos...</Text>
                </View>
            )}

            {/* EXPENSES VIEW */}
            {viewMode === 'expenses' && (
                <>
                    <View style={styles.formContainer}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Nuevo Gasto</Text>
                            <TouchableOpacity onPress={handleScanReceipt} style={styles.scanButton}>
                                {scanning ? <ActivityIndicator color="#000" size="small" /> : <MaterialCommunityIcons name="camera" size={20} color="#000" />}
                                {!scanning && <Text style={styles.scanButtonText}>ESCANEAR</Text>}
                            </TouchableOpacity>
                        </View>
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
                        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No hay gastos registrados</Text> : null}
                        refreshControl={
                            <RefreshControl refreshing={loading} onRefresh={fetchExpenses} tintColor="#d4af37" colors={['#d4af37']} />
                        }
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={true}
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
                        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No hay órdenes de compra.</Text> : null}
                        refreshControl={
                            <RefreshControl refreshing={loading} onRefresh={fetchOrders} tintColor="#d4af37" colors={['#d4af37']} />
                        }
                        initialNumToRender={5}
                        maxToRenderPerBatch={5}
                        windowSize={3}
                        removeClippedSubviews={true}
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

    orderCard: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    providerName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#252525', padding: 10, borderRadius: 8, marginBottom: 15 },
    summaryLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
    summaryValue: { color: '#d4af37', fontSize: 14, fontWeight: 'bold' },

    progressContainer: { marginBottom: 15 },
    progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginBottom: 5 },
    progressBarFill: { height: '100%', backgroundColor: '#d4af37', borderRadius: 3 },
    progressText: { color: '#666', fontSize: 11, fontStyle: 'italic', textAlign: 'right' },

    payBtn: { backgroundColor: '#222', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#d4af37', marginBottom: 15 },
    payBtnText: { color: '#d4af37', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },

    receiveBtn: { backgroundColor: '#333', padding: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: '#2ecc71' },
    receiveBtnText: { color: '#2ecc71', fontWeight: '900', fontSize: 12, letterSpacing: 1 },

    trackingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#151515',
        padding: 12,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#222'
    },
    trackingLabel: { color: '#666', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    trackingNumber: { color: '#d4af37', fontSize: 13, fontWeight: 'bold' },
    trackBtnFixed: { backgroundColor: '#d4af37', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
    trackBtnDisabled: { backgroundColor: '#333' },
    trackBtnTextFixed: { color: '#000', fontSize: 11, fontWeight: '900' },

    date: { color: '#666', fontSize: 12 },

    scanButton: { backgroundColor: '#d4af37', flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, alignItems: 'center', gap: 5 },
    scanButtonText: { fontSize: 10, fontWeight: '900', color: '#000' },
    loadingOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },

    detailsContainer: {
        backgroundColor: '#151515',
        padding: 12,
        borderRadius: 10,
        marginTop: 5,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222'
    },
    detailsTitle: { color: '#666', fontSize: 10, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
    detailItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#222' },
    detailText: { color: '#aaa', fontSize: 13 },
    detailQty: { color: '#d4af37', fontWeight: 'bold', fontSize: 13 }
});
