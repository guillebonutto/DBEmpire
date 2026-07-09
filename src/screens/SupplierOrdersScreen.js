import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Linking, Alert, ActivityIndicator, Platform, Modal, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';

export default function SupplierOrdersScreen({ navigation }) {
    const { supplierOrders: orders, supplierOrderItems: allItems, isLoading: loading, fetchAllData } = useFinanceStore();
    const { products } = useProductStore();
    const [pendingWizardOrders, setPendingWizardOrders] = useState([]);

    // Always refresh from Supabase when entering this screen so both users see the latest orders
    useFocusEffect(
        useCallback(() => {
            fetchAllData(true);
        }, [fetchAllData])
    );

    // Consignment payment modal
    const [payModalVisible, setPayModalVisible] = useState(false);
    const [payModalOrder, setPayModalOrder] = useState(null);
    const [payModalItems, setPayModalItems] = useState([]);
    const [soldQtys, setSoldQtys] = useState({});
    const [payNote, setPayNote] = useState('');

    useEffect(() => {
        const pending = orders.filter(order => {
            if (order.status !== 'received') return false;
            const items = allItems.filter(i => i.supplier_order_id === order.id);
            // Only need wizard if at least one item is NOT linked to a product_id
            return items.some(i => !i.product_id);
        });
        setPendingWizardOrders(pending);
    }, [orders, allItems]);

    const handleMarkReceived = async (order) => {
        try {
            const { error } = await supabase
                .from('supplier_orders')
                .update({ 
                    status: 'received',
                    received_at: new Date().toISOString()
                })
                .eq('id', order.id);

            if (error) throw error;
            
            Alert.alert('📦 Recibido', 'El pedido fue marcado como recibido. ¿Querés vincular los productos al stock ahora?', [
                { text: 'Más tarde', style: 'cancel' },
                { text: 'SÍ, VINCULAR', onPress: () => handleStartWizard(order) }
            ]);
            
            fetchAllData(true);
        } catch (err) {
            Alert.alert('Error', 'No se pudo actualizar el estado.');
        }
    };

    const handleStartWizard = (order) => {
        const itemsToLink = allItems.filter(i => i.supplier_order_id === order.id && !i.product_id);
        if (itemsToLink.length === 0) {
            Alert.alert('Listo', 'Todos los productos de este pedido ya están vinculados.');
            return;
        }

        navigation.navigate('AddProduct', {
            importQueue: itemsToLink,
            importIndex: 0,
            originalOrderDate: order.created_at
        });
    };

    const handleTrack = (order) => {
        const tracking = order.tracking_number;
        const courier = (order.notes || '').toLowerCase();
        if (!tracking) {
            Alert.alert('Sin Seguimiento', 'Este pedido no tiene seguimiento.');
            return;
        }
        let url = 'https://postal.ninja/es/p/tracking/' + tracking.trim();
        if (courier.includes('oca')) url = `https://www.oca.com.ar/Seguimiento/BuscarEnvio/paquetes/${tracking.trim()}`;
        if (courier.includes('andreani')) url = `https://seguimiento.andreani.com/envio/${tracking.trim()}`;
        Linking.openURL(url);
    };

    const handleOpenPayModal = (order) => {
        setPayModalOrder(order);
        const items = allItems.filter(i => i.supplier_order_id === order.id);
        setPayModalItems(items);
        const initQtys = {};
        items.forEach(i => { initQtys[i.id] = '0'; });
        setSoldQtys(initQtys);
        setPayNote('');
        setPayModalVisible(true);
    };

    const calcPayTotal = () => {
        return payModalItems.reduce((sum, it) => {
            const qty = parseInt(soldQtys[it.id] || '0', 10) || 0;
            const cost = parseFloat(it.cost_per_unit) || 0;
            return sum + qty * cost;
        }, 0);
    };

    const renderOrderItem = useCallback(({ item }) => {
        const totalInstallments = item.installments_total || 1;
        const paidInstallments = item.installments_paid || 0;
        const isPaidOff = paidInstallments >= totalInstallments;

        return (
            <TouchableOpacity 
                style={[styles.card, isPaidOff && { borderColor: '#2ecc71' }]}
                onPress={() => navigation.navigate('NewSupplierOrder', { orderToEdit: item })}
            >
                <View style={styles.cardHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="cube-send" size={24} color="#d4af37" style={{ marginRight: 10 }} />
                        <View>
                            <Text style={styles.providerName}>{item.provider_name}</Text>
                            <Text style={styles.date}>Pedido: {new Date(item.created_at).toLocaleDateString()}</Text>
                            {item.received_at && (
                                <Text style={[styles.date, { color: '#2ecc71', marginTop: 2 }]}>
                                    Recibido: {new Date(item.received_at).toLocaleDateString()}
                                </Text>
                            )}
                        </View>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: item.status === 'received' ? '#27ae60' : '#e67e22' }]}>
                        <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
                    </View>
                </View>

                <View style={styles.summaryContainer}>
                    <View>
                        <Text style={styles.summaryLabel}>Total Deuda</Text>
                        <Text style={styles.summaryValue}>${item.total_cost?.toLocaleString()}</Text>
                    </View>
                    <View>
                        <Text style={styles.summaryLabel}>Cuotas</Text>
                        <Text style={styles.summaryValue}>{paidInstallments}/{totalInstallments}</Text>
                    </View>
                </View>

                {item.status !== 'received' && (
                    <TouchableOpacity 
                        style={[styles.receiveBtn, item.status === 'consigned' && { backgroundColor: '#2ecc71' }]} 
                        onPress={() => handleMarkReceived(item)}
                    >
                        <MaterialCommunityIcons name="package-variant" size={20} color="#000" />
                        <Text style={styles.receiveBtnText}>MARCAR COMO RECIBIDO</Text>
                    </TouchableOpacity>
                )}

                {item.status === 'received' && allItems.filter(i => i.supplier_order_id === item.id && !i.product_id).length > 0 && (
                    <TouchableOpacity style={styles.wizardBtn} onPress={() => handleStartWizard(item)}>
                        <MaterialCommunityIcons name="auto-fix" size={20} color="#000" />
                        <Text style={styles.wizardBtnText}>✨ VINCULAR AL STOCK (WIZARD)</Text>
                    </TouchableOpacity>
                )}
                
                {item.tracking_number && item.status !== 'received' && (
                    <TouchableOpacity style={styles.trackBtnFixed} onPress={() => handleTrack(item)}>
                        <Text style={styles.trackBtnTextFixed}>RASTREAR ENVÍO</Text>
                    </TouchableOpacity>
                )}
            </TouchableOpacity>
        );
    }, [allItems]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>IMPERIO - IMPORTACIONES</Text>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="close" size={26} color="#fff" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={orders}
                keyExtractor={item => item.id}
                renderItem={renderOrderItem}
                contentContainerStyle={{ padding: 20 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={() => fetchAllData(true)} tintColor="#d4af37" />}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay órdenes registradas.</Text>}
            />

            <Modal visible={payModalVisible} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Pago de Consignación</Text>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {payModalItems.map(it => (
                                <View key={it.id} style={styles.itemRow}>
                                    <Text style={styles.itemName}>{it.temp_product_name || 'Producto'}</Text>
                                    <TextInput 
                                        style={styles.qtyInput}
                                        value={soldQtys[it.id]}
                                        onChangeText={v => setSoldQtys(prev => ({...prev, [it.id]: v}))}
                                        keyboardType="numeric"
                                    />
                                </View>
                            ))}
                        </ScrollView>
                        <Text style={styles.modalTotalValue}>Total a Pagar: ${calcPayTotal()}</Text>
                        <TouchableOpacity style={styles.modalConfirmBtn} onPress={() => setPayModalVisible(false)}>
                            <Text style={styles.modalConfirmText}>CONFIRMAR PAGO</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    title: { color: '#d4af37', fontSize: 16, fontWeight: '900' },
    backBtn: { padding: 5 },
    card: { backgroundColor: '#111', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    providerName: { color: '#fff', fontWeight: 'bold' },
    date: { color: '#555', fontSize: 12 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    summaryContainer: { flexDirection: 'row', gap: 20, marginBottom: 15 },
    summaryLabel: { color: '#666', fontSize: 10 },
    summaryValue: { color: '#fff', fontWeight: 'bold' },
    payConsignBtn: { backgroundColor: '#d4af37', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10 },
    payConsignBtnText: { fontWeight: '900', color: '#000' },
    receiveBtn: { backgroundColor: '#d4af37', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 10 },
    receiveBtnText: { fontWeight: '900', color: '#000', fontSize: 12 },
    wizardBtn: { backgroundColor: '#9b59b6', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center', gap: 10 },
    wizardBtnText: { fontWeight: '900', color: '#fff', fontSize: 12 },
    trackBtnFixed: { backgroundColor: '#222', padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 10, borderWidth: 1, borderColor: '#333' },
    trackBtnTextFixed: { color: '#d4af37', fontWeight: 'bold' },
    emptyText: { color: '#444', textAlign: 'center', marginTop: 50 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalBox: { backgroundColor: '#111', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333' },
    modalTitle: { color: '#d4af37', fontSize: 18, fontWeight: 'bold', marginBottom: 20 },
    itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    itemName: { color: '#fff', flex: 1 },
    qtyInput: { backgroundColor: '#222', color: '#fff', width: 50, textAlign: 'center', borderRadius: 5, padding: 5 },
    modalTotalValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginVertical: 20, textAlign: 'center' },
    modalConfirmBtn: { backgroundColor: '#2ecc71', padding: 15, borderRadius: 10, alignItems: 'center' },
    modalConfirmText: { fontWeight: 'bold' }
});
