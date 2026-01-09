
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Linking, Alert } from 'react-native';
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
            fetchOrders();
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

    const handleStatusChange = async (item) => {
        const newStatus = item.status === 'received' ? 'pending' : 'received';
        await supabase.from('supplier_orders').update({ status: newStatus }).eq('id', item.id);
        fetchOrders();
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
            fetchOrders();
        }
    };

    const renderOrderItem = ({ item }) => {
        const totalInstallments = item.installments_total || 1;
        const paidInstallments = item.installments_paid || 0;
        const amountPerInstallment = item.total_cost / totalInstallments;
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
    };

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
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

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
    emptyText: { color: '#666', marginTop: 10, fontSize: 16 }
});
