
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

    const renderOrderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="cube-send" size={24} color="#d4af37" style={{ marginRight: 10 }} />
                    <Text style={styles.providerName}>{item.provider_name}</Text>
                </View>
                <TouchableOpacity onPress={() => handleStatusChange(item)} style={[styles.statusBadge, { backgroundColor: item.status === 'received' ? '#27ae60' : '#e67e22' }]}>
                    <Text style={styles.statusText}>{item.status === 'received' ? 'RECIBIDO' : 'EN CAMINO'}</Text>
                </TouchableOpacity>
            </View>

            <Text style={styles.desc}>{item.items_description}</Text>
            {item.total_cost > 0 && <Text style={styles.cost}>Costo: ${item.total_cost}</Text>}

            {/* Tracking Section */}
            {item.tracking_number ? (
                <TouchableOpacity style={styles.trackRow} onPress={() => handleTrack(item.tracking_number)}>
                    <MaterialCommunityIcons name="radar" size={20} color="#3498db" />
                    <Text style={styles.trackText}>{item.tracking_number}</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#666" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            ) : (
                <Text style={styles.noTrack}>Sin tracking</Text>
            )}

            <View style={styles.footerRow}>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#666" />
                </TouchableOpacity>
            </View>
        </View>
    );

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

    card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
    providerName: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    desc: { color: '#ccc', marginBottom: 10, fontSize: 14 },
    cost: { color: '#fff', fontWeight: 'bold', marginBottom: 10 },

    trackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 15, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#333' },
    trackText: { color: '#3498db', marginLeft: 10, fontWeight: '600', letterSpacing: 1 },
    noTrack: { color: '#444', fontStyle: 'italic', marginBottom: 15, fontSize: 12 },

    footerRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10 },
    date: { color: '#666', fontSize: 12 },

    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#666', marginTop: 10, fontSize: 16 }
});
