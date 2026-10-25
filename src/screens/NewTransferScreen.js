
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar, TextInput, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useProductStore } from '../store/useProductStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { LocalDbService } from '../services/localDbService';
import { SyncService } from '../services/syncService';

export default function NewTransferScreen({ navigation }) {
    const { products: storeProducts, fetchProducts: fetchStoreProducts } = useProductStore();
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [tempQty, setTempQty] = useState(1);
    const [selectedColor, setSelectedColor] = useState(null);

    useEffect(() => {
        loadProducts();
    }, []);

    const loadProducts = async () => {
        setLoading(true);
        try {
            fetchStoreProducts();
            const local = await LocalDbService.getAll('products');
            if (local && local.length > 0) {
                setProducts(local.filter(p => p.active));
            } else {
                setProducts(useProductStore.getState().products.filter(p => p.active));
            }
        } catch (err) {
            console.log('Error loading products offline:', err);
        } finally {
            setLoading(false);
        }
    };

    const confirmAddToTransfer = (product) => {
        if (product.variants && product.variants.length > 0 && !selectedColor) {
            Alert.alert('Color Requerido', 'Por favor seleccione un color para este producto.');
            return;
        }

        const uniqueCartId = `${product.id}-${selectedColor || 'none'}`;
        setCart(prev => {
            const existing = prev.find(item => item.cartId === uniqueCartId);
            if (existing) {
                return prev.map(item => item.cartId === uniqueCartId ? { ...item, qty: item.qty + tempQty } : item);
            }
            return [...prev, { ...product, qty: tempQty, selectedColor, cartId: uniqueCartId }];
        });
        setExpandedProductId(null);
        setSelectedColor(null);
        setTempQty(1);
    };

    const handleSendTransfer = async () => {
        if (cart.length === 0) return;
        
        setLoading(true);
        try {
            const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });

            // 1. Buscamos o creamos el contacto logístico
            const clients = (await LocalDbService.getAll('clients')) || [];
            let client = clients.find(c => c.name?.toLowerCase().includes('cordoba') || c.name?.toLowerCase().includes('socio'));
            let clientId = client ? client.id : '00000000-0000-0000-0000-000000000000';

            const saleId = generateUUID();
            const totalAmount = cart.reduce((acc, curr) => acc + ((curr.sale_price || 0) * curr.qty), 0);

            // 2. Creamos la venta de transferencia
            const saleData = {
                id: saleId,
                client_id: clientId,
                total_amount: totalAmount,
                status: 'ready_to_ship',
                notes: 'Paquete armado - Pendiente de despacho físico',
                created_at: new Date().toISOString()
            };

            await LocalDbService.saveItem('sales', saleData);
            await SyncService.queueAction('sales', saleData, {}, 'INSERT');

            // 3. Items y descuento de stock local
            const allProds = (await LocalDbService.getAll('products')) || [];
            for (const item of cart) {
                const itemId = generateUUID();
                const saleItem = {
                    id: itemId,
                    sale_id: saleId,
                    product_id: item.id,
                    quantity: item.qty,
                    color: item.selectedColor,
                    unit_price_at_sale: item.sale_price || 0
                };
                await LocalDbService.saveItem('sale_items', saleItem);
                await SyncService.queueAction('sale_items', saleItem, {}, 'INSERT');

                // Descuento stock local
                const p = allProds.find(pr => pr.id === item.id);
                if (p) {
                    const newLocalStock = Math.max(0, (p.stock_local || 0) - item.qty);
                    const updatedP = {
                        ...p,
                        stock_local: newLocalStock,
                        current_stock: newLocalStock + (p.stock_cordoba || 0)
                    };
                    await LocalDbService.saveItem('products', updatedP);
                    await SyncService.queueAction('products', updatedP, {}, 'UPDATE');
                }
            }

            useProductStore.getState().fetchProducts();
            SyncService.syncPending().catch(e => console.log('Silent transfer sync:', e.message));

            Alert.alert('📦 Paquete Armado', 'El stock ya fue descontado. Recordá marcarlo como ENVIADO cuando salga el transporte.');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="close" size={28} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>ARMAR ENVÍO</Text>
                <View style={{ width: 28 }} />
            </View>

            <FlatList
                data={cart}
                keyExtractor={item => item.cartId}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={styles.itemCard}>
                        <View>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemQty}>{item.qty} uni. {item.selectedColor ? `| Color: ${item.selectedColor}` : ''}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setCart(c => c.filter(i => i.cartId !== item.cartId))}>
                            <MaterialCommunityIcons name="trash-can-outline" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={{ alignItems: 'center', marginTop: 100 }}>
                        <MaterialCommunityIcons name="package-variant" size={60} color="#222" />
                        <Text style={{ color: '#444', marginTop: 10 }}>Seleccioná productos del local para enviar.</Text>
                    </View>
                }
            />

            <View style={styles.footer}>
                <TouchableOpacity style={styles.addBtn} onPress={() => setProductModalVisible(true)}>
                    <MaterialCommunityIcons name="plus" size={24} color="#000" />
                    <Text style={styles.addBtnText}>AGREGAR PRODUCTO</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                    style={[styles.sendBtn, cart.length === 0 && { opacity: 0.5 }]} 
                    onPress={handleSendTransfer}
                    disabled={cart.length === 0 || loading}
                >
                    {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.sendBtnText}>CERRAR Y GUARDAR PAQUETE</Text>}
                </TouchableOpacity>
            </View>

            {/* MODAL DE SELECCIÓN */}
            <Modal visible={productModalVisible} animationType="slide">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Stock del Local</Text>
                    <FlatList
                        data={products}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            const isExpanded = expandedProductId === item.id;
                            const available = item.stock_local || 0;
                            return (
                                <View style={styles.productRow}>
                                    {!isExpanded ? (
                                        <TouchableOpacity style={styles.rowInner} onPress={() => { setExpandedProductId(item.id); setSelectedColor(null); }}>
                                            <View style={{ flex: 1, marginRight: 10 }}>
                                                <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
                                                <Text style={styles.rowStock}>Local: {available} uni.</Text>
                                            </View>
                                            <MaterialCommunityIcons name="chevron-right" size={24} color="#d4af37" />
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ padding: 10 }}>
                                            <Text style={styles.rowName} numberOfLines={2}>{item.name}</Text>
                                            
                                            {item.variants && item.variants.length > 0 && (
                                                <View style={{ marginVertical: 10 }}>
                                                    <Text style={{ color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 5 }}>Elegir Color:</Text>
                                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                                        {item.variants.map((v, i) => (
                                                            <TouchableOpacity key={i} onPress={() => setSelectedColor(v.color)} style={[styles.chip, selectedColor === v.color && styles.chipSelected]}>
                                                                <Text style={[styles.chipText, selectedColor === v.color && { color: '#000' }]}>{v.color}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}

                                            <View style={styles.qtyBox}>
                                                <TouchableOpacity onPress={() => setTempQty(Math.max(1, tempQty - 1))}><MaterialCommunityIcons name="minus" size={30} color="#fff" /></TouchableOpacity>
                                                <Text style={{ color: '#fff', fontSize: 24, fontWeight: '900' }}>{tempQty}</Text>
                                                <TouchableOpacity onPress={() => setTempQty(Math.min(available, tempQty + 1))}><MaterialCommunityIcons name="plus" size={30} color="#fff" /></TouchableOpacity>
                                            </View>

                                            <TouchableOpacity style={styles.confirmBtn} onPress={() => confirmAddToTransfer(item)}>
                                                <Text style={{ color: '#000', fontWeight: 'bold' }}>AGREGAR AL PAQUETE</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setProductModalVisible(false)}>
                        <Text style={{ color: '#888' }}>Cerrar catálogo</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    title: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    footer: { padding: 20, borderTopWidth: 1, borderTopColor: '#222' },
    addBtn: { backgroundColor: '#222', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    addBtnText: { color: '#fff', fontWeight: 'bold', marginLeft: 10 },
    sendBtn: { backgroundColor: '#d4af37', alignItems: 'center', padding: 18, borderRadius: 12 },
    sendBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
    itemCard: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#d4af37' },
    itemName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    itemQty: { color: '#888', fontSize: 12, marginTop: 5 },
    modalContent: { flex: 1, backgroundColor: '#000', padding: 20, paddingTop: 50 },
    modalTitle: { color: '#d4af37', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 30 },
    productRow: { backgroundColor: '#111', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
    rowInner: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
    rowStock: { color: '#888', fontSize: 12, marginTop: 4 },
    qtyBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#222', padding: 10, borderRadius: 10, marginVertical: 15 },
    chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, backgroundColor: '#222', borderWidth: 1, borderColor: '#333' },
    chipSelected: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    chipText: { color: '#888', fontWeight: 'bold', fontSize: 12 },
    confirmBtn: { backgroundColor: '#d4af37', padding: 15, borderRadius: 12, alignItems: 'center' },
    closeBtn: { marginTop: 20, padding: 20, alignItems: 'center' }
});
