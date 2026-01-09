
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar, TextInput } from 'react-native'; // Added TextInput
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { NotificationService } from '../services/notificationService';
import { SyncService } from '../services/syncService';
import NetInfo from '@react-native-community/netinfo';

export default function NewSaleScreen({ navigation, route }) {
    const [cart, setCart] = useState([]);
    const [products, setProducts] = useState([]);
    const [clients, setClients] = useState([]);
    const [currentUserRole, setCurrentUserRole] = useState('seller');

    // Modals
    const [productModalVisible, setProductModalVisible] = useState(false);
    const [clientModalVisible, setClientModalVisible] = useState(false);

    // New Client Form State
    const [showNewClientForm, setShowNewClientForm] = useState(false);
    const [newClientName, setNewClientName] = useState('');
    const [newClientPhone, setNewClientPhone] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [clientError, setClientError] = useState(false);
    const [creatingClient, setCreatingClient] = useState(false);

    // Selection State
    const [selectedClient, setSelectedClient] = useState(null);
    const [loading, setLoading] = useState(false);
    const [commissionRate, setCommissionRate] = useState(0.10);
    const [transportCost, setTransportCost] = useState(0);
    const [includeTransport, setIncludeTransport] = useState(false);

    // Inline Quantity State
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [tempQty, setTempQty] = useState(1);

    // Scanner
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setCurrentUserRole(role);
        });
        fetchData();
        fetchCommissionRate();

        // Handle preselected product from Home screen barcode scan
        if (route.params?.preselectedProduct) {
            const product = route.params.preselectedProduct;
            setCart(prev => {
                const existing = prev.find(item => item.id === product.id);
                if (existing) {
                    return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
                }
                return [...prev, { ...product, qty: 1 }];
            });
            navigation.setParams({ preselectedProduct: null });
        }

        // Handle specific mode (e.g. Presupuesto from Home)
        if (route.params?.mode) {
            if (route.params.mode === 'quote') setSaleType('budget');
            navigation.setParams({ mode: null });
        }
    }, [route.params?.preselectedProduct, route.params?.mode]);

    const fetchCommissionRate = async () => {
        try {
            const { data: commData } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'commission_rate')
                .single();

            if (commData) {
                setCommissionRate(parseFloat(commData.value));
            }

            // Fetch transport cost (now a fixed amount, not percentage)
            const { data: transData } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'transport_cost')
                .single();

            if (transData) {
                setTransportCost(parseFloat(transData.value) || 0);
            }
        } catch (error) {
            console.log('Using default rates:', error);
        }
    };

    const fetchData = async () => {
        try {
            const productsReq = supabase.from('products').select('*').eq('active', true).order('name');
            const clientsReq = supabase.from('clients').select('*').order('created_at', { ascending: false });

            const [productsRes, clientsRes] = await Promise.all([productsReq, clientsReq]);

            if (productsRes.data) setProducts(productsRes.data);
            if (clientsRes.data) setClients(clientsRes.data || []);
        } catch (e) { console.log(e); }
    };

    const handleAddProductPress = () => {
        if (!selectedClient) {
            setClientError(true);
            return;
        }
        setProductModalVisible(true);
    };

    // Calculate dynamic availability
    const getAvailableStock = (item) => {
        const inCartItem = cart.find(c => c.id === item.id);
        const inCartQty = inCartItem ? inCartItem.qty : 0;
        return (item.current_stock || 0) - inCartQty;
    };

    const initiateProductSelection = (item) => {
        const available = getAvailableStock(item);

        if (available <= 0) {
            Alert.alert('Sin Stock', 'No queda stock disponible para este producto (revisa tu carrito).');
            return;
        }

        setExpandedProductId(item.id);
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

    const handleBarcodeScanned = ({ data }) => {
        let barcodeData = data;
        // SMART QR HANDLE
        if (data.includes('linktr.ee/digital_boost_empire')) {
            const parts = data.split('barcode=');
            if (parts.length > 1) barcodeData = parts[1];
        }

        setScanned(true);
        setIsScanning(false); // Close immediately

        // Find product
        const product = products.find(p => p.barcode === barcodeData);

        if (product) {
            // Check stock
            const available = getAvailableStock(product);
            if (available > 0) {
                // Add to cart directly (1 unit)
                // We reuse confirmAddToCart but need to wrap it to match the signature or just call setCart
                setCart(prev => {
                    const existing = prev.find(item => item.id === product.id);
                    if (existing) {
                        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
                    }
                    return [...prev, { ...product, qty: 1 }];
                });
                Alert.alert('✅ Agregado', `${product.name} (+1)`);
            } else {
                Alert.alert('Sin Stock', `No hay stock disponible de ${product.name}`);
            }
        } else {
            Alert.alert('No encontrado', `No existe producto con código: ${data}`);
        }
    };

    const confirmAddToCart = (product) => {
        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + tempQty } : item);
            }
            return [...prev, { ...product, qty: tempQty }];
        });
        setExpandedProductId(null);
        setTempQty(1);
        // Do NOT close modal, allow multiple adds
    };

    // Keep legacy for safety if referenced elsewhere, but unused now
    const addToCart = (product) => {
        confirmAddToCart({ ...product, qty: 1 }); // Fallback
    };

    const removeFromCart = (id) => {
        setCart(prev => prev.filter(item => item.id !== id));
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let totalProfit = 0;
        cart.forEach(item => {
            const itemTotal = item.sale_price * item.qty;
            const itemCost = item.cost_price * item.qty;
            subtotal += itemTotal;
            totalProfit += (itemTotal - itemCost);
        });
        const total = subtotal + (includeTransport ? transportCost : 0); // Only add if enabled
        const commission = currentUserRole === 'seller' ? totalProfit * commissionRate : 0;
        return { subtotal, total, totalProfit, commission };
    };

    const { subtotal, total, totalProfit, commission } = calculateTotals();

    const [saleType, setSaleType] = useState('completed'); // completed, pending (debt), budget (quote)

    // Triggered when clicking "COBRAR"
    const handleCheckout = () => {
        if (cart.length === 0) return;

        // Final sanity check for client
        if (!selectedClient && saleType !== 'completed') {
            Alert.alert('Falta Cliente', 'Las deudas y presupuestos requieren seleccionar un cliente.');
            setClientModalVisible(true);
            return;
        }

        if (!selectedClient) {
            setClientModalVisible(true);
            return;
        }
        processCheckout(selectedClient);
    };

    const handleCreateClient = async () => {
        if (!newClientName.trim()) {
            Alert.alert('Error', 'El nombre del cliente es obligatorio');
            return;
        }

        setCreatingClient(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    name: newClientName.trim(),
                    phone: newClientPhone.trim(),
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;

            // Update local list
            setClients(prev => [data, ...prev]);

            // UX: Select automatically, clear form, and proceed to checkout
            setSelectedClient(data);
            setShowNewClientForm(false);
            setNewClientName('');
            setNewClientPhone('');

            setClientModalVisible(false);
            setTimeout(() => {
                processCheckout(data);
            }, 500);

        } catch (error) {
            console.log('Error creating client:', error);
            Alert.alert('Error', 'No se pudo crear el cliente');
        } finally {
            setCreatingClient(false);
        }
    };

    const createClientInline = async (name) => {
        setCreatingClient(true);
        try {
            const { data, error } = await supabase
                .from('clients')
                .insert([{
                    name: name.trim(),
                    // status: 'active' // Ensure your DB has this column, or remove if not migrated yet. User has script.
                    phone: '', // Optional default
                    status: 'active'
                }])
                .select()
                .single();

            if (error) throw error;

            setClients(prev => [data, ...prev]);
            setSelectedClient(data);
            setSearchQuery('');

        } catch (error) {
            console.log('Error creating client inline:', error);
            Alert.alert('Error', 'No se pudo crear el cliente rápido.');
        } finally {
            setCreatingClient(false);
        }
    };

    // Filter clients for search
    const filteredClients = searchQuery.length > 0
        ? clients.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const generateReceiptPDF = async (saleData, client, cart) => {
        try {
            const date = new Date().toLocaleString();
            const htmlContent = `
            <html>
                <body style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                    <div style="text-align: center; border-bottom: 2px solid #d4af37; padding-bottom: 20px; margin-bottom: 20px;">
                        <h1 style="color: #d4af37; margin: 0;">DIGITAL BOOST EMPIRE</h1>
                        <p style="margin: 5px 0;">Recibo de Venta Oficial</p>
                    </div>
                    
                    <div style="margin-bottom: 20px;">
                        <p><strong>Fecha:</strong> ${date}</p>
                        <p><strong>Operación:</strong> #SC-${saleData.id.slice(0, 8).toUpperCase()}</p>
                        <p><strong>Cliente:</strong> ${client ? client.name : 'Venta de Mostrador'}</p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #f8f8f8; border-bottom: 1px solid #eee;">
                                <th style="text-align: left; padding: 10px;">Producto</th>
                                <th style="text-align: center; padding: 10px;">Cant</th>
                                <th style="text-align: right; padding: 10px;">Precio</th>
                                <th style="text-align: right; padding: 10px;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cart.map(item => `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px;">${item.name}</td>
                                    <td style="text-align: center; padding: 10px;">${item.qty}</td>
                                    <td style="text-align: right; padding: 10px;">$${item.sale_price}</td>
                                    <td style="text-align: right; padding: 10px;">$${(item.sale_price * item.qty).toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div style="text-align: right; border-top: 2px solid #d4af37; padding-top: 20px;">
                        <h2 style="margin: 0;">TOTAL A PAGAR: $${total.toFixed(2)}</h2>
                    </div>

                    <div style="margin-top: 50px; text-align: center; color: #888; font-size: 12px;">
                        <p>¡Gracias por elegir al Imperio!</p>
                        <p>Digital Boost Empire - Resultados Reales</p>
                    </div>
                </body>
            </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: 'Enviar Recibo' });
        } catch (error) {
            console.log('Error generating PDF:', error);
            Alert.alert('Error', 'No se pudo generar el recibo digital.');
        }
    };

    const processCheckout = async (client) => {
        setLoading(true);
        try {
            const netState = await NetInfo.fetch();

            // Logic for Seller ID and Device Signature
            const { data: profiles } = await supabase.from('profiles').select('id').eq('role', currentUserRole).limit(1);
            let sellerId = profiles && profiles.length > 0 ? profiles[0].id : null;
            const deviceSig = await require('../services/deviceAuth').DeviceAuthService.getDeviceSignature();

            let salePayload = {
                seller_id: sellerId,
                client_id: client ? client.id : null,
                total_amount: total,
                profit_generated: totalProfit,
                commission_amount: commission,
                status: saleType,
                device_sig: deviceSig
            };

            if (!netState.isConnected) {
                // OFFLINE MODE
                const offlineId = await SyncService.queueSale(salePayload, cart);
                Alert.alert(
                    '📴 Modo Offline Activo',
                    'No tienes internet. La venta se ha guardado localmente y se sincronizará automáticamente cuando recuperes la señal.',
                    [{
                        text: 'ENTENDIDO', onPress: () => {
                            setCart([]);
                            setSelectedClient(null);
                            setClientModalVisible(false);
                            navigation.navigate('Home');
                        }
                    }]
                );
                return;
            }

            // ... Proceed with normal online insert ...
            let { data: saleData, error: saleError } = await supabase
                .from('sales')
                .insert(salePayload)
                .select()
                .single();

            // Fallback: If device_sig column doesn't exist yet, retry without it
            if (saleError && saleError.message.includes('device_sig')) {
                console.log('Retry: device_sig column missing. Inserting without it.');
                delete salePayload.device_sig;
                const retry = await supabase
                    .from('sales')
                    .insert(salePayload)
                    .select()
                    .single();
                saleData = retry.data;
                saleError = retry.error;
            }

            if (saleError) throw saleError;

            // Insert Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: item.qty,
                unit_price_at_sale: item.sale_price,
                subtotal: item.sale_price * item.qty
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) throw itemsError;

            // Update Stock (Skip if it's just a budget/quote)
            if (saleType !== 'budget') {
                const lowStockProducts = [];
                for (const item of cart) {
                    const newStock = (item.current_stock || 0) - item.qty;
                    await supabase.from('products').update({ current_stock: newStock }).eq('id', item.id);

                    if (newStock <= 5) {
                        lowStockProducts.push({ name: item.name, stock: newStock });
                        await NotificationService.sendLowStockAlert(item.name, newStock);
                    }
                }

                // If there are critical products, schedule the 5-hour reminder
                if (lowStockProducts.length > 0) {
                    await NotificationService.scheduleStockReminder(lowStockProducts);
                }
            }

            Alert.alert(
                '✅ Venta Exitosa',
                `Total: $${total.toFixed(2)}\nCliente: ${client ? client.name : 'Anónimo'}\n\n¿Deseas enviar el recibo digital?`,
                [
                    {
                        text: 'No, solo cerrar',
                        style: 'cancel',
                        onPress: () => {
                            setCart([]);
                            setSelectedClient(null);
                            setClientModalVisible(false);
                            navigation.navigate('Sales');
                        }
                    },
                    {
                        text: 'SÍ, ENVIAR RECIBO',
                        onPress: async () => {
                            await generateReceiptPDF(saleData, client, cart);
                            setCart([]);
                            setSelectedClient(null);
                            setClientModalVisible(false);
                            navigation.navigate('Sales');
                        }
                    }
                ]
            );

        } catch (error) {
            console.log('Checkout Error:', error);
            Alert.alert('Error', 'No se pudo procesar la venta.');
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#666" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>NUEVA VENTA</Text>
                <View style={{ width: 24 }} />
            </View>

            <View style={styles.totalBadge}>
                <Text style={styles.totalLabel}>TOTAL A COBRAR</Text>
                <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
                {selectedClient && (
                    <Text style={styles.clientLabel}>CLIENTE: {selectedClient.name}</Text>
                )}
            </View>
        </LinearGradient>
    );

    if (isScanning) {
        return (
            <View style={{ flex: 1, backgroundColor: 'black' }}>
                <CameraView
                    style={{ flex: 1 }}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
                <TouchableOpacity
                    style={{ position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}
                    onPress={() => setIsScanning(false)}
                >
                    <MaterialCommunityIcons name="close" size={30} color="white" />
                </TouchableOpacity>
                <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 10 }}>
                    <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Escanea para agregar al carrito</Text>
                </View>
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {renderHeader()}

            {/* Client Search / Selection Area */}
            <View style={styles.searchContainer}>
                {!selectedClient ? (
                    <View>
                        <View style={[styles.searchBar, clientError && { borderColor: '#ff4d4d', borderWidth: 1 }]}>
                            <MaterialCommunityIcons name="magnify" size={24} color="#666" />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar o Crear Cliente..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={(text) => {
                                    setSearchQuery(text);
                                    if (clientError) setClientError(false);
                                }}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <MaterialCommunityIcons name="close" size={20} color="#666" />
                                </TouchableOpacity>
                            )}
                        </View>
                        {clientError && (
                            <Text style={{ color: '#ff4d4d', fontSize: 12, marginTop: 5, marginLeft: 5 }}>
                                Por favor busque o seleccione cliente antes de continuar
                            </Text>
                        )}

                        {/* Search Results / Create Option */}
                        {searchQuery.length > 0 && (
                            <View style={styles.searchResults}>
                                {/* Create New Option */}
                                {filteredClients.length === 0 && (
                                    <TouchableOpacity
                                        style={styles.createOption}
                                        onPress={() => createClientInline(searchQuery)}
                                    >
                                        <View style={styles.createIcon}>
                                            {creatingClient ? <ActivityIndicator size="small" color="#000" /> : <MaterialCommunityIcons name="plus" size={20} color="#000" />}
                                        </View>
                                        <Text style={styles.createText}>Crear "{searchQuery}"</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Matches */}
                                {filteredClients.map(client => (
                                    <TouchableOpacity
                                        key={client.id}
                                        style={styles.searchResultItem}
                                        onPress={() => {
                                            setSelectedClient(client);
                                            setSearchQuery('');
                                            setClientError(false);
                                        }}
                                    >
                                        <MaterialCommunityIcons name="account" size={20} color="#d4af37" />
                                        <Text style={styles.resultText}>{client.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </View>
                ) : (
                    <View style={styles.selectedClientRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={styles.selectedAvatar}>
                                <Text style={{ color: '#000', fontWeight: 'bold' }}>{selectedClient.name.charAt(0)}</Text>
                            </View>
                            <View>
                                <Text style={styles.selectedLabel}>CLIENTE VINCULADO</Text>
                                <Text style={styles.selectedName}>{selectedClient.name}</Text>
                            </View>
                        </View>
                        <TouchableOpacity onPress={() => setSelectedClient(null)} style={styles.removeClientBtn}>
                            <MaterialCommunityIcons name="close" size={20} color="#fff" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <FlatList
                data={cart}
                keyExtractor={item => item.id}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <View style={styles.cartItem}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            <Text style={styles.itemMeta}>Cant: {item.qty} x ${item.sale_price}</Text>
                        </View>
                        <Text style={styles.itemTotal}>${(item.sale_price * item.qty).toFixed(2)}</Text>
                        <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.removeBtn}>
                            <MaterialCommunityIcons name="delete-outline" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="cart-off" size={60} color="#333" />
                        <Text style={styles.emptyText}>Bolsa Vacía</Text>
                        <Text style={styles.emptySubtext}>Añade productos del inventario</Text>
                    </View>
                }
            />

            {/* Cost Breakdown */}
            {cart.length > 0 && (
                <View style={{ backgroundColor: '#1a1a1a', padding: 15, borderTopWidth: 1, borderTopColor: '#333' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                        <Text style={{ color: '#888', fontSize: 14 }}>Subtotal Productos:</Text>
                        <Text style={{ color: '#fff', fontSize: 14, fontWeight: 'bold' }}>${subtotal.toFixed(2)}</Text>
                    </View>

                    {/* Transport Toggle */}
                    <TouchableOpacity
                        style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 8,
                            padding: 8,
                            backgroundColor: includeTransport ? '#1e2a1e' : 'transparent',
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: includeTransport ? '#2ecc71' : '#333'
                        }}
                        onPress={() => setIncludeTransport(!includeTransport)}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons
                                name={includeTransport ? "checkbox-marked" : "checkbox-blank-outline"}
                                size={20}
                                color={includeTransport ? '#2ecc71' : '#666'}
                                style={{ marginRight: 8 }}
                            />
                            <Text style={{ color: includeTransport ? '#2ecc71' : '#888', fontSize: 14 }}>Incluir Transporte:</Text>
                        </View>
                        <Text style={{ color: includeTransport ? '#2ecc71' : '#666', fontSize: 14, fontWeight: 'bold' }}>
                            ${transportCost.toFixed(2)}
                        </Text>
                    </TouchableOpacity>

                    <View style={{ height: 1, backgroundColor: '#333', marginVertical: 8 }} />
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <Text style={{ color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 }}>TOTAL:</Text>
                        <Text style={{ color: '#d4af37', fontSize: 18, fontWeight: '900' }}>${total.toFixed(2)}</Text>
                    </View>
                </View>
            )}

            {/* Transaction Type Selector */}
            <View style={styles.typeSelector}>
                <TouchableOpacity
                    style={[styles.typeBtn, saleType === 'completed' && styles.typeBtnActive]}
                    onPress={() => setSaleType('completed')}
                >
                    <MaterialCommunityIcons name="currency-usd" size={18} color={saleType === 'completed' ? '#000' : '#888'} />
                    <Text style={[styles.typeText, saleType === 'completed' && styles.typeTextActive]}>VENTA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.typeBtn, saleType === 'pending' && styles.typeBtnActive]}
                    onPress={() => setSaleType('pending')}
                >
                    <MaterialCommunityIcons name="clock-outline" size={18} color={saleType === 'pending' ? '#000' : '#888'} />
                    <Text style={[styles.typeText, saleType === 'pending' && styles.typeTextActive]}>DEUDA</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.typeBtn, saleType === 'budget' && styles.typeBtnActive]}
                    onPress={() => setSaleType('budget')}
                >
                    <MaterialCommunityIcons name="file-document-outline" size={18} color={saleType === 'budget' ? '#000' : '#888'} />
                    <Text style={[styles.typeText, saleType === 'budget' && styles.typeTextActive]}>PRESUP.</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[styles.addProductBtn, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#d4af37' }]}
                    onPress={async () => {
                        if (permission && !permission.granted) {
                            const result = await requestPermission();
                            if (!result.granted) return;
                        }
                        setScanned(false);
                        setIsScanning(true);
                    }}
                >
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="#d4af37" />
                </TouchableOpacity>

                <TouchableOpacity style={styles.addProductBtn} onPress={handleAddProductPress}>
                    <MaterialCommunityIcons name="magnify" size={24} color="#000" />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.checkoutBtn,
                        cart.length === 0 && styles.disabled,
                        saleType === 'pending' && { backgroundColor: '#e74c3c' },
                        saleType === 'budget' && { backgroundColor: '#3498db' }
                    ]}
                    onPress={handleCheckout}
                    disabled={cart.length === 0 || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="black" />
                    ) : (
                        <Text style={styles.checkoutText}>
                            {saleType === 'completed' ? `COBRAR ($${total.toFixed(0)})` :
                                saleType === 'pending' ? `GUARDAR DEUDA` : `CREAR PRESUPUESTO`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* PRODUCT MODAL */}
            <Modal visible={productModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Seleccionar Producto</Text>
                    <FlatList
                        data={products}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => {
                            // Calculate dynamic availability
                            const inCartItem = cart.find(c => c.id === item.id);
                            const inCartQty = inCartItem ? inCartItem.qty : 0;
                            const available = (item.current_stock || 0) - inCartQty;

                            const isExpanded = expandedProductId === item.id;

                            return (
                                <View style={[styles.productRow, isExpanded && { borderColor: '#d4af37', borderWidth: 2, flexDirection: 'column', alignItems: 'stretch' }]}>
                                    {!isExpanded ? (
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}
                                            onPress={() => initiateProductSelection(item)}
                                        >
                                            <View>
                                                <Text style={styles.rowTitle}>{item.name}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                    <Text style={[styles.rowSubtitle, { color: available < 5 ? '#e74c3c' : '#888' }]}>
                                                        Disp: {available}
                                                    </Text>
                                                </View>
                                            </View>
                                            <Text style={styles.rowPrice}>${item.sale_price}</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <View>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                                                <Text style={[styles.rowTitle, { fontSize: 18 }]}>{item.name}</Text>
                                                <Text style={[styles.rowPrice, { fontSize: 18 }]}>${item.sale_price}</Text>
                                            </View>

                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#111', borderRadius: 8, padding: 10 }}>
                                                <Text style={{ color: '#888' }}>Cantidad:</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                                                    <TouchableOpacity
                                                        onPress={() => adjustTempQty(-1, available)}
                                                        style={styles.qtyBtn}
                                                    >
                                                        <MaterialCommunityIcons name="minus" size={24} color="#fff" />
                                                    </TouchableOpacity>

                                                    <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', minWidth: 40, textAlign: 'center' }}>
                                                        {tempQty}
                                                    </Text>

                                                    <TouchableOpacity
                                                        onPress={() => adjustTempQty(1, available)}
                                                        style={[styles.qtyBtn, tempQty >= available && { opacity: 0.3 }]}
                                                        disabled={tempQty >= available}
                                                    >
                                                        <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>
                                            <Text style={{ color: '#888', textAlign: 'right', marginTop: 5, fontSize: 12 }}>
                                                Disponible: {available}
                                            </Text>

                                            <View style={{ flexDirection: 'row', marginTop: 15, gap: 10 }}>
                                                <TouchableOpacity
                                                    style={[styles.smallBtn, { flex: 1, backgroundColor: '#333' }]}
                                                    onPress={() => setExpandedProductId(null)}
                                                >
                                                    <Text style={{ color: '#fff' }}>Cancelar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.smallBtn, { flex: 2, backgroundColor: '#d4af37' }]}
                                                    onPress={() => confirmAddToCart(item)}
                                                >
                                                    <Text style={{ color: '#000', fontWeight: 'bold' }}>AGREGAR (+{tempQty})</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />
                    <TouchableOpacity style={styles.closeBtn} onPress={() => setProductModalVisible(false)}>
                        <Text style={styles.closeText}>Terminar Selección</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* CLIENT SELECTION MODAL */}
            <Modal visible={clientModalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Seleccionar Cliente</Text>

                    {/* NEW CLIENT FORM OR BUTTON */}
                    {showNewClientForm ? (
                        <View style={styles.newClientForm}>
                            <Text style={styles.sectionTitle}>Nuevo Cliente</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Nombre completo"
                                placeholderTextColor="#666"
                                value={newClientName}
                                onChangeText={setNewClientName}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Teléfono"
                                placeholderTextColor="#666"
                                value={newClientPhone}
                                onChangeText={setNewClientPhone}
                                keyboardType="phone-pad"
                            />
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                                <TouchableOpacity
                                    style={[styles.smallBtn, { backgroundColor: '#333' }]}
                                    onPress={() => setShowNewClientForm(false)}
                                >
                                    <Text style={{ color: '#fff' }}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.smallBtn, { backgroundColor: '#d4af37', flex: 1 }]}
                                    onPress={handleCreateClient}
                                    disabled={creatingClient}
                                >
                                    {creatingClient ? <ActivityIndicator color="#000" /> : <Text style={{ color: '#000', fontWeight: 'bold' }}>Guardar y Usar</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.newClientBtn}
                            onPress={() => setShowNewClientForm(true)}
                        >
                            <MaterialCommunityIcons name="account-plus" size={24} color="#000" />
                            <Text style={styles.newClientText}>CREAR NUEVO CLIENTE</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.divider} />

                    <Text style={[styles.sectionTitle, { marginTop: 20 }]}>O selecciona uno existente:</Text>

                    {/* Anonymous Option */}
                    <TouchableOpacity style={styles.productRow} onPress={() => {
                        setClientModalVisible(false);
                        setTimeout(() => processCheckout(null), 500);
                    }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.avatar, { backgroundColor: '#333' }]}>
                                <MaterialCommunityIcons name="incognito" size={24} color="#888" />
                            </View>
                            <Text style={styles.rowTitle}>Cliente Anónimo / Mostrador</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                    </TouchableOpacity>

                    <FlatList
                        data={clients}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 50 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity style={styles.productRow} onPress={() => {
                                setClientModalVisible(false);
                                setTimeout(() => processCheckout(item), 500);
                            }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <View style={styles.avatar}>
                                        <Text style={{ color: 'black', fontWeight: 'bold' }}>{item.name.charAt(0)}</Text>
                                    </View>
                                    <Text style={styles.rowTitle}>{item.name}</Text>
                                </View>
                                <MaterialCommunityIcons name="chevron-right" size={24} color="#d4af37" />
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>No hay otros clientes.</Text>}
                    />

                    <TouchableOpacity style={styles.closeBtn} onPress={() => setClientModalVisible(false)}>
                        <Text style={styles.closeText}>Cancelar Venta</Text>
                    </TouchableOpacity>
                </View>
            </Modal>

            {/* BARCODE SCANNER MODAL */}
            <Modal visible={isScanning} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'black' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}
                        onPress={() => setIsScanning(false)}
                    >
                        <MaterialCommunityIcons name="close" size={30} color="white" />
                    </TouchableOpacity>
                    <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 10 }}>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: 'bold' }}>Escanea para agregar al carrito</Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },

    header: { padding: 20, paddingBottom: 30, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { color: '#666', fontSize: 14, fontWeight: '900', letterSpacing: 2, textAlign: 'center' },
    totalBadge: { alignItems: 'center', marginTop: 10 },
    totalLabel: { color: '#888', fontSize: 10, letterSpacing: 2, fontWeight: '900', marginBottom: 5 },
    totalAmount: { color: '#d4af37', fontSize: 48, fontWeight: '900' },
    clientLabel: { color: '#fff', marginTop: 5, fontWeight: 'bold', fontSize: 14, letterSpacing: 1 },

    cartItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    itemInfo: { flex: 1 },
    itemName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    itemMeta: { color: '#888', fontSize: 12, marginTop: 4 },
    itemTotal: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginHorizontal: 15 },
    removeBtn: { padding: 5 },

    emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
    emptyText: { fontSize: 18, fontWeight: '900', marginTop: 10, color: '#666' },
    emptySubtext: { fontSize: 14, color: '#444' },

    footer: { padding: 20, paddingBottom: 30, backgroundColor: '#1a1a1a', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row' },
    addProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ccc', borderRadius: 10, padding: 15, marginRight: 10 },
    addProductText: { marginLeft: 5, color: '#000', fontWeight: '900', letterSpacing: 0.5 },
    checkoutBtn: { flex: 2, backgroundColor: '#d4af37', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#d4af37', shadowOpacity: 0.3, elevation: 10 },
    disabled: { backgroundColor: '#333' },
    checkoutText: { color: 'black', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

    // Modals
    modalContent: { flex: 1, backgroundColor: '#121212', padding: 20, paddingTop: 40, paddingBottom: 50 },
    modalTitle: { fontSize: 22, fontWeight: '900', marginBottom: 20, color: '#d4af37', textAlign: 'center', letterSpacing: 1 },
    productRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 20, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    rowTitle: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
    rowSubtitle: { color: '#888', marginTop: 4, fontSize: 12 },
    rowPrice: { fontSize: 18, fontWeight: 'bold', color: '#d4af37' },
    avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    closeBtn: { marginTop: 20, padding: 15, backgroundColor: '#222', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    closeText: { color: '#888', fontWeight: 'bold' },

    // New Client Styles
    newClientBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#d4af37',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20
    },
    newClientText: { color: '#000', fontWeight: '900', marginLeft: 10, fontSize: 14 },
    divider: { height: 1, backgroundColor: '#333', marginVertical: 10 },
    sectionTitle: { color: '#666', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 15 },

    newClientForm: {
        backgroundColor: '#1e1e1e',
        padding: 15,
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333'
    },
    input: {
        backgroundColor: '#111',
        color: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333'
    },
    smallBtn: {
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    // New Action Row & Client Button
    actionRow: { padding: 15, paddingBottom: 0 },
    clientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#1e1e1e',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d4af37',
        alignSelf: 'stretch'
    },
    clientSelected: { backgroundColor: '#d4af37' },
    clientButtonText: { color: '#d4af37', fontWeight: '900', marginLeft: 10, fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
    clientSelectedText: { color: '#000' },

    // Qty Selector
    qtyBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#333',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#555'
    },
    // Search & Selection Styles
    searchContainer: {
        padding: 15,
        paddingBottom: 5,
        zIndex: 10
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        marginLeft: 10,
        fontSize: 16
    },
    searchResults: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        marginTop: 5,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden'
    },
    createOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: '#d4af37' // Highlight for create
    },
    createIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,255,255,0.3)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    createText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#333'
    },
    resultText: {
        color: '#fff',
        marginLeft: 10,
        fontSize: 16
    },

    // Selected Client Row
    selectedClientRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 10,
        paddingHorizontal: 15,
        borderWidth: 1,
        borderColor: '#d4af37'
    },
    selectedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#d4af37',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15
    },
    selectedLabel: {
        color: '#d4af37',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1
    },
    selectedName: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16
    },
    removeClientBtn: {
        padding: 5,
        backgroundColor: '#333',
        borderRadius: 20
    },

    // Transaction Type Selector Styles
    typeSelector: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingBottom: 15,
        gap: 10,
        backgroundColor: '#1a1a1a'
    },
    typeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#222',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        gap: 6
    },
    typeBtnActive: {
        backgroundColor: '#d4af37',
        borderColor: '#d4af37'
    },
    typeText: {
        color: '#888',
        fontSize: 10,
        fontWeight: '900'
    },
    typeTextActive: {
        color: '#000'
    }
});
