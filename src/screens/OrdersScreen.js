
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function OrdersScreen({ navigation }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Fetch everything that is NOT completed (e.g., pending, shipped)
            const { data, error } = await supabase
                .from('sales')
                .select('*, clients(name)')
                .neq('status', 'completed')
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
        if (!trackingNumber) {
            Alert.alert('Info', 'No hay número de seguimiento');
            return;
        }
        // Universal Tracking Link (17TRACK auto-detect)
        const url = `https://t.17track.net/en#nums=${trackingNumber}`;
        Linking.openURL(url);
    };

    const handleFinishOrder = async (order) => {
        Alert.alert(
            'Finalizar Pedido',
            '¿Marcar como Entregado/Finalizado? Pasará al historial de ventas.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Finalizar',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error } = await supabase
                                .from('sales')
                                .update({ status: 'completed' })
                                .eq('id', order.id);

                            if (error) throw error;
                            fetchOrders();
                            Alert.alert('Éxito', 'Pedido finalizado y archivado.');
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo actualizar.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderOrderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.orderId}>Pedido #{item.id.slice(0, 4)}</Text>
                    <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: item.tracking_number ? '#2980b9' : '#e67e22' }]}>
                    <Text style={styles.statusText}>{item.tracking_number ? 'ENVIADO' : 'PENDIENTE'}</Text>
                </View>
            </View>

            <Text style={styles.clientName}>{item.clients ? item.clients.name : 'Cliente Anónimo'}</Text>
            <Text style={styles.amount}>Total: ${item.total_amount}</Text>

            {/* Tracking Section */}
            {item.tracking_number ? (
                <TouchableOpacity style={styles.trackRow} onPress={() => handleTrack(item.tracking_number)}>
                    <MaterialCommunityIcons name="radar" size={20} color="#d4af37" />
                    <Text style={styles.trackText}>Seguimiento: {item.tracking_number}</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#666" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            ) : (
                <Text style={styles.noTrack}>Sin número de seguimiento</Text>
            )}

            <View style={styles.actions}>
                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleFinishOrder(item)}
                >
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionText}>FINALIZAR</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>PEDIDOS CLIENTES</Text>
                <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => navigation.navigate('NewOrder')}
                >
                    <MaterialCommunityIcons name="plus" size={24} color="#000" />
                    <Text style={styles.addBtnText}>NUEVO</Text>
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
                        <MaterialCommunityIcons name="package-variant-closed" size={50} color="#333" />
                        <Text style={styles.emptyText}>No hay pedidos pendientes.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1 },
    addBtn: { flexDirection: 'row', backgroundColor: '#d4af37', padding: 10, borderRadius: 8, alignItems: 'center' },
    addBtnText: { fontWeight: 'bold', marginLeft: 5 },

    card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    orderId: { color: '#888', fontWeight: 'bold' },
    date: { color: '#666', fontSize: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    clientName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    amount: { color: '#2ecc71', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },

    trackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 15, alignSelf: 'flex-start' },
    trackText: { color: '#d4af37', marginLeft: 10, fontWeight: '600' },
    noTrack: { color: '#444', fontStyle: 'italic', marginBottom: 15, fontSize: 12 },

    actions: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15, alignItems: 'flex-end' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27ae60', padding: 10, borderRadius: 8 },
    actionText: { color: '#fff', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },

    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#666', marginTop: 10, fontSize: 16 }
});
