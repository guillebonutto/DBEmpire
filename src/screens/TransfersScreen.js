import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, StatusBar, ScrollView, TextInput, Modal, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFinanceStore } from '../store/useFinanceStore';
import { useProductStore } from '../store/useProductStore';
import { useClientStore } from '../store/useClientStore';
import { LocalDbService } from '../services/localDbService';
import { SyncService } from '../services/syncService';

export default function TransfersScreen({ navigation }) {
    const [transfers, setTransfers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [trackingModal, setTrackingModal] = useState({ visible: false, number: '' });

    useFocusEffect(
        useCallback(() => {
            fetchTransfers();
        }, [])
    );

    const cordobaProducts = useProductStore(state => state.products || []);
    const cordobaStock = React.useMemo(() => {
        return cordobaProducts.filter(p => (Number(p.stock_cordoba) || 0) > 0);
    }, [cordobaProducts]);

    const fetchTransfers = async () => {
        setLoading(true);
        try {
            const finState = useFinanceStore.getState();
            const clientState = useClientStore.getState();
            const prodState = useProductStore.getState();

            const isFinInit = finState.isInitialized;
            const isClientInit = clientState.isInitialized;
            const isProdInit = prodState.isInitialized;

            let sales = finState.sales;
            let clients = clientState.clients;
            let products = prodState.products;
            let saleItems = null;

            // Only query SQLite if store has not been initialized yet
            if (!isFinInit || !isClientInit || !isProdInit) {
                const results = await Promise.all([
                    !isFinInit ? LocalDbService.getAll('sales') : Promise.resolve(sales),
                    !isClientInit ? LocalDbService.getAll('clients') : Promise.resolve(clients),
                    LocalDbService.getAll('sale_items'),
                    !isProdInit ? LocalDbService.getAll('products') : Promise.resolve(products)
                ]);
                sales = results[0] || [];
                clients = results[1] || [];
                saleItems = results[2] || [];
                products = results[3] || [];
            }

            const clientMap = {};
            for (let i = 0; i < (clients || []).length; i++) {
                const c = clients[i];
                clientMap[c.id] = c;
            }

            const prodMap = {};
            for (let i = 0; i < (products || []).length; i++) {
                const p = products[i];
                prodMap[p.id] = p;
            }

            // Filter transfers
            const transferSales = (sales || []).filter(s => {
                const clientName = clientMap[s.client_id]?.name?.toLowerCase() || '';
                const isSocio = clientName.includes('cordoba') || clientName.includes('cba') || clientName.includes('socio') || clientName.includes('nico');
                const isTransferStatus = s.status === 'ready_to_ship' || s.status === 'in_transit' || s.status === 'transfer_completed';
                return isSocio || isTransferStatus;
            });

            // If sale_items weren't loaded yet and sales don't have them preloaded
            if (!saleItems && transferSales.length > 0 && transferSales.some(s => !Array.isArray(s.sale_items))) {
                saleItems = await LocalDbService.getAll('sale_items');
            }

            // Group saleItems by sale_id in a single pass O(Items)
            const itemsBySale = {};
            if (saleItems) {
                for (let i = 0; i < saleItems.length; i++) {
                    const it = saleItems[i];
                    if (!it || !it.sale_id) continue;
                    if (!itemsBySale[it.sale_id]) itemsBySale[it.sale_id] = [];
                    itemsBySale[it.sale_id].push({
                        ...it,
                        products: prodMap[it.product_id] || { name: 'Producto' }
                    });
                }
            }

            const enriched = transferSales.map(s => {
                if (Array.isArray(s.sale_items) && s.sale_items.length > 0) {
                    return s;
                }
                return { ...s, sale_items: itemsBySale[s.id] || [] };
            });

            setTransfers(enriched);
        } catch (e) {
            console.log('Error fetching transfers offline:', e);
        } finally {
            setLoading(false);
        }
    };

    const getSaleById = async (saleId) => {
        const fromMemory = useFinanceStore.getState().sales?.find(s => s.id === saleId);
        if (fromMemory) return fromMemory;
        return (await LocalDbService.getById?.('sales', saleId)) || { id: saleId };
    };

    const handleUpdateStatus = async (saleId, currentStatus) => {
        let nextStatus = '';
        let confirmMsg = '';

        if (currentStatus === 'ready_to_ship') {
            nextStatus = 'in_transit';
            confirmMsg = '¿Confirmás que el transporte ya se llevó este paquete?';
        } else if (currentStatus === 'in_transit') {
            nextStatus = 'transfer_completed';
            confirmMsg = '¿Confirmás la recepción de esta mercadería en Córdoba? Se sumará al stock regional.';
        }

        Alert.alert(
            'Actualizar Estado',
            confirmMsg,
            [
                { text: 'Cancelar', style: 'cancel' },
                { 
                    text: 'SÍ, CONFIRMAR', 
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const currentSale = await getSaleById(saleId);
                            const updatedSale = { ...currentSale, status: nextStatus };

                            // 1. Optimistic Sale Update in SQLite and Memory Store
                            await LocalDbService.saveItem('sales', updatedSale);
                            useFinanceStore.getState().updateSaleLocal(updatedSale);
                            await SyncService.queueAction('sales', updatedSale, {}, 'UPDATE');

                            // 2. If received, add to Cordoba stock
                            if (nextStatus === 'transfer_completed') {
                                const transfer = transfers.find(t => t.id === saleId);
                                let items = transfer?.sale_items;
                                if (!items || items.length === 0) {
                                    const fetched = (await LocalDbService.getBy?.('sale_items', 'sale_id', saleId))
                                        || (await LocalDbService.getAll('sale_items')).filter(i => i.sale_id === saleId);
                                    items = fetched || [];
                                }

                                const prodState = useProductStore.getState();
                                for (const item of items) {
                                    const p = prodState.products?.find(prod => prod.id === item.product_id)
                                        || (await LocalDbService.getById?.('products', item.product_id));
                                    if (p) {
                                        const newCordobaStock = (p.stock_cordoba || 0) + (parseInt(item.quantity) || 1);
                                        const updatedProd = {
                                            ...p,
                                            stock_cordoba: newCordobaStock,
                                            current_stock: (p.stock_local || 0) + newCordobaStock
                                        };
                                        await LocalDbService.saveItem('products', updatedProd);
                                        useProductStore.getState().updateProductLocal(updatedProd);
                                        await SyncService.queueAction('products', updatedProd, {}, 'UPDATE');
                                    }
                                }
                            }

                            SyncService.syncPending().catch(e => console.log('Silent transfer sync:', e.message));

                            fetchTransfers();
                            Alert.alert('✅ Éxito', `El envío ahora figura como ${nextStatus.toUpperCase()}`);
                        } catch (e) {
                            Alert.alert('Error', e.message);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleUpdateTracking = async (saleId, trackingNumber) => {
        try {
            const currentSale = await getSaleById(saleId);
            const updatedSale = { ...currentSale, tracking_number: trackingNumber };

            await LocalDbService.saveItem('sales', updatedSale);
            useFinanceStore.getState().updateSaleLocal(updatedSale);
            await SyncService.queueAction('sales', updatedSale, {}, 'UPDATE');
            SyncService.syncPending().catch(e => console.log('Silent tracking sync:', e.message));

            fetchTransfers();
            Alert.alert('✅ Éxito', 'Número de seguimiento actualizado.');
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar el seguimiento.');
        }
    };

    const renderTransferItem = ({ item }) => {
        const isReady = item.status === 'ready_to_ship';
        const isInTransit = item.status === 'in_transit';
        const isCompleted = item.status === 'completed' || item.status === 'transfer_completed';

        return (
            <View style={[styles.card, isReady && styles.cardReady]}>
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                        <Text style={styles.cardId}>#{item.id.slice(0, 8).toUpperCase()}</Text>
                    </View>
                    <View style={[styles.statusBadge, isReady && { backgroundColor: '#f1c40f' }, isInTransit && { backgroundColor: '#3498db' }, isCompleted && { backgroundColor: '#2ecc71' }]}>
                        <Text style={styles.statusText}>{isCompleted ? 'ENTREGADO (CBA)' : item.status.toUpperCase().replace('_', ' ')}</Text>
                    </View>
                </View>

                {item.sale_items.map((si, i) => (
                    <Text key={i} style={styles.itemText}>• {si.products?.name} (x{si.quantity}) {si.color ? `| ${si.color}` : ''}</Text>
                ))}

                {/* TRACKING SECTION */}
                <View style={styles.trackingBox}>
                    <Text style={styles.trackingLabel}>GUÍA / SEGUIMIENTO:</Text>
                    <View style={styles.trackingRow}>
                        <TextInput 
                            style={styles.trackingInput} 
                            placeholder="Ej: B0297-00039571" 
                            placeholderTextColor="#444" 
                            defaultValue={item.tracking_number}
                            onSubmitEditing={(e) => handleUpdateTracking(item.id, e.nativeEvent.text)}
                        />
                        <TouchableOpacity 
                            style={styles.trackBtn} 
                            onPress={() => setTrackingModal({ visible: true, number: item.tracking_number })}
                        >
                            <MaterialCommunityIcons name="radar" size={20} color="#d4af37" />
                        </TouchableOpacity>
                    </View>
                </View>

                {(isReady || isInTransit) && (
                    <TouchableOpacity 
                        style={[styles.actionBtn, isReady ? styles.sendBtn : styles.receiveBtn]} 
                        onPress={() => handleUpdateStatus(item.id, item.status)}
                    >
                        <MaterialCommunityIcons name={isReady ? "truck-fast" : "check-all"} size={20} color="#000" />
                        <Text style={styles.actionBtnText}>{isReady ? 'MARCAR COMO ENVIADO' : 'RECIBIR EN CÓRDOBA'}</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="chevron-left" size={30} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.title}>LOGÍSTICA CÓRDOBA</Text>
                <TouchableOpacity onPress={fetchTransfers}>
                    <MaterialCommunityIcons name="refresh" size={24} color="#d4af37" />
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.newBtn} onPress={() => navigation.navigate('NewTransfer')}>
               <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.newGradient}>
                    <MaterialCommunityIcons name="plus-box" size={24} color="#000" />
                    <Text style={styles.newBtnText}>ARMAR NUEVO PAQUETE</Text>
               </LinearGradient>
            </TouchableOpacity>

            {/* RESUMEN DE STOCK EN CÓRDOBA */}
            <View style={styles.stockSummaryContainer}>
                <Text style={styles.summaryTitle}>STOCK ACTUAL EN CÓRDOBA:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.summaryScroll}>
                    {cordobaStock.map(p => (
                        <View key={p.id} style={styles.summaryCard}>
                            <Text style={styles.summaryName}>{p.name}</Text>
                            <Text style={styles.summaryQty}>{p.stock_cordoba} uni.</Text>
                        </View>
                    ))}
                </ScrollView>
            </View>

            {loading && transfers.length === 0 ? (
                <ActivityIndicator color="#d4af37" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={transfers}
                    keyExtractor={item => item.id}
                    renderItem={renderTransferItem}
                    initialNumToRender={8}
                    maxToRenderPerBatch={8}
                    windowSize={5}
                    removeClippedSubviews={Platform.OS === 'android'}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 100 }}>
                            <MaterialCommunityIcons name="truck-outline" size={60} color="#222" />
                            <Text style={{ color: '#555', marginTop: 10 }}>No hay envíos registrados.</Text>
                        </View>
                    }
                />
            )}

            {/* MODAL DE RASTREO AUTOMÁTICO */}
            <Modal visible={trackingModal.visible} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
                    <View style={styles.modalHeader}>
                        <TouchableOpacity onPress={() => setTrackingModal({ visible: false, number: '' })}>
                            <MaterialCommunityIcons name="close-circle" size={30} color="#d4af37" />
                        </TouchableOpacity>
                        <Text style={styles.modalTitle}>RASTREO BALUT EXPRESS</Text>
                        <View style={{ width: 30 }} />
                    </View>
                    
                    <WebView 
                        source={{ uri: 'http://balutexpress.com.ar/Home/Seguimiento' }}
                        injectedJavaScript={`
                            setTimeout(() => {
                                const input = document.querySelector('input[type="text"]') || document.querySelector('input');
                                const btn = document.querySelector('button') || document.querySelector('.btn-primary');
                                if (input) {
                                    input.value = '${trackingModal.number}';
                                    input.dispatchEvent(new Event('input', { bubbles: true }));
                                    if (btn) btn.click();
                                }
                            }, 2500);
                            true;
                        `}
                        style={{ flex: 1 }}
                        startInLoadingState={true}
                        renderLoading={() => <ActivityIndicator color="#d4af37" size="large" style={styles.loader} />}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
    title: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    newBtn: { margin: 20, borderRadius: 15, overflow: 'hidden' },
    newGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
    newBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
    card: { backgroundColor: '#0a0a0a', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#111' },
    cardReady: { borderColor: '#f1c40f', borderWidth: 2 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
    cardDate: { color: '#666', fontSize: 10, fontWeight: 'bold' },
    cardId: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: '900' },
    itemText: { color: '#ccc', fontSize: 13, marginBottom: 5 },
    
    trackingBox: { marginTop: 15, padding: 12, backgroundColor: '#050505', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#d4af37' },
    trackingLabel: { color: '#555', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
    trackingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    trackingInput: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700', paddingVertical: 5 },
    trackBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },

    actionBtn: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 10, gap: 10 },
    sendBtn: { backgroundColor: '#f1c40f' },
    receiveBtn: { backgroundColor: '#2ecc71' },
    actionBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },

    stockSummaryContainer: { paddingHorizontal: 20, marginBottom: 10 },
    summaryTitle: { color: '#d4af37', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
    summaryScroll: { flexDirection: 'row' },
    summaryCard: { backgroundColor: '#111', padding: 12, borderRadius: 10, marginRight: 10, borderLeftWidth: 3, borderLeftColor: '#d4af37' },
    summaryName: { color: '#fff', fontSize: 11, fontWeight: 'bold', maxWidth: 100 },
    summaryQty: { color: '#d4af37', fontSize: 14, fontWeight: '900', marginTop: 4 },

    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
    modalTitle: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    loader: { position: 'absolute', top: '50%', left: '50%', marginLeft: -20, marginTop: -20 }
});
