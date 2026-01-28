import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ShippingPackagesScreen({ navigation }) {
    const [packages, setPackages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);

    // Form states
    const [packageName, setPackageName] = useState('');
    const [destination, setDestination] = useState('Córdoba');
    const [transportCost, setTransportCost] = useState('');
    const [courier, setCourier] = useState('');
    const [trackingNumber, setTrackingNumber] = useState('');
    const [notes, setNotes] = useState('');

    // Items selection
    const [availableItems, setAvailableItems] = useState([]);
    const [selectedItems, setSelectedItems] = useState([]);
    const [showItemsModal, setShowItemsModal] = useState(false);
    const [allRates, setAllRates] = useState([]);

    useEffect(() => {
        checkRole();
        fetchPackages();
        fetchRates();
    }, []);

    const checkRole = async () => {
        const role = await AsyncStorage.getItem('user_role');
        if (role !== 'admin') {
            Alert.alert('Acceso Denegado', 'Solo administradores pueden gestionar envíos.');
            navigation.goBack();
        }
    };

    const fetchPackages = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shipping_packages')
                .select(`
                    *,
                    items:supplier_order_items(count)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setPackages(data || []);
        } catch (err) {
            console.error('Error fetching packages:', err);
            Alert.alert('Error', 'No se pudieron cargar los paquetes');
        } finally {
            setLoading(false);
        }
    };

    const fetchRates = async () => {
        try {
            const { data, error } = await supabase
                .from('shipping_rates')
                .select('courier, destination, base_rate')
                .eq('active', true);
            if (data && !error) setAllRates(data);
        } catch (err) {
            console.log('Error caching rates:', err);
        }
    };

    const fetchAvailableItems = async () => {
        try {
            // Get items from received orders that don't have a package assigned yet
            const { data, error } = await supabase
                .from('supplier_order_items')
                .select(`
                    id,
                    quantity,
                    cost_per_unit,
                    supplier,
                    color,
                    temp_product_name,
                    products!inner(id, name, cost_price, stock_local),
                    supplier_orders!inner(id, provider_name, status)
                `)
                .eq('supplier_orders.status', 'received')
                .is('shipping_package_id', null)
                .gt('products.stock_local', 0);

            if (error) throw error;
            setAvailableItems(data || []);
        } catch (err) {
            console.error('Error fetching items:', err);
            Alert.alert('Error', 'No se pudieron cargar los productos disponibles');
        }
    };

    const openCreateModal = () => {
        setSelectedPackage(null);
        setPackageName('');
        setDestination('Córdoba');
        setTransportCost('');
        setCourier('');
        setTrackingNumber('');
        setNotes('');
        setSelectedItems([]);
        fetchAvailableItems();
        setShowModal(true);
    };

    // Auto-suggest shipping rate based on courier and destination (Instant Cache version)
    useEffect(() => {
        if (courier && destination && allRates.length > 0) {
            const suggested = allRates.find(r =>
                r.courier === courier &&
                r.destination === destination
            );

            if (suggested) {
                setTransportCost(suggested.base_rate.toString());
            } else {
                setTransportCost('');
            }
        }
    }, [courier, destination, allRates]);

    const openItemsSelector = () => {
        setShowItemsModal(true);
    };

    const toggleItemSelection = (item) => {
        const isSelected = selectedItems.find(i => i.id === item.id);
        if (isSelected) {
            setSelectedItems(selectedItems.filter(i => i.id !== item.id));
        } else {
            // Default to sending what we have (min between order qty and physical stock)
            const maxAvailable = Math.min(item.quantity, item.products?.stock_local || 0);
            setSelectedItems([...selectedItems, { ...item, qty_to_send: maxAvailable }]);
        }
    };

    const updateItemQty = (itemId, delta, max) => {
        setSelectedItems(prev => prev.map(i => {
            if (i.id === itemId) {
                const newQty = Math.max(1, Math.min(max, i.qty_to_send + delta));
                return { ...i, qty_to_send: newQty };
            }
            return i;
        }));
    };

    const calculateDistribution = () => {
        if (selectedItems.length === 0) return [];

        const totalCost = selectedItems.reduce((sum, item) => {
            return sum + (item.qty_to_send * item.cost_per_unit);
        }, 0);

        const transportCostNum = parseFloat(transportCost) || 0;

        return selectedItems.map(item => {
            const itemTotalCost = item.qty_to_send * item.cost_per_unit;
            const proportion = itemTotalCost / totalCost;
            const allocatedTransport = transportCostNum * proportion;
            const transportPerUnit = allocatedTransport / item.qty_to_send;

            return {
                ...item,
                allocatedTransport: allocatedTransport.toFixed(2),
                transportPerUnit: transportPerUnit.toFixed(2),
                newCostPrice: (item.cost_per_unit + transportPerUnit).toFixed(2)
            };
        });
    };

    const handleSavePackage = async () => {
        if (!packageName || !destination || !transportCost) {
            Alert.alert('Error', 'Completa todos los campos obligatorios');
            return;
        }

        if (selectedItems.length === 0) {
            Alert.alert('Error', 'Debes seleccionar al menos un producto para el paquete');
            return;
        }

        setLoading(true);
        try {
            // 1. Create shipping package
            const { data: newPackage, error: packageError } = await supabase
                .from('shipping_packages')
                .insert({
                    package_name: packageName,
                    destination,
                    transport_cost: parseFloat(transportCost),
                    courier,
                    tracking_number: trackingNumber,
                    notes,
                    status: 'pending'
                })
                .select()
                .single();

            if (packageError) throw packageError;

            // 2. Calculate distribution
            const distribution = calculateDistribution();

            // 3. Update items with package assignment and TOTAL STOCK DEDUCTION
            for (const item of distribution) {
                // Determine if we need to SPLIT the supplier order item (partial shipment)
                if (item.qty_to_send < item.quantity) {
                    // PARTIAL SHIPMENT: Create a clone for the sent part, and update the original with the remainder
                    const remainingQty = item.quantity - item.qty_to_send;

                    // a) Update original item to have the remaining quantity (unsent)
                    const { error: splitError } = await supabase
                        .from('supplier_order_items')
                        .update({ quantity: remainingQty })
                        .eq('id', item.id);
                    if (splitError) throw splitError;

                    // b) Create a NEW item record for the portion actually sent
                    const { error: cloneError } = await supabase
                        .from('supplier_order_items')
                        .insert({
                            supplier_order_id: item.supplier_orders.id,
                            product_id: item.products.id,
                            quantity: item.qty_to_send,
                            cost_per_unit: item.cost_per_unit,
                            supplier: item.supplier,
                            color: item.color,
                            temp_product_name: item.temp_product_name,
                            shipping_package_id: newPackage.id,
                            transport_cost_allocated: parseFloat(item.allocatedTransport)
                        });
                    if (cloneError) throw cloneError;

                } else {
                    // FULL SHIPMENT: Just link the existing item
                    const { error: updateError } = await supabase
                        .from('supplier_order_items')
                        .update({
                            shipping_package_id: newPackage.id,
                            transport_cost_allocated: parseFloat(item.allocatedTransport)
                        })
                        .eq('id', item.id);
                    if (updateError) throw updateError;
                }

                // 📦 IMMEDIATE STOCK DEDUCTION (Leaves Local)
                if (item.products?.id) {
                    const { data: prod } = await supabase
                        .from('products')
                        .select('stock_local, current_stock')
                        .eq('id', item.products.id)
                        .single();

                    if (prod) {
                        const newLocal = Math.max(0, (prod.stock_local || 0) - item.qty_to_send);
                        // Total current_stock is (BA + Cba). If it's in transit, it's NOT available for sale anywhere.
                        // So we subtract from total current_stock too.
                        const newTotal = Math.max(0, (prod.current_stock || 0) - item.qty_to_send);

                        await supabase.from('products').update({
                            stock_local: newLocal,
                            current_stock: newTotal
                        }).eq('id', item.products.id);
                    }
                }
            }

            // 4. Update product cost_price for linked products
            for (const item of distribution) {
                if (item.products?.id) {
                    const { error: productError } = await supabase
                        .from('products')
                        .update({
                            cost_price: parseFloat(item.newCostPrice)
                        })
                        .eq('id', item.products.id);

                    if (productError) throw productError;
                }
            }

            Alert.alert('✅ Éxito', 'Paquete creado y costos distribuidos correctamente', [
                {
                    text: 'OK', onPress: () => {
                        setShowModal(false);
                        fetchPackages();
                    }
                }
            ]);
        } catch (err) {
            console.error('Error saving package:', err);
            Alert.alert('Error', 'No se pudo guardar el paquete: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const updatePackageStatus = async (packageId, newStatus) => {
        try {
            const updateData = { status: newStatus };
            if (newStatus === 'delivered') {
                updateData.delivered_at = new Date().toISOString();

                // 📦 STOCK ARRIVAL LOGIC
                // 1. Get products in this package
                const { data: items, error: fetchError } = await supabase
                    .from('supplier_order_items')
                    .select('id, quantity, product_id')
                    .eq('shipping_package_id', packageId);

                if (fetchError) throw fetchError;

                // 2. Add to Córdoba stock
                for (const item of items) {
                    if (item.product_id) {
                        const { data: product } = await supabase
                            .from('products')
                            .select('stock_cordoba, current_stock')
                            .eq('id', item.product_id)
                            .single();

                        if (product) {
                            const newCba = (product.stock_cordoba || 0) + item.quantity;
                            // Adding to Cordoba makes it available again in total current_stock
                            const newTotal = (product.current_stock || 0) + item.quantity;

                            await supabase
                                .from('products')
                                .update({
                                    stock_cordoba: newCba,
                                    current_stock: newTotal
                                })
                                .eq('id', item.product_id);
                        }
                    }
                }
            }

            const { error } = await supabase
                .from('shipping_packages')
                .update(updateData)
                .eq('id', packageId);

            if (error) throw error;
            fetchPackages();
        } catch (err) {
            console.error('Status update error:', err);
            Alert.alert('Error', 'No se pudo actualizar el estado: ' + err.message);
        }
    };

    const renderPackageItem = ({ item }) => {
        const statusColors = {
            pending: '#f39c12',
            in_transit: '#3498db',
            delivered: '#2ecc71'
        };

        const statusLabels = {
            pending: 'Pendiente',
            in_transit: 'En Tránsito',
            delivered: 'Entregado'
        };

        return (
            <TouchableOpacity style={styles.packageCard}>
                <View style={styles.packageHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.packageName}>{item.package_name}</Text>
                        <Text style={styles.packageDestination}>📍 {item.destination}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColors[item.status] }]}>
                        <Text style={styles.statusText}>{statusLabels[item.status]}</Text>
                    </View>
                </View>

                <View style={styles.packageDetails}>
                    <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="truck-delivery" size={16} color="#666" />
                        <Text style={styles.detailText}>{item.courier || 'Sin courier'}</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="package-variant" size={16} color="#666" />
                        <Text style={styles.detailText}>{item.items?.[0]?.count || 0} productos</Text>
                    </View>
                    <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="cash" size={16} color="#d4af37" />
                        <Text style={[styles.detailText, { color: '#d4af37', fontWeight: 'bold' }]}>
                            ${parseFloat(item.transport_cost).toFixed(2)}
                        </Text>
                    </View>
                </View>

                {item.status !== 'delivered' && (
                    <View style={styles.packageActions}>
                        {item.status === 'pending' && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#3498db' }]}
                                onPress={() => updatePackageStatus(item.id, 'in_transit')}
                            >
                                <MaterialCommunityIcons name="truck-fast" size={16} color="#fff" />
                                <Text style={styles.actionBtnText}>En Tránsito</Text>
                            </TouchableOpacity>
                        )}
                        {item.status === 'in_transit' && (
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#2ecc71' }]}
                                onPress={() => updatePackageStatus(item.id, 'delivered')}
                            >
                                <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
                                <Text style={styles.actionBtnText}>Marcar Entregado</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    const renderDistributionPreview = () => {
        if (selectedItems.length === 0 || !transportCost) return null;

        const distribution = calculateDistribution();

        return (
            <View style={styles.previewSection}>
                <Text style={styles.previewTitle}>📊 Distribución de Costos</Text>
                {distribution.map((item, index) => (
                    <View key={index} style={styles.previewItem}>
                        <Text style={styles.previewProductName}>
                            {item.products?.name || item.temp_product_name}
                        </Text>
                        <View style={styles.previewDetails}>
                            <Text style={styles.previewLabel}>Cantidad: {item.quantity}</Text>
                            <Text style={styles.previewLabel}>
                                Transporte asignado: <Text style={{ color: '#d4af37' }}>${item.allocatedTransport}</Text>
                            </Text>
                            <Text style={styles.previewLabel}>
                                Nuevo costo unitario: <Text style={{ color: '#2ecc71', fontWeight: 'bold' }}>${item.newCostPrice}</Text>
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>PAQUETES DE ENVÍO</Text>
                <TouchableOpacity onPress={openCreateModal}>
                    <MaterialCommunityIcons name="plus-circle" size={28} color="#d4af37" />
                </TouchableOpacity>
            </LinearGradient>

            {loading && packages.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#d4af37" />
                </View>
            ) : (
                <FlatList
                    data={packages}
                    renderItem={renderPackageItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="package-variant-closed" size={64} color="#333" />
                            <Text style={styles.emptyText}>No hay paquetes registrados</Text>
                            <Text style={styles.emptySubtext}>Crea uno para distribuir costos de transporte</Text>
                        </View>
                    }
                />
            )}

            {/* Create/Edit Package Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuevo Paquete de Envío</Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            <Text style={styles.label}>Nombre del Paquete *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Envío Córdoba 28/01"
                                placeholderTextColor="#666"
                                value={packageName}
                                onChangeText={setPackageName}
                            />

                            <Text style={styles.label}>Destino *</Text>
                            <View style={styles.destinationButtons}>
                                {['Córdoba', 'Jujuy', 'Rosario', 'Mendoza'].map(dest => (
                                    <TouchableOpacity
                                        key={dest}
                                        style={[styles.destBtn, destination === dest && styles.destBtnActive]}
                                        onPress={() => setDestination(dest)}
                                    >
                                        <Text style={[styles.destBtnText, destination === dest && styles.destBtnTextActive]}>
                                            {dest}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Costo de Transporte Total *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={transportCost}
                                onChangeText={setTransportCost}
                            />

                            <Text style={styles.label}>Empresa de Transporte</Text>
                            <View style={styles.courierButtons}>
                                {['Andreani', 'OCA', 'Via Cargo'].map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.courierBtn, courier === c && styles.courierBtnActive]}
                                        onPress={() => setCourier(courier === c ? '' : c)}
                                    >
                                        <Text style={[styles.courierBtnText, courier === c && styles.courierBtnTextActive]}>
                                            {c}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Número de Seguimiento</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Tracking number"
                                placeholderTextColor="#666"
                                value={trackingNumber}
                                onChangeText={setTrackingNumber}
                            />

                            <Text style={styles.label}>Productos en el Paquete *</Text>
                            <TouchableOpacity style={styles.selectItemsBtn} onPress={openItemsSelector}>
                                <MaterialCommunityIcons name="package-variant" size={20} color="#000" />
                                <Text style={styles.selectItemsBtnText}>
                                    {selectedItems.length > 0
                                        ? `${selectedItems.length} producto(s) seleccionado(s)`
                                        : 'Seleccionar Productos'}
                                </Text>
                            </TouchableOpacity>

                            {renderDistributionPreview()}

                            <Text style={styles.label}>Notas</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Notas adicionales..."
                                placeholderTextColor="#666"
                                multiline
                                value={notes}
                                onChangeText={setNotes}
                            />

                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSavePackage}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text style={styles.saveBtnText}>CREAR PAQUETE Y DISTRIBUIR COSTOS</Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Items Selection Modal */}
            <Modal visible={showItemsModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Seleccionar Productos</Text>
                            <TouchableOpacity onPress={() => setShowItemsModal(false)}>
                                <MaterialCommunityIcons name="check" size={24} color="#2ecc71" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView>
                            {availableItems.length === 0 ? (
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>No hay productos disponibles</Text>
                                    <Text style={styles.emptySubtext}>
                                        Los productos deben estar en órdenes "Recibidas"
                                    </Text>
                                </View>
                            ) : (
                                availableItems.map(item => {
                                    const selectedInfo = selectedItems.find(i => i.id === item.id);
                                    const isSelected = !!selectedInfo;
                                    return (
                                        <View key={item.id}>
                                            <TouchableOpacity
                                                style={[styles.itemCard, isSelected && styles.itemCardSelected]}
                                                onPress={() => toggleItemSelection(item)}
                                            >
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.itemName}>
                                                        {item.products?.name || item.temp_product_name}
                                                    </Text>
                                                    <Text style={styles.itemDetails}>
                                                        Compra: {item.quantity} | En Jujuy: {item.products?.stock_local || 0} | Costo: ${item.cost_per_unit}
                                                    </Text>
                                                    {item.supplier && (
                                                        <Text style={styles.itemSupplier}>Prov: {item.supplier}</Text>
                                                    )}
                                                </View>
                                                <MaterialCommunityIcons
                                                    name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                                                    size={24}
                                                    color={isSelected ? "#d4af37" : "#666"}
                                                />
                                            </TouchableOpacity>

                                            {isSelected && (
                                                <View style={styles.qtySelectorRow}>
                                                    <Text style={styles.qtyLabel}>Cantidad a enviar:</Text>
                                                    <View style={styles.qtyControls}>
                                                        <TouchableOpacity
                                                            onPress={() => updateItemQty(item.id, -1, Math.min(item.quantity, item.products?.stock_local || 0))}
                                                            style={styles.qtyBtn}
                                                        >
                                                            <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                                                        </TouchableOpacity>

                                                        <View style={styles.qtyValueContainer}>
                                                            <Text style={styles.qtyValue}>{selectedInfo.qty_to_send}</Text>
                                                        </View>

                                                        <TouchableOpacity
                                                            onPress={() => updateItemQty(item.id, 1, Math.min(item.quantity, item.products?.stock_local || 0))}
                                                            style={styles.qtyBtn}
                                                        >
                                                            <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                                                        </TouchableOpacity>
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    );
                                })
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    listContent: { padding: 20 },

    packageCard: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    packageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
    packageName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
    packageDestination: { color: '#d4af37', fontSize: 14 },
    statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    statusText: { color: '#fff', fontSize: 11, fontWeight: 'bold' },

    packageDetails: { marginBottom: 12 },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    detailText: { color: '#999', fontSize: 13, marginLeft: 8 },

    packageActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 8, gap: 6 },
    actionBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { color: '#666', fontSize: 16, fontWeight: 'bold', marginTop: 15 },
    emptySubtext: { color: '#444', fontSize: 13, marginTop: 5, textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e1e1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    modalTitle: { color: '#d4af37', fontSize: 18, fontWeight: 'bold' },
    modalScroll: { padding: 20 },

    label: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },

    destinationButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    destBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
    destBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    destBtnText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    destBtnTextActive: { color: '#000' },

    courierButtons: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    courierBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#333', alignItems: 'center' },
    courierBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    courierBtnText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    courierBtnTextActive: { color: '#000' },

    selectItemsBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d4af37', padding: 12, borderRadius: 8, gap: 8, marginBottom: 15 },
    selectItemsBtnText: { color: '#000', fontWeight: 'bold', fontSize: 13 },

    previewSection: { backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    previewTitle: { color: '#d4af37', fontSize: 14, fontWeight: 'bold', marginBottom: 12 },
    previewItem: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#222' },
    previewProductName: { color: '#fff', fontWeight: 'bold', marginBottom: 6 },
    previewDetails: { paddingLeft: 10 },
    previewLabel: { color: '#999', fontSize: 12, marginBottom: 3 },

    saveBtn: { backgroundColor: '#d4af37', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 30 },
    saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 },

    itemCard: { backgroundColor: '#111', padding: 15, borderRadius: 10, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    itemCardSelected: { borderColor: '#d4af37', backgroundColor: 'rgba(212, 175, 55, 0.1)' },
    itemName: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginBottom: 4 },
    itemDetails: { color: '#999', fontSize: 12, marginBottom: 2 },
    itemSupplier: { color: '#666', fontSize: 11, fontStyle: 'italic' },

    // Qty Selector Styles
    qtySelectorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#111',
        padding: 10,
        marginTop: -10,
        marginBottom: 10,
        borderBottomLeftRadius: 10,
        borderBottomRightRadius: 10,
        borderWidth: 1,
        borderColor: '#d4af37',
        borderTopWidth: 0
    },
    qtyLabel: { color: '#888', fontSize: 12 },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    qtyBtn: { backgroundColor: '#333', padding: 5, borderRadius: 5 },
    qtyValueContainer: { minWidth: 30, alignItems: 'center' },
    qtyValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' }
});
