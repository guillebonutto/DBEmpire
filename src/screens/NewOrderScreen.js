import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { SyncService, getStableItemId } from '../services/syncService';
import { LocalDbService } from '../services/localDbService';
import { useProductStore } from '../store/useProductStore';
import { useClientStore } from '../store/useClientStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
}

export default function NewOrderScreen({ navigation }) {
    const storeProducts = useProductStore(state => state.products);
    const storeClients = useClientStore(state => state.clients);

    const activeProducts = useMemo(() => {
        return (storeProducts || []).filter(p => p.active !== false && p.active !== 0);
    }, [storeProducts]);

    const [cart, setCart] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState('seller');

    // Modals
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [clientModalVisible, setClientModalVisible] = useState(false);

    // Client Search & Inline Create State
    const [searchQuery, setSearchQuery] = useState('');
    const [clientError, setClientError] = useState(false);
    const [creatingClient, setCreatingClient] = useState(false);

    // Selection State
    const [selectedClient, setSelectedClient] = useState(null);
    const [loading, setLoading] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [selectedColor, setSelectedColor] = useState(null);

    // Inline Quantity State
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [tempQty, setTempQty] = useState(1);

    // Prevent duplicate concurrent submissions
    const isSubmittingRef = useRef(false);

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setCurrentUserRole(role);
        });
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const productStore = useProductStore.getState();
            const clientStore = useClientStore.getState();

            // 1. Ensure local SQLite hydration
            const inits = [];
            if (!productStore.isInitialized) inits.push(productStore.initStore());
            if (!clientStore.isInitialized) inits.push(clientStore.initStore());
            if (inits.length > 0) {
                await Promise.all(inits);
            }

            // 2. If online, perform background sync without blocking UI
            const netInfo = await NetInfo.fetch();
            if (netInfo.isConnected) {
                Promise.all([
                    productStore.fetchProducts(true),
                    clientStore.fetchClients(true)
                ]).catch(err => {
                    console.log('[NewOrder] Background refresh error:', err?.message);
                });
            }
        } catch (e) {
            console.log('[NewOrder] fetchData error:', e?.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddProductPress = () => {
        if (!selectedClient) {
            setClientError(true);
            return;
        }
        setProductModalVisible(true);
    };

    // Precalculate cart quantities map for O(1) stock availability lookup
    const cartQuantities = useMemo(() => {
        const map = new Map();
        for (let i = 0; i < cart.length; i++) {
            const id = cart[i].id;
            map.set(id, (map.get(id) || 0) + (cart[i].qty || 0));
        }
        return map;
    }, [cart]);

    const getAvailableStock = useCallback((item) => {
        const inCartQty = cartQuantities.get(item.id) || 0;
        return (item.current_stock || 0) - inCartQty;
    }, [cartQuantities]);

    const initiateProductSelection = (item) => {
        const available = getAvailableStock(item);

        if (available <= 0) {
            Alert.alert('Sin Stock', 'No queda stock disponible para este producto.');
            return;
        }

        setExpandedProductId(item.id);
        setSelectedColor(null);
        setTempQty(1);
    };

    const adjustTempQty = (delta, maxStock) => {
        setTempQty(prev => {
            const newVal = prev + delta;
            if (newVal < 1) return 1;
            if (newVal > maxStock) return maxStock;
            return newVal;
        });
    };

    const confirmAddToCart = (product) => {
        // Validation for variants
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

    const removeFromCart = (cartId) => {
        setCart(prev => prev.filter(item => (item.cartId || item.id) !== cartId));
    };

    const { total, totalProfit } = useMemo(() => {
        let t = 0;
        let p = 0;
        for (let i = 0; i < cart.length; i++) {
            const item = cart[i];
            const itemTotal = (item.sale_price || 0) * item.qty;
            const itemCost = (item.cost_price || 0) * item.qty;
            t += itemTotal;
            p += (itemTotal - itemCost);
        }
        return { total: t, totalProfit: p };
    }, [cart]);

    const handleCheckout = () => {
        if (cart.length === 0) return;
        if (!selectedClient) {
            setClientModalVisible(true);
            return;
        }

        Alert.alert(
            'Confirmar Pedido',
            'Se creará un pedido pendiente de cliente y se reservará el stock.',
            [
                { text: 'Cancelar', style: 'cancel' },
                { text: 'Crear Pedido', onPress: () => processOrder(selectedClient) }
            ]
        );
    };

    const createClientInline = async (name) => {
        const trimmed = (name || '').trim();
        if (!trimmed) return;
        setCreatingClient(true);
        try {
            const newClient = {
                id: generateUUID(),
                name: trimmed,
                phone: '',
                status: 'active',
                created_at: new Date().toISOString()
            };

            // 1. Optimistic SQLite and Store update
            await useClientStore.getState().addClientLocally(newClient);

            // 2. Queue for background remote sync
            await SyncService.queueAction('client', newClient, {}, 'INSERT');

            // 3. Select newly created client and close modal
            setSelectedClient(newClient);
            setSearchQuery('');
            setClientModalVisible(false);
        } catch (error) {
            console.log('Error creating client inline:', error);
            Alert.alert('Error', 'No se pudo crear el cliente.');
        } finally {
            setCreatingClient(false);
        }
    };

    const filteredClients = useMemo(() => {
        if (!searchQuery) return storeClients || [];
        const q = searchQuery.toLowerCase();
        return (storeClients || []).filter(c => (c.name || '').toLowerCase().includes(q));
    }, [searchQuery, storeClients]);

    const processOrder = async (client) => {
        if (isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setLoading(true);

        try {
            // 1. Business rules & dependency checks
            if (!client || !client.id) {
                Alert.alert('Error', 'Seleccione un cliente válido.');
                return;
            }
            if (!cart || cart.length === 0) {
                Alert.alert('Error', 'El carrito está vacío.');
                return;
            }

            const currentProducts = useProductStore.getState().products;
            for (const item of cart) {
                const prod = currentProducts.find(p => p.id === item.id);
                if (!prod) {
                    Alert.alert('Error', `Producto no disponible: ${item.name || item.id}`);
                    return;
                }
                const available = prod.current_stock || 0;
                if (item.qty > available) {
                    Alert.alert('Stock Insuficiente', `Stock insuficiente para ${prod.name}. Disponible: ${available}, solicitado: ${item.qty}`);
                    return;
                }
                if (item.selectedColor && prod.variants && Array.isArray(prod.variants)) {
                    const cleanColor = item.selectedColor.trim().toLowerCase();
                    const v = prod.variants.find(v => v.color?.trim().toLowerCase() === cleanColor);
                    if (v && parseInt(v.stock) < item.qty) {
                        Alert.alert('Stock Insuficiente', `No hay suficiente stock del color ${item.selectedColor} para ${prod.name}.`);
                        return;
                    }
                }
            }

            // 2. Seller ID from local session cache
            let sellerId = await AsyncStorage.getItem('user_id');
            if (!sellerId) sellerId = await AsyncStorage.getItem('profile_id');
            if (!sellerId) sellerId = '00000000-0000-0000-0000-000000000000';

            // 3. Stable UUID v4 for the sale
            const saleId = generateUUID();
            const salePayload = {
                id: saleId,
                seller_id: sellerId,
                client_id: client.id,
                total_amount: total,
                profit_generated: totalProfit,
                commission_amount: 0,
                status: 'pending',
                payment_method: 'Efectivo',
                sale_location: 'local',
                notes: trackingNumber ? `Tracking: ${trackingNumber}` : null,
                created_at: new Date().toISOString()
            };

            // 4. Calculate updated products for stock deduction (handles repeated product lines and color variants)
            const productDeductionMap = new Map();
            for (const item of cart) {
                let prod = productDeductionMap.get(item.id);
                if (!prod) {
                    const found = currentProducts.find(p => p.id === item.id);
                    if (!found) continue;
                    prod = JSON.parse(JSON.stringify(found));
                    productDeductionMap.set(item.id, prod);
                }

                const qty = parseInt(item.qty) || 0;
                const currentLoc = parseInt(prod.stock_local) || 0;
                prod.stock_local = Math.max(0, currentLoc - qty);
                prod.current_stock = (parseInt(prod.stock_local) || 0) + (parseInt(prod.stock_cordoba) || 0);

                if (item.selectedColor && prod.variants) {
                    let variants = Array.isArray(prod.variants)
                        ? prod.variants
                        : (typeof prod.variants === 'string' ? JSON.parse(prod.variants) : []);
                    const cleanColor = item.selectedColor.trim().toLowerCase();
                    const vIdx = variants.findIndex(v => v.color?.trim().toLowerCase() === cleanColor);
                    if (vIdx >= 0) {
                        const currentVarStock = parseInt(variants[vIdx].stock) || 0;
                        variants[vIdx].stock = Math.max(0, currentVarStock - qty).toString();
                        prod.variants = variants;
                    }
                }
            }
            const updatedProductsList = Array.from(productDeductionMap.values());

            // 5. Build optimistic items with stable deterministic UUIDs for in-memory Finance Store and SQLite
            const optimisticSaleItems = cart.map((item, idx) => {
                const stableId = getStableItemId(saleId, item, idx);
                return {
                    id: stableId,
                    sale_id: saleId,
                    product_id: item.id,
                    quantity: item.qty,
                    unit_price_at_sale: item.sale_price || 0,
                    subtotal: (item.sale_price || 0) * item.qty,
                    color: item.selectedColor || null,
                    products: { name: item.name }
                };
            });

            // 6. ATOMIC WRITE: Write sale, sale_items, product stock updates and pending_sync in a SINGLE SQLite transaction
            await LocalDbService.createOrderAtomic({
                sale: salePayload,
                saleItems: optimisticSaleItems,
                updatedProducts: updatedProductsList,
                metadata: {
                    items: cart.map((item, idx) => ({
                        ...item,
                        item_id: getStableItemId(saleId, item, idx)
                    }))
                }
            });

            // 7. Synchronize Zustand in-memory state ONLY AFTER successful SQLite transaction
            useProductStore.setState(state => ({
                products: state.products.map(p => productDeductionMap.get(p.id) || p)
            }));

            useFinanceStore.getState().addSaleLocal({
                ...salePayload,
                clients: { name: client.name },
                sale_items: optimisticSaleItems
            }, optimisticSaleItems);

            // 8. Silent background sync attempt
            SyncService.syncPending().catch(e => console.log('[NewOrder] Silent sync error:', e?.message));

            Alert.alert(
                '✅ Pedido Creado',
                `El pedido ha sido guardado y el stock reservado.`,
                [{
                    text: 'OK', onPress: () => {
                        setCart([]);
                        setSelectedClient(null);
                        navigation.goBack();
                    }
                }]
            );

        } catch (error) {
            console.log('Order Error:', error);
            Alert.alert('Error', 'No se pudo crear el pedido.');
        } finally {
            isSubmittingRef.current = false;
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>NUEVO PEDIDO CLIENTE</Text>
                    <View style={{ width: 24 }} />
                </View>
                <View style={styles.totalBadge}>
                    <Text style={styles.totalLabel}>TOTAL PEDIDO</Text>
                    <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                    {selectedClient ? (
                        <Text style={styles.clientLabel}>CLIENTE: {selectedClient.name}</Text>
                    ) : (
                        <Text style={[styles.clientLabel, { color: '#888', fontStyle: 'italic' }]}>Seleccione Cliente</Text>
                    )}
                </View>
            </LinearGradient>

            {/* Tracking (Optional) */}
            <View style={styles.trackingContainer}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#d4af37" style={{ marginRight: 10 }} />
                <TextInput
                    style={styles.trackingInput}
                    placeholder="Número de seguimiento (Opcional)"
                    placeholderTextColor="#666"
                    value={trackingNumber}
                    onChangeText={setTrackingNumber}
                />
            </View>

            {/* Client Search */}
            <View style={styles.searchContainer}>
                {!selectedClient ? (
                    <TouchableOpacity
                        style={styles.searchBar}
                        onPress={() => setClientModalVisible(true)}
                    >
                        <MaterialCommunityIcons name="account-plus" size={24} color="#d4af37" />
                        <Text style={{ color: '#888', marginLeft: 10 }}>Seleccionar Cliente...</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.selectedClientRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.selectedAvatar}>
                                <Text style={{ color: '#000', fontWeight: 'bold' }}>{selectedClient.name.charAt(0)}</Text>
                            </View>
                            <Text style={styles.selectedName}>{selectedClient.name}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedClient(null)}>
                            <MaterialCommunityIcons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
                {clientError && !selectedClient && <Text style={{ color: '#e74c3c', fontSize: 12, marginTop: 5 }}>Requerido</Text>}
            </View>

            <FlatList
                data={cart}
                keyExtractor={item => item.cartId || item.id}
                contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                <Text style={styles.itemMeta}>Cant: {item.qty} x ${item.sale_price}</Text>
                                {item.selectedColor && (
                                    <View style={styles.cartColorBadge}>
                                        <Text style={styles.cartColorText}>{item.selectedColor}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                        <Text style={styles.itemTotal}>${(item.sale_price * item.qty).toFixed(2)}</Text>
                        <TouchableOpacity onPress={() => removeFromCart(item.cartId || item.id)} style={styles.removeBtn}>
                            <MaterialCommunityIcons name="delete-outline" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>Lista Vacía</Text>
                        <Text style={styles.emptySubtext}>Agrega productos al pedido</Text>
                    </View>
                }
            />

            <View style={styles.footer}>
                <TouchableOpacity style={styles.addProductBtn} onPress={handleAddProductPress}>
                    <MaterialCommunityIcons name="plus" size={24} color="#000" />
                    <Text style={styles.addProductText}>AÑADIR</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.checkoutBtn, cart.length === 0 && styles.disabled]}
                    onPress={handleCheckout}
                    disabled={cart.length === 0 || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <Text style={styles.checkoutText}>GUARDAR PEDIDO</Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* PRODUCT MODAL */}
            <Modal visible={productModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Agregar al Pedido</Text>
                    <FlatList
                        data={activeProducts}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            const available = getAvailableStock(item);
                            const isExpanded = expandedProductId === item.id;

                            return (
                                <View style={[styles.productRow, isExpanded && { borderColor: '#d4af37', borderWidth: 2 }]}>
                                    {!isExpanded ? (
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}
                                            onPress={() => initiateProductSelection(item)}
                                        >
                                            <View style={{ flex: 1, marginRight: 15 }}>
                                                <Text style={styles.rowTitle} numberOfLines={2}>{item.name}</Text>
                                                <Text style={[styles.rowSubtitle, { color: available < 5 ? '#e74c3c' : '#888' }]}>Disp: {available}</Text>
                                            </View>
                                            <Text style={styles.rowPrice} numberOfLines={1}>${item.sale_price}</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' }}>
                                                <Text style={[styles.rowTitle, { flex: 1, marginRight: 15 }]} numberOfLines={2}>{item.name}</Text>
                                                <Text style={styles.rowPrice}>${item.sale_price}</Text>
                                            </View>

                                            {/* SELECTOR DE COLORES */}
                                            {item.variants && item.variants.length > 0 && (
                                                <View style={styles.variantSection}>
                                                    <Text style={styles.variantLabel}>Seleccione Color:</Text>
                                                    <View style={styles.variantGrid}>
                                                        {item.variants.map((v, i) => (
                                                            <TouchableOpacity
                                                                key={i}
                                                                onPress={() => setSelectedColor(v.color)}
                                                                style={[
                                                                    styles.variantChip,
                                                                    selectedColor === v.color && styles.variantChipSelected
                                                                ]}
                                                            >
                                                                <Text style={[
                                                                    styles.variantChipText,
                                                                    selectedColor === v.color && styles.variantChipTextSelected
                                                                ]}>{v.color}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}

                                            <View style={styles.qtyContainer}>
                                                <TouchableOpacity onPress={() => adjustTempQty(-1, available)} style={styles.qtyBtn}>
                                                    <MaterialCommunityIcons name="minus" size={24} color="#fff" />
                                                </TouchableOpacity>
                                                <Text style={styles.qtyText}>{tempQty}</Text>
                                                <TouchableOpacity onPress={() => adjustTempQty(1, available)} style={styles.qtyBtn}>
                                                    <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                            <View style={{ flexDirection: 'row', marginTop: 15, gap: 10 }}>
                                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#333' }]} onPress={() => setExpandedProductId(null)}>
                                                    <Text style={{ color: '#fff' }}>Cancelar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#d4af37', flex: 1 }]} onPress={() => confirmAddToCart(item)}>
                                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>AGREGAR</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setProductModalVisible(false)}>
                        <Text style={styles.closeText}>Listo</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* CLIENT MODAL */}
            <Modal visible={clientModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Cliente del Pedido</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Buscar cliente..."
                        placeholderTextColor="#666"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />

                    {searchQuery.length > 0 && filteredClients.length === 0 && (
                        <TouchableOpacity
                            style={styles.createOption}
                            onPress={() => createClientInline(searchQuery)}
                            disabled={creatingClient}
                        >
                            {creatingClient ? (
                                <ActivityIndicator color="#000" />
                            ) : (
                                <Text style={styles.createText}>Crear "{searchQuery}"</Text>
                            )}
                        </TouchableOpacity>
                    )}

                    <FlatList
                        data={filteredClients}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.productRow} onPress={() => {
                                setSelectedClient(item);
                                setClientModalVisible(false);
                            }}>
                                <Text style={styles.rowTitle}>{item.name}</Text>
                                <MaterialCommunityIcons name="chevron-right" size={24} color="#d4af37" />
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setClientModalVisible(false)}>
                        <Text style={styles.closeText}>Cerrar</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { padding: 20, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { color: '#666', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    totalBadge: { alignItems: 'center', marginTop: 10 },
    totalLabel: { color: '#888', fontSize: 10, letterSpacing: 2, fontWeight: '700' },
    totalAmount: { color: '#d4af37', fontSize: 42, fontWeight: '900' },
    clientLabel: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginTop: 5 },

    trackingContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 15, margin: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
    trackingInput: { flex: 1, color: '#fff', fontSize: 16 },

    searchContainer: { paddingHorizontal: 15, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
    selectedClientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, borderColor: '#d4af37', borderWidth: 1 },
    selectedAvatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', marginRight: 10 },
    selectedName: { color: '#fff', fontWeight: 'bold', fontSize: 16 },

    cartItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    itemMeta: { color: '#888', fontSize: 12 },
    itemTotal: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginHorizontal: 10 },
    removeBtn: { padding: 5 },

    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { color: '#666', fontSize: 18, fontWeight: 'bold' },
    emptySubtext: { color: '#444', fontSize: 14 },

    footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, paddingBottom: 50, backgroundColor: '#1a1a1a', flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#333' },
    addProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#333', borderRadius: 10, padding: 15, marginRight: 10 },
    addProductText: { color: '#fff', fontWeight: 'bold', marginLeft: 5 },
    checkoutBtn: { flex: 2, backgroundColor: '#d4af37', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    checkoutText: { color: '#000', fontWeight: '900' },
    disabled: { opacity: 0.5, backgroundColor: '#333' },

    modalContent: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 50 },
    modalTitle: { fontSize: 24, fontWeight: '900', color: '#d4af37', marginBottom: 20, textAlign: 'center' },
    productRow: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    rowTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    rowSubtitle: { color: '#888', fontSize: 12 },
    rowPrice: { color: '#d4af37', fontSize: 16, fontWeight: 'bold' },

    variantSection: { marginVertical: 15, borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15 },
    variantLabel: { color: '#888', fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: 10 },
    variantGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    variantChip: { backgroundColor: '#222', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#444' },
    variantChipSelected: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    variantChipText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
    variantChipTextSelected: { color: '#000' },

    cartColorBadge: { backgroundColor: '#222', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 10, borderWidth: 1, borderColor: '#d4af3730' },
    cartColorText: { color: '#d4af37', fontSize: 10, fontWeight: '900' },

    qtyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', padding: 10, borderRadius: 8 },
    qtyBtn: { backgroundColor: '#333', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    qtyText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },

    smallBtn: { padding: 12, borderRadius: 8, alignItems: 'center' },
    closeBtn: { marginTop: 20, padding: 15, backgroundColor: '#222', borderRadius: 12, alignItems: 'center' },
    closeText: { color: '#888', fontWeight: 'bold' },

    input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 15 },
    createOption: { backgroundColor: '#d4af37', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 15 },
    createText: { color: '#000', fontWeight: 'bold' }
});
