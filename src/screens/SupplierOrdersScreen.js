
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Linking, Alert, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SupplierOrdersScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [pendingWizardOrders, setPendingWizardOrders] = useState([]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_orders')
                .select('*')
                .order('created_at', { ascending: false });

            setOrders(data || []);

            // 2. Check for received orders with un-processed items (Wizard interrupted)
            if (data) {
                const receivedIds = data.filter(o => o.status === 'received').map(o => o.id);
                if (receivedIds.length > 0) {
                    // Fetch items with their current product costs to detect unfinished price reviews
                    const { data: items } = await supabase
                        .from('supplier_order_items')
                        .select('id, supplier_order_id, product_id, cost_per_unit, products(cost_price)')
                        .in('supplier_order_id', receivedIds);
                    
                    if (items) {
                        const now = new Date();
                        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                        const pendingItemIds = items.filter(item => {
                            // 1. Unlinked items ALWAYS show in pending
                            const needsLink = !item.product_id;
                            if (needsLink) return true;

                            // 2. Cost change ONLY shows if order is recent (last 7 days)
                            // or it won't be visible to avoid cluttering with old orders
                            const order = data.find(o => o.id === item.supplier_order_id);
                            const orderDate = order ? new Date(order.created_at) : null;
                            const isOld = orderDate && orderDate < sevenDaysAgo;
                            
                            const currentCost = item.products ? parseFloat(item.products.cost_price) || 0 : 0;
                            const hasCostChange = item.product_id && Math.abs(currentCost - parseFloat(item.cost_per_unit)) > 0.01;
                            
                            return hasCostChange && !isOld;
                        }).map(i => i.supplier_order_id);

                        const uniqueOrderIds = [...new Set(pendingItemIds)];
                        const pending = data.filter(o => uniqueOrderIds.includes(o.id));
                        setPendingWizardOrders(pending);
                    }
                } else {
                    setPendingWizardOrders([]);
                }
            }
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            const init = async () => {
                await fetchOrders();
            };
            init();
        }, [])
    );

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

    const handleDelete = (id) => {
        const performDelete = async () => {
            await supabase.from('supplier_orders').delete().eq('id', id);
            fetchOrders();
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Borrar este pedido del historial?')) {
                performDelete();
            }
        } else {
            Alert.alert('Eliminar', '¿Borrar este pedido del historial?', [
                { text: 'Cancelar' },
                {
                    text: 'Borrar',
                    style: 'destructive',
                    onPress: performDelete
                }
            ]);
        }
    };

    const handleReceiveOrder = async (order) => {
        const isResuming = order.status === 'received';

        const confirmReception = async () => {
            setLoading(true);
            try {
                // 1. Get Items
                const { data: items, error: itemsError } = await supabase
                    .from('supplier_order_items')
                    .select('*')
                    .eq('supplier_order_id', order.id);

                if (itemsError) throw itemsError;

                const linkedItems = items.filter(i => i.product_id);
                const unlinkedItems = items.filter(i => !i.product_id);

                // 2. Separate Items (Auto-Update vs Wizard)
                const itemsToAutoUpdate = [];
                const itemsToReview = [];

                // Process Linked Items
                const productCheckPromises = linkedItems.map(async (item) => {
                    const { data: product } = await supabase
                        .from('products')
                        .select('*')
                        .eq('id', item.product_id)
                        .single();

                    if (product) {
                        const currentCost = parseFloat(product.cost_price) || 0;
                        const newCost = parseFloat(item.cost_per_unit) || 0;

                        if (Math.abs(currentCost - newCost) > 0.01) {
                            itemsToReview.push({
                                id: item.id,
                                product: product,
                                name: product.name,
                                color: item.color,
                                cost: item.cost_per_unit,
                                quantity: item.quantity,
                                provider: order.provider_name
                            });
                        } else {
                            itemsToAutoUpdate.push({ item, product });
                        }
                    } else {
                        // BROKEN LINK: The product pointed to no longer exists.
                        // Treat it as unlinked so it appears in the wizard for correction.
                        itemsToReview.push({
                            id: item.id,
                            name: item.temp_product_name || "Producto (Vínculo Roto)",
                            color: item.color,
                            cost: item.cost_per_unit,
                            quantity: item.quantity,
                            provider: order.provider_name,
                            isNew: true
                        });
                    }
                });
                await Promise.all(productCheckPromises);

                // Add Unlinked Items to Review Queue
                unlinkedItems.forEach(item => {
                    itemsToReview.push({
                        id: item.id,
                        name: item.temp_product_name,
                        color: item.color,
                        cost: item.cost_per_unit,
                        quantity: item.quantity,
                        provider: order.provider_name,
                        isNew: true
                    });
                });

                // 3. Execute Auto-Updates (Only if NOT resuming)
                if (!isResuming) {
                    const autoUpdatePromises = itemsToAutoUpdate.map(({ item, product }) => {
                        const newStock = (parseInt(product.current_stock) || 0) + parseInt(item.quantity);
                        const newLocalStock = (parseInt(product.stock_local) || 0) + parseInt(item.quantity);

                        const productPromises = [];
                        productPromises.push(
                            supabase
                                .from('products')
                                .update({ current_stock: newStock, stock_local: newLocalStock })
                                .eq('id', item.product_id)
                        );

                        if (item.color) {
                            productPromises.push(
                                supabase.rpc('upsert_variant_stock', {
                                    p_id: item.product_id,
                                    p_color: item.color,
                                    p_qty: parseInt(item.quantity)
                                })
                            );
                        }
                        return Promise.all(productPromises);
                    });
                    await Promise.all(autoUpdatePromises);

                    // 4. Update Order Status
                    await supabase
                        .from('supplier_orders')
                        .update({ status: 'received' })
                        .eq('id', order.id);
                    
                    // Refresh orders early so auto-updated products are visible
                    fetchOrders();
                }


                // Processing grouped review list
                const groupedReviewItems = [];
                itemsToReview.forEach(item => {
                    const key = item.isNew ? (item.name || 'Sin Nombre') : item.product?.id;
                    let existing = groupedReviewItems.find(g => {
                        if (item.isNew) return g.isNew && g.name === key;
                        return !g.isNew && g.product?.id === key;
                    });

                    if (existing) {
                        existing.ids.push(item.id);
                        existing.quantity = (parseInt(existing.quantity) || 0) + (parseInt(item.quantity) || 0);
                        if (item.color) {
                            existing.variantsGrouped = existing.variantsGrouped || [];
                            existing.variantsGrouped.push({ color: item.color, qty: item.quantity });
                        }
                    } else {
                        groupedReviewItems.push({
                            ...item,
                            ids: [item.id],
                            variantsGrouped: item.color ? [{ color: item.color, qty: item.quantity }] : []
                        });
                    }
                });


                // 5. Navigate to Wizard if needed
                if (groupedReviewItems.length > 0) {
                    if (Platform.OS === 'web') {
                        alert(`📦 Revisión Necesaria: Se detectaron ${groupedReviewItems.length} productos para revisar. Te guiaremos para actualizarlos.`);
                        navigation.navigate('AddProduct', {
                            importQueue: groupedReviewItems,
                            importIndex: 0
                        });
                    } else {
                        Alert.alert(
                            '📦 Revisión Necesaria',
                            `Se detectaron ${groupedReviewItems.length} productos para revisar. Te guiaremos para actualizarlos.`,
                            [
                                {
                                    text: 'Comenzar',
                                    onPress: () => {
                                        navigation.navigate('AddProduct', {
                                            importQueue: groupedReviewItems,
                                            importIndex: 0
                                        });
                                    }
                                }
                            ]
                        );
                    }
                } else {
                    if (Platform.OS === 'web') {
                        alert('✅ Inventario actualizado correctamente.');
                    } else {
                        Alert.alert('✅ Éxito', 'Inventario actualizado correctamente.');
                    }
                    fetchOrders();
                }
            } catch (err) {
                if (Platform.OS === 'web') {
                    alert('Error: Falló la recepción: ' + err.message);
                } else {
                    Alert.alert('Error', 'Falló la recepción: ' + err.message);
                }
            } finally {
                setLoading(false);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Confirmas que llegó este pedido? Se actualizará el inventario.')) {
                confirmReception();
            }
        } else {
            Alert.alert(
                'Recibir Mercadería',
                '¿Confirmas que llegó este pedido? Se actualizará el inventario.',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Confirmar Recepción', onPress: confirmReception }
                ]
            );
        }
    };

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
            // Create expense entry
            const effectiveTotal = (item.total_cost || 0) - (item.discount || 0);
            const amountPerInstallment = effectiveTotal / total;

            await supabase.from('expenses').insert({
                description: `Cuota ${currentPaid + 1}: ${item.provider_name}`,
                amount: amountPerInstallment,
                category: 'Inventario'
            });

            fetchOrders();
        }
    };

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
                <View style={[styles.card, isPaidOff && { borderColor: '#2ecc71' }]}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="cube-send" size={24} color="#d4af37" style={{ marginRight: 10 }} />
                            <View>
                                <Text style={styles.providerName}>{item.provider_name}</Text>
                                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[
                                styles.statusBadge, 
                                { backgroundColor: item.status === 'received' ? '#27ae60' : (item.status === 'consigned' ? '#e74c3c' : '#e67e22') }
                            ]}>
                                <Text style={styles.statusText}>
                                    {item.status === 'received' ? 'RECIBIDO' : (item.status === 'consigned' ? 'CONSIGNACIÓN' : 'EN CAMINO')}
                                </Text>
                            </View>
                            {(item.status !== 'consigned' && (item.notes || '').toUpperCase().includes('CONSIGNACION')) && (
                                <View style={[styles.statusBadge, { backgroundColor: '#e74c3c', marginLeft: 5 }]}>
                                    <Text style={styles.statusText}>CONSIGNACIÓN</Text>
                                </View>
                            )}
                            {item.status === 'pending' || (item.status === 'consigned' && !item.notes?.includes('MANUALLY_RECEIVED')) ? (
                                <TouchableOpacity
                                    style={styles.receiveBtn}
                                    onPress={() => handleReceiveOrder(item)}
                                >
                                    <MaterialCommunityIcons name="package-variant-closed" size={16} color="#000" />
                                    <Text style={styles.receiveBtnText}>RECIBIR</Text>
                                </TouchableOpacity>
                            ) : (
                                <TouchableOpacity
                                    onPress={() => handleDelete(item.id)}
                                    style={{ padding: 5 }}
                                >
                                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ff4444" />
                                </TouchableOpacity>
                            )}
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
                            <Text style={styles.summaryLabel}>Total Deuda</Text>
                            <Text style={styles.summaryValue}>${item.total_cost?.toLocaleString()}</Text>
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
                </View>
            </TouchableOpacity >
        );
    }, []);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>COMPRAS (IMPORTACIONES)</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => navigation.navigate('NewSupplierOrder')}
                >
                    <MaterialCommunityIcons name="plus" size={24} color="#000" />
                    <Text style={styles.addBtnText}>NUEVA ORDEN</Text>
                </TouchableOpacity>
            </View>

            {loading && orders.length === 0 && (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#d4af37" />
                    <Text style={{ color: '#666', marginTop: 10 }}>Cargando Importaciones...</Text>
                </View>
            )}

            {pendingWizardOrders.length > 0 && (
                <View style={styles.pendingSection}>
                    <View style={styles.pendingHeader}>
                        <MaterialCommunityIcons name="alert-circle" size={20} color="#e67e22" />
                        <Text style={styles.pendingTitle}>INGRESOS PENDIENTES ({pendingWizardOrders.length})</Text>
                    </View>
                    <Text style={styles.pendingSubtitle}>Tienes productos de envíos recibidos que aún no procesaste en el inventario.</Text>
                    {pendingWizardOrders.map(order => (
                        <TouchableOpacity 
                            key={order.id} 
                            style={styles.pendingCard}
                            onPress={() => handleReceiveOrder(order)}
                        >
                            <View style={{ flex: 1 }}>
                                <Text style={styles.pendingOrderName}>{order.provider_name}</Text>
                                <Text style={styles.pendingOrderDate}>{new Date(order.created_at).toLocaleDateString()}</Text>
                            </View>
                            <View style={styles.resumeBtn}>
                                <MaterialCommunityIcons name="play-circle" size={16} color="#000" />
                                <Text style={styles.resumeBtnText}>REANUDAR</Text>
                            </View>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <FlatList
                data={orders}
                keyExtractor={item => item.id}
                renderItem={renderOrderItem}
                contentContainerStyle={{ padding: 20 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchOrders} tintColor="#d4af37" />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name="airplane" size={50} color="#333" />
                        <Text style={styles.emptyText}>No hay pedidos a proveedores.</Text>
                    </View>
                }
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1 },
    addBtn: { flexDirection: 'row', backgroundColor: '#d4af37', padding: 10, borderRadius: 8, alignItems: 'center' },
    addBtnText: { fontWeight: 'bold', marginLeft: 5 },

    card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, alignItems: 'center' },
    providerName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, marginRight: 10 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    receiveBtn: { flexDirection: 'row', backgroundColor: '#2ecc71', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5, alignItems: 'center' },
    receiveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 10, marginLeft: 4 },
    trackBtnFixed: { backgroundColor: '#d4af37', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
    trackBtnDisabled: { backgroundColor: '#333' },
    trackBtnTextFixed: { color: '#000', fontSize: 11, fontWeight: '900' },

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

    summaryContainer: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#252525', padding: 10, borderRadius: 8, marginBottom: 15 },
    summaryLabel: { color: '#888', fontSize: 10, textTransform: 'uppercase', marginBottom: 2 },
    summaryValue: { color: '#d4af37', fontSize: 14, fontWeight: 'bold' },

    progressContainer: { marginBottom: 15 },
    progressBarBg: { height: 6, backgroundColor: '#333', borderRadius: 3, marginBottom: 5 },
    progressBarFill: { height: '100%', backgroundColor: '#d4af37', borderRadius: 3 },
    progressText: { color: '#666', fontSize: 11, fontStyle: 'italic', textAlign: 'right' },

    payBtn: { backgroundColor: '#222', padding: 12, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#d4af37' },
    payBtnText: { color: '#d4af37', fontSize: 12, fontWeight: 'bold', letterSpacing: 1 },

    date: { color: '#666', fontSize: 12 },
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#666', marginTop: 10, fontSize: 16 },

    discountBadge: { backgroundColor: 'rgba(46, 204, 113, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 8 },
    discountText: { color: '#2ecc71', fontSize: 10, fontWeight: 'bold' },

    // Pending Section Styles
    pendingSection: { padding: 20, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#333' },
    pendingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
    pendingTitle: { color: '#e67e22', fontWeight: '900', fontSize: 12, marginLeft: 8, letterSpacing: 1 },
    pendingSubtitle: { color: '#888', fontSize: 11, marginBottom: 15 },
    pendingCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 10 },
    pendingOrderName: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    pendingOrderDate: { color: '#555', fontSize: 11 },
    resumeBtn: { flexDirection: 'row', backgroundColor: '#e67e22', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, alignItems: 'center' },
    resumeBtnText: { color: '#000', fontWeight: '900', fontSize: 10, marginLeft: 5 }
});
