import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar, TextInput, ScrollView } from 'react-native'; // Added ScrollView
import { useFocusEffect } from '@react-navigation/native';
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

// New Components
import CartItem from '../components/CartItem';
import ClientSelector from '../components/ClientSelector';
import PromotionSelector from '../components/PromotionSelector';
import CostBreakdown from '../components/CostBreakdown';
import SaleTypeSelector from '../components/SaleTypeSelector';
import ProductModal from '../components/ProductModal';
import ClientModal from '../components/ClientModal';

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
    const [promos, setPromos] = useState([]);
    const [selectedPromo, setSelectedPromo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [commissionRate, setCommissionRate] = useState(0.10);
    const [isLeaderSale, setIsLeaderSale] = useState(false);
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

        // Use requestAnimationFrame for param handling to avoid blocking transition
        requestAnimationFrame(() => {
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

            if (route.params?.mode === 'quote') {
                setSaleType('budget');
                navigation.setParams({ mode: null });
            }
        });
    }, [route.params?.preselectedProduct, route.params?.mode]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [productsRes, clientsRes, promosRes, commRes, transRes] = await Promise.all([
                supabase.from('products').select('*').eq('active', true).order('name'),
                supabase.from('clients').select('*').order('created_at', { ascending: false }),
                supabase.from('promotions').select('*, promotion_products(product_id)').eq('active', true).order('created_at', { ascending: false }),
                supabase.from('settings').select('value').eq('key', 'commission_rate').single(),
                supabase.from('settings').select('value').eq('key', 'transport_cost').single()
            ]);

            if (productsRes.data) setProducts(productsRes.data);
            if (clientsRes.data) setClients(clientsRes.data || []);
            if (promosRes.data) setPromos(promosRes.data || []);
            if (commRes.data) setCommissionRate(parseFloat(commRes.data.value));
            if (transRes.data) setTransportCost(parseFloat(transRes.data.value) || 0);

        } catch (error) {
            console.log('Error fetching initial data:', error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchInitialData();
            requestPermission();
        }, [])
    );

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
        let discount = 0;
        let promoDetail = '';

        cart.forEach(item => {
            const itemTotal = item.sale_price * item.qty;
            const itemCost = item.cost_price * item.qty;
            subtotal += itemTotal;
            totalProfit += (itemTotal - itemCost);
        });

        // Apply Promotion Logic
        if (selectedPromo) {
            if (selectedPromo.type === 'global_percent') {
                discount = subtotal * (selectedPromo.value / 100);
                promoDetail = `Desc. ${selectedPromo.value}% Global`;
            } else if (selectedPromo.type === 'fixed_discount') {
                discount = selectedPromo.value;
                promoDetail = `Desc. Fijo -$${selectedPromo.value}`;
            } else if (selectedPromo.type === 'buy_x_get_y') {
                // Get IDs of products linked to this promo
                const promoProductIds = (selectedPromo.promotion_products || []).map(pp => pp.product_id);

                let affected = [];
                cart.forEach(item => {
                    if (promoProductIds.includes(item.id) && item.qty >= 2) {
                        const freeUnits = Math.floor(item.qty / 2);
                        discount += (freeUnits * item.sale_price);
                        affected.push(`${item.name} (x${freeUnits})`);
                    }
                });

                if (affected.length > 0) {
                    promoDetail = `2x1 para: ${affected.join(', ')}`;
                } else {
                    promoDetail = 'Sin productos en 2x1';
                }
            }
        }

        const total = subtotal - discount + (includeTransport ? transportCost : 0);
        const finalProfit = totalProfit - discount; // Discount reduces profit

        // Multi-tier commission: 10% standard, 5% if it's a Leader sale closed by César
        const currentRate = isLeaderSale ? 0.05 : commissionRate;
        const commission = finalProfit * currentRate; // Calculate for all, filter by device in Home

        return { subtotal, total, totalProfit: finalProfit, commission, discount, promoDetail };
    };

    const { subtotal, total, totalProfit, commission, discount, promoDetail } = React.useMemo(() => calculateTotals(), [cart, selectedPromo, includeTransport, isLeaderSale, commissionRate]);

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

    // Filter clients for search (Memoized for performance)
    const filteredClients = React.useMemo(() => {
        if (!searchQuery) return [];
        const lowQuery = searchQuery.toLowerCase();
        return clients.filter(c => c.name.toLowerCase().includes(lowQuery));
    }, [searchQuery, clients]);

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
                            ${cart.map(item => {
                let rows = `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px;">${item.name}</td>
                                    <td style="text-align: center; padding: 10px;">${item.qty}</td>
                                    <td style="text-align: right; padding: 10px;">$${item.sale_price}</td>
                                    <td style="text-align: right; padding: 10px;">$${(item.sale_price * item.qty).toFixed(2)}</td>
                                </tr>
                                `;

                // If 2x1 applies to this item
                if (selectedPromo?.type === 'buy_x_get_y') {
                    const promoProdIds = (selectedPromo.promotion_products || []).map(pp => pp.product_id);
                    if (promoProdIds.includes(item.id) && item.qty >= 2) {
                        const free = Math.floor(item.qty / 2);
                        rows += `
                                        <tr style="border-bottom: 1px solid #eee;">
                                            <td style="padding: 10px;"><strong>Promo: ${selectedPromo.title} (${item.name})</strong></td>
                                            <td style="text-align: center; padding: 10px;"><strong>-${free}</strong></td>
                                            <td style="text-align: right; padding: 10px;"><strong>-$${item.sale_price}</strong></td>
                                            <td style="text-align: right; padding: 10px;"><strong>-$${(free * item.sale_price).toFixed(2)}</strong></td>
                                        </tr>
                                        `;
                    }
                }
                return rows;
            }).join('')}
                            ${(selectedPromo?.type === 'global_percent' || selectedPromo?.type === 'fixed_discount') && discount > 0 ? `
                                <tr style="border-bottom: 2px solid #d4af37;">
                                    <td style="padding: 10px;"><strong>Promo: ${selectedPromo.title}</strong></td>
                                    <td style="text-align: center; padding: 10px;"><strong>1</strong></td>
                                    <td style="text-align: right; padding: 10px;"><strong>-$${discount.toFixed(2)}</strong></td>
                                    <td style="text-align: right; padding: 10px;"><strong>-$${discount.toFixed(2)}</strong></td>
                                </tr>
                            ` : ''}
                            ${includeTransport ? `
                                <tr style="border-bottom: 1px solid #eee; background-color: #f8f8f8;">
                                    <td style="padding: 10px; color: #666;">Envío / Transporte</td>
                                    <td style="text-align: center; padding: 10px; color: #666;">1</td>
                                    <td style="text-align: right; padding: 10px; color: #666;">$${transportCost.toFixed(2)}</td>
                                    <td style="text-align: right; padding: 10px; color: #666;">$${transportCost.toFixed(2)}</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>

                    <div style="text-align: right; border-top: 2px solid #d4af37; padding-top: 20px;">
                        <p style="margin: 0; color: #888;">Subtotal: $${subtotal.toFixed(2)}</p>
                        <h2 style="margin: 5px 0 0 0; color: #000;">TOTAL A PAGAR: $${total.toFixed(2)}</h2>
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
                device_sig: deviceSig,
                is_leader_sale: isLeaderSale,
                promotion_id: selectedPromo ? selectedPromo.id : null
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
                            setSelectedPromo(null);
                            setClientModalVisible(false);
                            navigation.navigate('Home');
                        }
                    }]
                );
                return;
            }

            // 1. Create Sale Record
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

            if (saleError) {
                console.error('Sale Insert Error:', saleError);
                throw new Error('No se pudo crear el registro de venta.');
            }

            // 2. Insert Items
            const saleItems = cart.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: item.qty,
                unit_price_at_sale: item.sale_price,
                subtotal: item.sale_price * item.qty
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(saleItems);
            if (itemsError) {
                console.error('Items Insert Error:', itemsError);
                // Critical error: Sale exists but no items. We should probably inform the user.
                Alert.alert('Error Parcial', 'La venta se registró pero hubo un problema guardando los productos. Por favor revisa el historial.');
                throw new Error('Error al guardar los productos de la venta.');
            }

            // 3. Update Stock (Skip if it's just a budget/quote)
            if (saleType !== 'budget') {
                try {
                    const lowStockProducts = [];
                    for (const item of cart) {
                        // --- BUNDLE STOCK DEDUCTION LOGIC ---
                        if (item.description?.startsWith('[[BUNDLE:')) {
                            try {
                                const parts = item.description.split(']]');
                                const jsonStr = parts[0].replace('[[BUNDLE:', '');
                                const bundleData = JSON.parse(jsonStr);

                                // Deduct each item in the bundle
                                for (const bundleItem of bundleData.items) {
                                    const { data: childProd } = await supabase
                                        .from('products')
                                        .select('current_stock, name')
                                        .eq('id', bundleItem.id)
                                        .single();

                                    if (childProd) {
                                        const childrenToDeduct = bundleItem.qty * item.qty;
                                        const newChildStock = (childProd.current_stock || 0) - childrenToDeduct;
                                        await supabase.from('products').update({ current_stock: newChildStock }).eq('id', bundleItem.id);

                                        if (newChildStock <= 5) {
                                            if (!lowStockProducts.find(p => p.name === childProd.name)) {
                                                lowStockProducts.push({ name: childProd.name, stock: newChildStock });
                                            }
                                        }
                                    }
                                }
                            } catch (e) {
                                console.log('Bundle deduction error:', e);
                            }
                        }
                        // -------------------------------------

                        const newStock = (item.current_stock || 0) - item.qty;
                        await supabase.from('products').update({ current_stock: newStock }).eq('id', item.id);

                        if (newStock <= 5) {
                            lowStockProducts.push({ name: item.name, stock: newStock });
                            // Non-critical: Try to send notification but don't fail if it fails
                            NotificationService.sendLowStockAlert(item.name, newStock).catch(e => console.log('Notification Error:', e));
                        }
                    }

                    // If there are critical products, schedule the 5-hour reminder
                    if (lowStockProducts.length > 0) {
                        NotificationService.scheduleStockReminder(lowStockProducts).catch(e => console.log('Reminder Error:', e));
                    }
                } catch (stockError) {
                    console.error('Stock Update Error:', stockError);
                    // Non-critical for the sale itself, but important for inventory
                    Alert.alert('Aviso', 'Venta registrada, pero hubo un error actualizando el stock de algunos productos.');
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
                            setSelectedPromo(null);
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
                            setSelectedPromo(null);
                            setClientModalVisible(false);
                            navigation.navigate('Sales');
                        }
                    }
                ]
            );

        } catch (error) {
            console.log('Checkout Error:', error);
            Alert.alert('Error', error.message || 'No se pudo procesar la venta.');
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
            <ClientSelector
                selectedClient={selectedClient}
                clientError={clientError}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                setClientError={setClientError}
                filteredClients={filteredClients}
                onSelectClient={(client) => {
                    setSelectedClient(client);
                    setSearchQuery('');
                    setClientError(false);
                }}
                onCreateClient={createClientInline}
                onRemoveClient={() => setSelectedClient(null)}
                creatingClient={creatingClient}
            />

            <FlatList
                data={cart}
                keyExtractor={item => item.id}
                style={{ flex: 1 }}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                renderItem={({ item }) => (
                    <CartItem item={item} onRemove={removeFromCart} />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="cart-off" size={60} color="#333" />
                        <Text style={styles.emptyText}>Bolsa Vacía</Text>
                        <Text style={styles.emptySubtext}>Añade productos del inventario</Text>
                    </View>
                }
            />

            {/* Promotion Selector */}
            <PromotionSelector
                promos={promos}
                selectedPromo={selectedPromo}
                onSelectPromo={setSelectedPromo}
            />

            {/* Cost Breakdown */}
            {cart.length > 0 && (
                <CostBreakdown
                    subtotal={subtotal}
                    total={total}
                    discount={discount}
                    selectedPromo={selectedPromo}
                    promoDetail={promoDetail}
                    includeTransport={includeTransport}
                    setIncludeTransport={setIncludeTransport}
                    transportCost={transportCost}
                />
            )}

            {/* Transaction Type Selector */}
            <SaleTypeSelector saleType={saleType} setSaleType={setSaleType} />

            {/* COMMISSION SPLIT TOGGLE - Outside footer for better layout */}
            <View style={styles.commissionSplitCard}>
                <TouchableOpacity
                    style={[styles.splitToggle, isLeaderSale && styles.splitToggleActive]}
                    onPress={() => setIsLeaderSale(!isLeaderSale)}
                >
                    <MaterialCommunityIcons
                        name={isLeaderSale ? "shield-check" : "shield-outline"}
                        size={20}
                        color={isLeaderSale ? "#00ff88" : "#666"}
                    />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                        <Text style={[styles.splitTitle, isLeaderSale && { color: '#00ff88' }]}>
                            Venta cerrada por el Líder (César)
                        </Text>
                        <Text style={styles.splitDesc}>
                            {isLeaderSale ? 'Comisión reducida al 5%' : 'Comisión completa del 10%'}
                        </Text>
                    </View>
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
                                saleType === 'pending' ? `GUARDAR DEUDA` : `CREAR PRESUPUESO`}
                        </Text>
                    )}
                </TouchableOpacity>
            </View>

            {/* PRODUCT MODAL */}
            <ProductModal
                visible={productModalVisible}
                onClose={() => setProductModalVisible(false)}
                products={products}
                cart={cart}
                expandedProductId={expandedProductId}
                setExpandedProductId={setExpandedProductId}
                tempQty={tempQty}
                adjustTempQty={adjustTempQty}
                initiateProductSelection={initiateProductSelection}
                confirmAddToCart={confirmAddToCart}
            />

            {/* CLIENT SELECTION MODAL */}
            <ClientModal
                visible={clientModalVisible}
                onClose={() => setClientModalVisible(false)}
                clients={clients}
                onSelectClient={(client) => {
                    setClientModalVisible(false);
                    setTimeout(() => processCheckout(client), 500);
                }}
                showNewClientForm={showNewClientForm}
                setShowNewClientForm={setShowNewClientForm}
                newClientName={newClientName}
                setNewClientName={setNewClientName}
                newClientPhone={newClientPhone}
                setNewClientPhone={setNewClientPhone}
                handleCreateClient={handleCreateClient}
                creatingClient={creatingClient}
                processCheckout={processCheckout}
            />

            {/* BARCODE SCANNER MODAL */}
            <Modal visible={isScanning} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'black' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
                        }}
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

    emptyContainer: { alignItems: 'center', marginTop: 60, opacity: 0.7 },
    emptyText: { fontSize: 18, fontWeight: '900', marginTop: 10, color: '#666' },
    emptySubtext: { fontSize: 14, color: '#444' },

    footer: { padding: 20, paddingBottom: 30, backgroundColor: '#1a1a1a', borderTopWidth: 1, borderTopColor: '#333', flexDirection: 'row' },
    addProductBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#ccc', borderRadius: 10, padding: 15, marginRight: 10 },
    addProductText: { marginLeft: 5, color: '#000', fontWeight: '900', letterSpacing: 0.5 },
    checkoutBtn: { flex: 2, backgroundColor: '#d4af37', borderRadius: 10, justifyContent: 'center', alignItems: 'center', shadowColor: '#d4af37', shadowOpacity: 0.3, elevation: 10 },
    disabled: { backgroundColor: '#333' },
    checkoutText: { color: 'black', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

    commissionSplitCard: { marginHorizontal: 25, marginBottom: 10 },
    splitToggle: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1a1a1a' },
    splitToggleActive: { borderColor: '#00ff8840', backgroundColor: '#00ff8805' },
    splitTitle: { color: '#888', fontSize: 13, fontWeight: '700' },
    splitDesc: { color: '#444', fontSize: 11, fontWeight: '600', marginTop: 2 },
});
