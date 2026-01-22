
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Linking, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SupplierOrdersScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

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
            const init = async () => {
                await fetchOrders();
            };
            init();
        }, [])
    );

    const handleTrack = (trackingNumber) => {
        if (!trackingNumber) return;
        const url = `https://t.17track.net/en#nums=${trackingNumber}`;
        Linking.openURL(url);
    };

    const handleDelete = (id) => {
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

    const handleReceiveOrder = async (order) => {
        if (order.status === 'received') return;

        Alert.alert(
            'Recibir Mercadería',
            '¿Confirmas que llegó este pedido? Se actualizará el inventario.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Confirmar Recepción',
                    onPress: async () => {
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

                            // Process Linked Items in Parallel
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
                                            cost: item.cost_per_unit,
                                            quantity: item.quantity,
                                            provider: order.provider_name
                                        });
                                    } else {
                                        itemsToAutoUpdate.push({ item, product });
                                    }
                                }
                            });
                            await Promise.all(productCheckPromises);

                            // Add Unlinked Items to Review Queue
                            unlinkedItems.forEach(item => {
                                itemsToReview.push({
                                    id: item.id,
                                    name: item.temp_product_name,
                                    cost: item.cost_per_unit,
                                    quantity: item.quantity,
                                    provider: order.provider_name,
                                    isNew: true
                                });
                            });

                            // 3. Execute Auto-Updates in Parallel
                            const autoUpdatePromises = itemsToAutoUpdate.map(({ item, product }) => {
                                const newStock = (parseInt(product.current_stock) || 0) + parseInt(item.quantity);
                                return supabase
                                    .from('products')
                                    .update({ current_stock: newStock })
                                    .eq('id', item.product_id);
                            });
                            await Promise.all(autoUpdatePromises);

                            // 4. Update Order Status
                            await supabase
                                .from('supplier_orders')
                                .update({ status: 'received' })
                                .eq('id', order.id);


                            // 5. Navigate to Wizard if needed
                            if (itemsToReview.length > 0) {
                                Alert.alert(
                                    '📦 Revisión Necesaria',
                                    `Se detectaron ${itemsToReview.length} productos nuevos o con cambio de precio. Te guiaremos para actualizarlos.`,
                                    [
                                        {
                                            text: 'Comenzar',
                                            onPress: () => {
                                                navigation.navigate('AddProduct', {
                                                    importQueue: itemsToReview,
                                                    importIndex: 0
                                                });
                                            }
                                        }
                                    ]
                                );
                            } else {
                                Alert.alert('✅ Éxito', 'Inventario actualizado correctamente.');
                                fetchOrders();
                            }
                        } catch (err) {
                            Alert.alert('Error', 'Falló la recepción: ' + err.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
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
                        <View style={[styles.statusBadge, { backgroundColor: item.status === 'received' ? '#27ae60' : '#e67e22' }]}>
                            <Text style={styles.statusText}>{item.status === 'received' ? 'RECIBIDO' : 'EN CAMINO'}</Text>
                        </View>
                        {item.status === 'pending' && (
                            <TouchableOpacity
                                style={styles.receiveBtn}
                                onPress={() => handleReceiveOrder(item)}
                            >
                                <MaterialCommunityIcons name="package-variant-closed" size={16} color="#000" />
                                <Text style={styles.receiveBtnText}>RECIBIR</Text>
                            </TouchableOpacity>
                        )}
                    </View>

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
            </TouchableOpacity>
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
    discountText: { color: '#2ecc71', fontSize: 10, fontWeight: 'bold' }
});
