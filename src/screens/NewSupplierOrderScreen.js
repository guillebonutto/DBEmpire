
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

import DateTimePicker from '@react-native-community/datetimepicker';

export default function NewSupplierOrderScreen({ navigation, route }) {
    const [purchaseDate, setPurchaseDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [provider, setProvider] = useState('');
    const [tracking, setTracking] = useState('');
    const [itemsDesc, setItemsDesc] = useState('');
    const [cost, setCost] = useState('');
    const [discount, setDiscount] = useState('0');
    const [installmentsTotal, setInstallmentsTotal] = useState('1');
    const [installmentsPaid, setInstallmentsPaid] = useState('0');
    const [courier, setCourier] = useState(''); // Andreani, OCA, Via Cargo
    const [loading, setLoading] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    useEffect(() => {
        const checkRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role !== 'admin') {
                Alert.alert('Acceso Denegado', 'Las compras al proveedor son confidenciales.');
                navigation.replace('Main');
            }
        };
        checkRole();
    }, []);

    // Product Linking State
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]); // { product, quantity, cost, isNew, tempName }
    const [showProductModal, setShowProductModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const { orderToEdit } = navigation.route?.params || {}; // Safe access if route is undefined, though unlikely in this flow

    React.useEffect(() => {
        fetchProducts();
        if (route.params?.orderToEdit) {
            const order = route.params.orderToEdit;
            setProvider(order.provider_name);
            setTracking(order.tracking_number || '');
            setItemsDesc(order.items_description || '');
            setCost(order.total_cost?.toString() || '');
            setDiscount(order.discount?.toString() || '0');
            setInstallmentsTotal(order.installments_total?.toString() || '1');
            setInstallmentsPaid(order.installments_paid?.toString() || '0');
            setCourier(order.notes || '');
            if (order.created_at) {
                setPurchaseDate(new Date(order.created_at));
            }

            // Allow editing status from here too if needed, or keep it simple
            loadLinkedItems(order.id);
        }
    }, [route.params?.orderToEdit]);

    const loadLinkedItems = async (orderId) => {
        const { data, error } = await supabase
            .from('supplier_order_items')
            .select('product_id, quantity, cost_per_unit, temp_product_name, supplier, color, products(id, name, current_stock)')
            .eq('supplier_order_id', orderId);

        if (data) {
            const formatted = data.map(item => {
                if (item.products) {
                    // Linked Product
                    return {
                        product: item.products,
                        quantity: item.quantity.toString(),
                        cost: item.cost_per_unit.toString(),
                        supplier: item.supplier || '',
                        color: item.color || '',
                        isNew: false
                    };
                } else {
                    // Unlinked Product (New)
                    return {
                        product: { id: null, name: item.temp_product_name },
                        quantity: item.quantity.toString(),
                        cost: item.cost_per_unit.toString(),
                        supplier: item.supplier || '',
                        color: item.color || '',
                        isNew: true,
                        tempName: item.temp_product_name
                    };
                }
            });
            setSelectedProducts(formatted);
            setTimeout(() => setIsInitialLoad(false), 500);
        } else {
            setIsInitialLoad(false);
        }
    };

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('*').eq('active', true);
        if (data) setProducts(data);
    };

    // Auto-calculate Total Cost based on Products (only if not initial load or manual override)
    useEffect(() => {
        if (isInitialLoad && route.params?.orderToEdit) {
            return;
        }

        const total = selectedProducts.reduce((sum, item) => {
            const qty = parseFloat(item.quantity) || 0;
            const unitCost = parseFloat(item.cost) || 0;
            return sum + (qty * unitCost);
        }, 0);

        if (total > 0) {
            setCost(total.toFixed(2));
        }
    }, [selectedProducts]);

    const addProductToOrder = (product, isNew = false, tempName = '') => {
        const newProduct = isNew
            ? { product: { id: null, name: tempName }, quantity: '1', cost: '0', supplier: '', color: '', isNew: true, tempName }
            : { product, quantity: '1', cost: product.cost_price?.toString() || '0', supplier: product.supplier || '', color: product.color || '', isNew: false };

        setSelectedProducts([...selectedProducts, newProduct]);
        setShowProductModal(false);
        setSearchQuery('');
    };

    const updateProductItem = (id, field, value) => {
        // Handle both linked (id) and unlinked (tempName)
        // We use a unique key approach or find index
        const updated = selectedProducts.map(p => {
            const pId = p.product.id || p.tempName;
            const targetId = id; // id passed is either product.id or tempName

            if (pId === targetId) {
                return { ...p, [field]: value };
            }
            return p;
        });
        setSelectedProducts(updated);
    };

    const removeProductItem = (id) => {
        const filtered = selectedProducts.filter(p => (p.product.id || p.tempName) !== id);
        setSelectedProducts(filtered);
    };

    const handleSave = async () => {
        if (!provider) {
            Alert.alert('Error', 'El nombre del proveedor es obligatorio.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                provider_name: provider,
                tracking_number: tracking || null,
                items_description: itemsDesc,
                total_cost: parseFloat(cost) || 0,
                discount: parseFloat(discount) || 0,
                installments_total: parseInt(installmentsTotal) || 1,
                installments_paid: parseInt(installmentsPaid) || 0,
                notes: courier,
                created_at: purchaseDate.toISOString()
            };

            let orderId;

            if (route.params?.orderToEdit) {
                // UPDATE
                orderId = route.params.orderToEdit.id;
                const { error } = await supabase
                    .from('supplier_orders')
                    .update(payload)
                    .eq('id', orderId);

                if (error) throw error;
            } else {
                // INSERT
                const { data: newOrder, error: insertError } = await supabase
                    .from('supplier_orders')
                    .insert({ ...payload, status: 'pending' })
                    .select()
                    .single();

                if (insertError) throw insertError;
                orderId = newOrder.id;

                // Add to expenses if there are initial installments paid
                if (payload.installments_paid > 0) {
                    const amountPerInstallment = (payload.total_cost - payload.discount) / payload.installments_total;
                    const totalPaidNow = amountPerInstallment * payload.installments_paid;
                    await supabase.from('expenses').insert({
                        description: `Pago inicial: ${provider} (${itemsDesc})`,
                        amount: totalPaidNow,
                        category: 'Inventario',
                        created_at: purchaseDate.toISOString()
                    });
                }
            }

            // Handle Linked Items (Delete all and re-insert for simplicity on edit)
            if (route.params?.orderToEdit) {
                await supabase.from('supplier_order_items').delete().eq('supplier_order_id', orderId);
            }

            if (selectedProducts.length > 0 && orderId) {
                const itemsPayload = selectedProducts.map(p => ({
                    supplier_order_id: orderId,
                    product_id: p.isNew ? null : p.product.id,
                    temp_product_name: p.isNew ? p.tempName : null,
                    quantity: parseInt(p.quantity) || 1,
                    cost_per_unit: parseFloat(p.cost) || 0,
                    supplier: p.supplier || null,
                    color: p.color || null
                }));

                const { error: itemsError } = await supabase
                    .from('supplier_order_items')
                    .insert(itemsPayload);

                if (itemsError) throw itemsError;
            }

            Alert.alert('✅ Éxito', `Orden ${route.params?.orderToEdit ? 'actualizada' : 'creada'} correctamente.`, [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (err) {
            Alert.alert('Error', 'No se pudo guardar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.title}>{route.params?.orderToEdit ? 'EDITAR ORDEN' : 'REGISTRAR COMPRA (STOCK)'}</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.form}>
                <Text style={styles.label}>Fecha de Compra</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.input, { flexDirection: 'row', alignItems: 'center' }]}>
                    <MaterialCommunityIcons name="calendar" size={20} color="#666" style={{ marginRight: 10 }} />
                    <Text style={{ color: '#fff' }}>{purchaseDate.toLocaleDateString('es-AR')}</Text>
                </TouchableOpacity>
                {showDatePicker && (
                    <DateTimePicker
                        value={purchaseDate}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowDatePicker(false);
                            if (selectedDate) setPurchaseDate(selectedDate);
                        }}
                    />
                )}

                <Text style={styles.label}>Proveedor / Tienda</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej: Temu, Shein, Amazon..."
                    placeholderTextColor="#666"
                    value={provider}
                    onChangeText={setProvider}
                />

                <Text style={styles.label}>Empresa de Transporte</Text>
                <View style={styles.courierContainer}>
                    {['Andreani', 'OCA', 'Via Cargo'].map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.courierPill, courier === c && styles.courierPillActive]}
                            onPress={() => setCourier(courier === c ? '' : c)}
                        >
                            <Text style={[styles.courierText, courier === c && styles.courierTextActive]}>{c}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>Número de Seguimiento (Tracking)</Text>
                <View style={styles.trackingRow}>
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="#666" style={{ marginRight: 10 }} />
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Pegar código de rastreo"
                        placeholderTextColor="#666"
                        value={tracking}
                        onChangeText={setTracking}
                    />
                </View>

                {/* Products Section */}
                <Text style={styles.label}>Productos Vinculados (Opcional)</Text>
                {selectedProducts.map((item, index) => (
                    <View key={index} style={styles.productCard}>
                        <View style={styles.productCardHeader}>
                            <Text style={styles.productName}>{item.product.name}</Text>
                            <TouchableOpacity onPress={() => removeProductItem(item.product.id || item.tempName)}>
                                <MaterialCommunityIcons name="close-circle" size={24} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.productCardRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.miniLabel}>Cantidad</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    placeholder="1"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={item.quantity}
                                    onChangeText={v => updateProductItem(item.product.id || item.tempName, 'quantity', v)}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.miniLabel}>Costo Unitario</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    placeholder="0.00"
                                    placeholderTextColor="#666"
                                    keyboardType="numeric"
                                    value={item.cost}
                                    onChangeText={v => updateProductItem(item.product.id || item.tempName, 'cost', v)}
                                />
                            </View>
                        </View>

                        <View style={styles.productCardRow}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={styles.miniLabel}>Proveedor</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    placeholder="Ej: Temu, Shein..."
                                    placeholderTextColor="#666"
                                    value={item.supplier || ''}
                                    onChangeText={v => updateProductItem(item.product.id || item.tempName, 'supplier', v)}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.miniLabel}>Color/Variante</Text>
                                <TextInput
                                    style={styles.miniInput}
                                    placeholder="Ej: Negro, Azul..."
                                    placeholderTextColor="#666"
                                    value={item.color || ''}
                                    onChangeText={v => updateProductItem(item.product.id || item.tempName, 'color', v)}
                                />
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity style={styles.addProdBtn} onPress={() => setShowProductModal(true)}>
                    <MaterialCommunityIcons name="plus" size={20} color="#000" />
                    <Text style={styles.addProdText}>AGREGAR PRODUCTO / ITEM</Text>
                </TouchableOpacity>

                <Text style={styles.label}>Descripción Adicional / Notas</Text>
                <TextInput
                    style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                    placeholder="Detalle de productos o notas..."
                    placeholderTextColor="#666"
                    multiline
                    value={itemsDesc}
                    onChangeText={setItemsDesc}
                />

                <Text style={styles.label}>Costo Total (USD/ARS)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={cost}
                    onChangeText={setCost}
                />

                <Text style={styles.label}>Descuento (Monto Fijo $)</Text>
                <TextInput
                    style={[styles.input, { color: '#2ecc71', borderColor: discount > 0 ? '#2ecc71' : '#222' }]}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={discount}
                    onChangeText={setDiscount}
                />

                {parseFloat(discount) > 0 && (
                    <View style={styles.summaryBox}>
                        <Text style={styles.summaryLabel}>Total a Pagar Final:</Text>
                        <Text style={styles.summaryValue}>
                            ${((parseFloat(cost) || 0) - (parseFloat(discount) || 0)).toFixed(2)}
                        </Text>
                    </View>
                )}

                <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.label}>Cuotas Totales</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="1"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={installmentsTotal}
                            onChangeText={setInstallmentsTotal}
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Cuotas Pagadas</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={installmentsPaid}
                            onChangeText={setInstallmentsPaid}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#000" />
                    ) : (
                        <Text style={styles.saveText}>
                            {route.params?.orderToEdit ? 'ACTUALIZAR PEDIDO' : 'GUARDAR PEDIDO'}
                        </Text>
                    )}
                </TouchableOpacity>
            </ScrollView>

            {/* Product Selection Modal */}
            {
                showProductModal && (
                    <View style={styles.modalOverlay}>
                        <View style={styles.modalContent}>
                            <Text style={styles.modalTitle}>Seleccionar Producto</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            <ScrollView>
                                {products.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map(p => (
                                    <TouchableOpacity key={p.id} style={styles.modalItem} onPress={() => addProductToOrder(p)}>
                                        <Text style={styles.modalItemText}>{p.name}</Text>
                                        <Text style={styles.modalItemSub}>Stock: {p.current_stock}</Text>
                                    </TouchableOpacity>
                                ))}
                                {searchQuery.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.modalItem, { borderTopWidth: 2, borderTopColor: '#d4af37' }]}
                                        onPress={() => addProductToOrder(null, true, searchQuery)}
                                    >
                                        <Text style={[styles.modalItemText, { color: '#d4af37' }]}>+ AGREGAR COMO NUEVO: "{searchQuery}"</Text>
                                        <Text style={styles.modalItemSub}>Producto no registrado en inventario</Text>
                                    </TouchableOpacity>
                                )}
                            </ScrollView>
                            <TouchableOpacity style={styles.closeModal} onPress={() => setShowProductModal(false)}>
                                <Text style={styles.closeText}>CERRAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )
            }
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    form: { padding: 20 },

    label: { color: '#d4af37', marginBottom: 10, fontWeight: 'bold', marginTop: 10 },
    input: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
    row: { flexDirection: 'row', justifyContent: 'space-between' },

    trackingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 5, paddingLeft: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 20 },

    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    saveText: { color: '#000', fontWeight: '900', fontSize: 16 },

    // Product Linking Styles
    productCard: { backgroundColor: '#222', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    productCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    productCardRow: { flexDirection: 'row', marginBottom: 10 },
    productName: { color: '#fff', fontWeight: 'bold', fontSize: 16, flex: 1 },
    miniLabel: { color: '#d4af37', fontSize: 11, fontWeight: 'bold', marginBottom: 5 },
    miniInput: { backgroundColor: '#111', color: '#fff', padding: 10, borderRadius: 5, borderWidth: 1, borderColor: '#333' },
    addProdBtn: { flexDirection: 'row', backgroundColor: '#d4af37', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
    addProdText: { fontWeight: 'bold', marginLeft: 5, fontSize: 12 },

    modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#1e1e1e', borderRadius: 15, padding: 20, maxHeight: '80%' },
    modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
    searchInput: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    modalItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    modalItemText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    modalItemSub: { color: '#666', fontSize: 12 },
    closeModal: { marginTop: 15, alignItems: 'center', padding: 10 },
    closeText: { color: '#e74c3c', fontWeight: 'bold' },

    summaryBox: { backgroundColor: 'rgba(46, 204, 113, 0.1)', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(46, 204, 113, 0.3)', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
    summaryValue: { color: '#2ecc71', fontSize: 18, fontWeight: 'bold' },

    courierContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    courierPill: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#1e1e1e', borderWidth: 1, borderColor: '#333', alignItems: 'center' },
    courierPillActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    courierText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    courierTextActive: { color: '#000', fontWeight: '900' },
});
