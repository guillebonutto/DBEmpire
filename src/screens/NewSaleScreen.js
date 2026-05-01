import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, Modal, ActivityIndicator, StatusBar, TextInput, ScrollView, Platform } from 'react-native'; // Added ScrollView
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

import { GlobalDataService } from '../services/GlobalDataService';

import { useProductStore } from '../store/useProductStore';
import { useClientStore } from '../store/useClientStore';
import { useAuthStore } from '../store/useAuthStore';

// New Components
import CartItem from '../components/CartItem';
import ClientSelector from '../components/ClientSelector';
import PromotionSelector from '../components/PromotionSelector';
import CostBreakdown from '../components/CostBreakdown';
import SaleTypeSelector from '../components/SaleTypeSelector';
import ProductModal from '../components/ProductModal';
import ClientModal from '../components/ClientModal';

import { useFinanceStore } from '../store/useFinanceStore';

export default function NewSaleScreen({ navigation, route }) {
    const { products, updateProductStock, fetchProducts, setProducts } = useProductStore();
    const { clients, addClientLocally, fetchClients } = useClientStore();
    const { userRole: currentUserRole } = useAuthStore();
    const { sales, saleItems, addSaleLocal, setFinanceState } = useFinanceStore();
    
    // We still need promos and commission manually or via a settings store, for now we keep them local using GlobalDataService initially.
    const { 
        cartItems: cart, 
        addToCart, 
        removeFromCart, 
        updateCartQty, 
        splitCartItem, 
        manualOverrides, 
        setManualOverride,
        resetCart: clearCart 
    } = useFinanceStore();

    // Helper to get regional price
    const getRegionalPrice = (product, location) => {
        if (!product) return 0;
        if (location === 'cordoba') {
            return parseFloat(product.sale_price_cordoba) || parseFloat(product.sale_price) || 0;
        }
        return parseFloat(product.sale_price) || 0;
    };
    const [promos, setPromos] = useState([]);
    const [commissionRate, setCommissionRate] = useState(0.10);

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
    const [selectedPromo, setSelectedPromo] = useState(null);
    const [manualDiscount, setManualDiscount] = useState('');
    const [manualDiscountType, setManualDiscountType] = useState('fixed'); // 'fixed' or 'percent'
    const [loading, setLoading] = useState(false);
    const [isLeaderSale, setIsLeaderSale] = useState(false);

    // Inline Quantity State
    const [expandedProductId, setExpandedProductId] = useState(null);
    const [tempQty, setTempQty] = useState(1);
    const [selectedColor, setSelectedColor] = useState(null);
    const [saleLocation, setSaleLocation] = useState('local'); // 'local' (BA) or 'cordoba'

    // Scanner
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        requestAnimationFrame(() => {
            if (route.params?.preselectedProduct) {
                const product = route.params.preselectedProduct;
                addToCart(product, 1, selectedClient?.id);
                navigation.setParams({ preselectedProduct: null });
            }

            if (route.params?.mode === 'quote') {
                setSaleType('budget');
                navigation.setParams({ mode: null });
            }

            if (route.params?.selectClientFirst) {
                // Open client modal first, then product selection afterwards
                setSelectClientFirstMode(true);
                setClientModalVisible(true);
                navigation.setParams({ selectClientFirst: null });
            } else if (route.params?.autoSearch) {
                // Legacy: Open product modal directly
                setProductModalVisible(true);
                navigation.setParams({ autoSearch: null });
            }
        });
    }, [route.params?.preselectedProduct, route.params?.mode, route.params?.autoSearch, route.params?.selectClientFirst]);

    const fetchInitialData = async () => {
        const hasData = products.length > 0;
        if (!hasData) setLoading(true);

        try {
            // Trigger parallel fetch without blocking UI if data exists
            await Promise.all([
                fetchProducts(),
                fetchClients()
            ]);

            setPromos(GlobalDataService.getPromotions());
            setCommissionRate(parseFloat(GlobalDataService.getSetting('commission_rate')) || 0.10);
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

    // Auto-deselect promo if it no longer applies
    useEffect(() => {
        if (selectedPromo) {
            const isStillAvailable = availablePromos.some(p => p.id === selectedPromo.id);
            if (!isStillAvailable) {
                setSelectedPromo(null);
            }
        }
    }, [availablePromos, selectedPromo]);

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
        const locationStock = saleLocation === 'local' ? (item.stock_local || 0) : (item.stock_cordoba || 0);
        return locationStock - inCartQty;
    };

    const initiateProductSelection = (item) => {
        const available = getAvailableStock(item);

        if (available <= 0) {
            if (Platform.OS === 'web') alert('Sin Stock: No queda stock disponible para este producto (revisa tu carrito).');
            else Alert.alert('Sin Stock', 'No queda stock disponible para este producto (revisa tu carrito).');
            return;
        }

        setExpandedProductId(item.id);
        setTempQty(1);
        setSelectedColor(null);
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
            // Check if it has variants
            if (product.variants && product.variants.length > 0) {
                // Open selection modal instead of adding directly
                setProductModalVisible(true);
                initiateProductSelection(product);
                return;
            }

            // Check stock
            const available = getAvailableStock(product);
            if (available > 0) {
                // Add to cart directly (1 unit, no color)
                addToCart(product, 1, selectedClient?.id);
                if (Platform.OS === 'web') alert(`✅ Agregado: ${product.name} (+1)`);
                else Alert.alert('✅ Agregado', `${product.name} (+1)`);
            } else {
                if (Platform.OS === 'web') alert(`Sin Stock: No hay stock disponible de ${product.name}`);
                else Alert.alert('Sin Stock', `No hay stock disponible de ${product.name}`);
            }
        } else {
            if (Platform.OS === 'web') alert(`No encontrado: No existe producto con código: ${barcodeData}`);
            else Alert.alert('No encontrado', `No existe producto con código: ${barcodeData}`);
        }
    };

    const confirmAddToCart = (product) => {
        // If product has variants but no color selected, alert user
        if (product.variants && product.variants.length > 0 && !selectedColor) {
            if (Platform.OS === 'web') alert('Color Requerido: Por favor selecciona un color para este producto.');
            else Alert.alert('Color Requerido', 'Por favor selecciona un color para este producto.');
            return;
        }

        addToCart(product, tempQty, selectedClient?.id, selectedColor);
        
        setExpandedProductId(null);
        setTempQty(1);
        setSelectedColor(null);
        // Do NOT close modal, allow multiple adds
    };

    const calculateTotals = () => {
        let subtotal = 0;
        let totalProfit = 0;
        let discount = 0;
        let promoDetail = '';

        cart.forEach(item => {
            // Skip invalid items or bundles without proper pricing
            if (!item || item.qty === undefined || item.qty === null) {
                console.log('Invalid item in cart:', item);
                return;
            }

            const regionalPrice = getRegionalPrice(item, saleLocation);
            // Validate price is a number
            if (typeof regionalPrice !== 'number' || isNaN(regionalPrice)) {
                console.log('Invalid price for item:', item.name, 'price:', regionalPrice);
                return; // Skip this item if price is invalid
            }

            const itemTotal = regionalPrice * item.qty;
            const itemCost = (item.cost_price || 0) * item.qty;
            subtotal += itemTotal;
            totalProfit += (itemTotal - itemCost);
        });

        // Apply Promotion Logic
        if (selectedPromo && selectedPromo.value !== undefined && selectedPromo.value !== null) {
            const promoProductIds = (selectedPromo.promotion_products || []).map(pp => pp.product_id);
            const hasProductLinks = promoProductIds.length > 0;
            const minRequired = selectedPromo.min_qty || 1;

            if (selectedPromo.type === 'global_percent') {
                if (hasProductLinks) {
                    let selectionMet = false;
                    cart.forEach(item => {
                        if (promoProductIds.includes(item.id)) {
                            if (item.qty >= minRequired) {
                                const price = getRegionalPrice(item, saleLocation);
                                discount += (price * item.qty) * (selectedPromo.value / 100);
                                selectionMet = true;
                            }
                        }
                    });
                    promoDetail = selectionMet ? `Desc. ${Math.round(selectedPromo.value)}% (Min: ${minRequired})` : `Faltan unidades (Min: ${minRequired})`;
                } else {
                    discount = subtotal * (selectedPromo.value / 100);
                    promoDetail = `Desc. ${Math.round(selectedPromo.value)}% Global`;
                }
            } else if (selectedPromo.type === 'fixed_discount') {
                if (hasProductLinks) {
                    let totalFixedDiscount = 0;
                    let hasQualifying = false;
                    cart.forEach(item => {
                        if (promoProductIds.includes(item.id) && item.qty >= minRequired) {
                            totalFixedDiscount += (selectedPromo.value * item.qty);
                            hasQualifying = true;
                        }
                    });
                    if (hasQualifying) {
                        discount = totalFixedDiscount;
                        promoDetail = `Desc. Pack -$${selectedPromo.value} c/u (Min: ${minRequired})`;
                    } else {
                        discount = 0;
                        promoDetail = `Faltan unidades (Min: ${minRequired})`;
                    }
                } else {
                    discount = selectedPromo.value;
                    promoDetail = `Desc. Fijo -$${selectedPromo.value}`;
                }
            } else if (selectedPromo.type === 'buy_x_get_y') {
                let affected = [];
                cart.forEach(item => {
                    if (promoProductIds.includes(item.id) && item.qty >= 2) {
                        const freeUnits = Math.floor(item.qty / 2);
                        discount += (freeUnits * getRegionalPrice(item, saleLocation));
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

        // Apply Manual Discount
        let manualDiscountAmt = 0;
        const mVal = parseFloat(manualDiscount) || 0;
        if (mVal > 0) {
            if (manualDiscountType === 'percent') {
                manualDiscountAmt = subtotal * (mVal / 100);
            } else {
                manualDiscountAmt = mVal;
            }
        }

        const totalDiscount = discount + manualDiscountAmt;
        const total = subtotal - totalDiscount;
        const finalProfit = totalProfit - totalDiscount;
        
        // --- LÓGICA DE COMISIÓN DE SOCIO CÓRDOBA ---
        const isSeller = currentUserRole === 'seller';
        let currentRate = 0;
        
        if (isSeller) {
            if (saleLocation === 'cordoba') {
                // Socio Córdoba: 40% Venta Directa o 10% por Cierre
                currentRate = (commissionType === 'direct') ? 0.40 : 0.10;
            } else {
                // Vendedor Estándar (BA): 5% si el líder cerró o 10% normal
                currentRate = isLeaderSale ? 0.05 : commissionRate;
            }
        }

        const commission = finalProfit * currentRate;

        // Ensure all values are valid numbers, never undefined or NaN
        const safeCommission = typeof commission === 'number' && !isNaN(commission) ? commission : 0;
        const safeSubtotal = typeof subtotal === 'number' && !isNaN(subtotal) ? subtotal : 0;
        const safeTotal = typeof total === 'number' && !isNaN(total) ? total : 0;
        const safeTotalProfit = typeof finalProfit === 'number' && !isNaN(finalProfit) ? finalProfit : 0;
        const safeDiscount = typeof discount === 'number' && !isNaN(discount) ? discount : 0;
        const safeManualDiscount = typeof manualDiscountAmt === 'number' && !isNaN(manualDiscountAmt) ? manualDiscountAmt : 0;

        return {
            subtotal: safeSubtotal,
            total: safeTotal,
            totalProfit: safeTotalProfit,
            commission: safeCommission,
            discount: safeDiscount,
            promoDetail: promoDetail || '',
            manualDiscountAmt: safeManualDiscount
        };
    };

    const { subtotal, total, totalProfit, commission, discount, promoDetail, manualDiscountAmt } = React.useMemo(() => calculateTotals(), [cart, selectedPromo, isLeaderSale, commissionRate, manualDiscount, manualDiscountType, commissionType, saleLocation, currentUserRole]);

    const [saleType, setSaleType] = useState('completed'); // completed, pending (debt), budget (quote)
    const [pendingCheckoutType, setPendingCheckoutType] = useState('completed'); // Track the checkout type being processed
    const [commissionType, setCommissionType] = useState('direct'); // 'direct' or 'closer'
    const [selectClientFirstMode, setSelectClientFirstMode] = useState(false); // Track if we're selecting client before product
    
    // Ref to avoid setState async timing issues with modals
    const checkoutTypeRef = useRef('completed');

    // Triggered when clicking "COBRAR"
    const handleCheckout = (checkoutType = 'completed') => {
        if (cart.length === 0) return;

        // Update ref IMMEDIATELY (synchronous) - don't wait for setState
        checkoutTypeRef.current = checkoutType;
        
        // Also update state for UI purposes
        setPendingCheckoutType(checkoutType);
        // Set sale type based on checkout type
        setSaleType(checkoutType);

        // Final sanity check for client
        if (!selectedClient && checkoutType !== 'completed') {
            if (Platform.OS === 'web') alert('Falta Cliente: Las deudas y presupuestos requieren seleccionar un cliente.');
            else Alert.alert('Falta Cliente', 'Las deudas y presupuestos requieren seleccionar un cliente.');
            setClientModalVisible(true);
            return;
        }

        if (!selectedClient) {
            setClientModalVisible(true);
            return;
        }
        processCheckout(selectedClient, checkoutType);
    };

    const handleCreateClient = async () => {
        if (!newClientName.trim()) {
            if (Platform.OS === 'web') alert('Error: El nombre del cliente es obligatorio');
            else Alert.alert('Error', 'El nombre del cliente es obligatorio');
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

            // Update local list (Optimistic UI)
            addClientLocally(data);

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

            addClientLocally(data);
            setSelectedClient(data);
            setSearchQuery('');

        } catch (error) {
            console.log('Error creating client inline:', error);
            if (Platform.OS === 'web') alert('Error: No se pudo crear el cliente rápido.');
            else Alert.alert('Error', 'No se pudo crear el cliente rápido.');
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

    const availablePromos = React.useMemo(() => {
        return promos.filter(p => {
            // Global promos (no links) are always available
            if (!p.promotion_products || p.promotion_products.length === 0) return true;

            // Linked promos only if cart contains relevant items with at least min_qty?
            // Let's show it as available if they have at least 1, so they can see they need more to activate.
            const linkedIds = p.promotion_products.map(pp => pp.product_id);
            return cart.some(item => linkedIds.includes(item.id));
        });
    }, [promos, cart]);

    const generateReceiptPDF = async (saleData, client, cart, docType = 'sale') => {
        try {
            const date = new Date().toLocaleString();
            const isBudget = docType === 'budget' || saleData?.status === 'budget';
            const accentColor = '#d4af37';

            const htmlContent = `
            <html>
                <body style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: ${accentColor}; margin: 0; font-size: 28px; letter-spacing: 2px;">DIGITAL BOOST EMPIRE</h1>
                        <p style="margin: 5px 0; color: #888; font-size: 14px;">${isBudget ? 'PRESUPUESTO' : 'Recibo de Venta Oficial'}</p>
                        ${isBudget ? `<div style="margin-top: 10px; background-color: #fff8e1; border: 1px solid #d4af37; border-radius: 6px; padding: 8px; font-size: 12px; color: #7d5a00;">⚠️ Este presupuesto tiene validez de 7 días desde la fecha de emisión.</div>` : ''}
                        <div style="width: 100%; height: 1px; background-color: ${accentColor}; margin-top: 15px;"></div>
                    </div>
                    
                    <div style="margin-bottom: 30px; font-size: 14px; line-height: 1.6;">
                        <p style="margin: 2px 0;"><strong>Fecha:</strong> ${date}</p>
                        <p style="margin: 2px 0;"><strong>${isBudget ? 'Presupuesto' : 'Operación'}:</strong> #${isBudget ? 'PRS' : 'SC'}-${saleData.id.slice(0, 8).toUpperCase()}</p>
                        <p style="margin: 2px 0;"><strong>Cliente:</strong> ${client ? client.name : 'Venta de Mostrador'}</p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="border-bottom: 1px solid #333;">
                                <th style="text-align: left; padding: 10px; font-size: 14px; color: #000;">Producto</th>
                                <th style="text-align: center; padding: 10px; font-size: 14px; color: #000;">Cant</th>
                                <th style="text-align: right; padding: 10px; font-size: 14px; color: #000;">Precio</th>
                                <th style="text-align: right; padding: 10px; font-size: 14px; color: #000;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cart.map(item => {
                const itemPrice = getRegionalPrice(item, saleLocation);
                return `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; font-size: 13px;">${item.name} ${item.color ? `(${item.color})` : ''}</td>
                                    <td style="text-align: center; padding: 10px; font-size: 13px;">${item.qty}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">$${itemPrice.toFixed(0)}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">$${(itemPrice * item.qty).toFixed(2)}</td>
                                </tr>
                                `;
            }).join('')}

                            ${(selectedPromo?.type === 'global_percent' || selectedPromo?.type === 'fixed_discount') && discount > 0 ? `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; font-size: 13px;">${selectedPromo.title} ${selectedPromo.type === 'global_percent' ? `(${selectedPromo.value}%)` : ''}</td>
                                    <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-$${discount.toFixed(2)}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-$${discount.toFixed(2)}</td>
                                </tr>
                            ` : ''}

                            ${manualDiscountAmt > 0 ? `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; font-size: 13px;">Descuento Especial ${manualDiscountType === 'percent' ? `(${Math.round(parseFloat(manualDiscount)) || 0}%)` : ''}</td>
                                    <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-$${manualDiscountAmt.toFixed(2)}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-$${manualDiscountAmt.toFixed(2)}</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>

                    <div style="text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid ${accentColor};">
                        <p style="margin: 0; color: #888; font-size: 14px;">Subtotal: $${subtotal.toFixed(2)}</p>
                        <h2 style="margin: 10px 0 0 0; color: #000; font-size: 22px;">${isBudget ? 'TOTAL COTIZADO' : 'TOTAL A PAGAR'}: $${total.toFixed(2)}</h2>
                    </div>

                    <div style="margin-top: 60px; text-align: center; color: #bbb; font-size: 11px;">
                        <p>¡Gracias por elegir al Imperio!</p>
                        <p>Digital Boost Empire - Resultados Reales</p>
                    </div>
                </body>
            </html>
            `;

            const dialogTitle = isBudget ? 'Enviar Presupuesto' : 'Enviar Recibo';
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle });
        } catch (error) {
            console.log('Error generating PDF:', error);
            if (Platform.OS === 'web') alert('Error: No se pudo generar el recibo digital.');
            else Alert.alert('Error', 'No se pudo generar el recibo digital.');
        }
    };


    const processCheckout = async (client, checkoutSaleType = saleType) => {
        if (loading) return; // ANTI-DOUBLE SALE LOCK
        setLoading(true);

        // Ensure products is an array
        const previousProducts = Array.isArray(products) ? [...products] : [];

        try {
            console.log('processCheckout started with:', { client, checkoutSaleType, cartLength: cart.length });

            // Validate that we have calculated values
            if (total === undefined || total === null || typeof total !== 'number') {
                console.error('Invalid total amount:', total);
                if (Platform.OS === 'web') alert('Error: No se pudo calcular el total. Por favor revisa que los productos tengan precios válidos.');
                else Alert.alert('Error de Cálculo', 'No se pudo calcular el total. Por favor revisa que los productos tengan precios válidos.');
                setLoading(false);
                return;
            }

            if (totalProfit === undefined || totalProfit === null || typeof totalProfit !== 'number') {
                console.error('Invalid profit:', totalProfit);
                if (Platform.OS === 'web') alert('Error: No se pudo calcular la ganancia.');
                else Alert.alert('Error', 'No se pudo calcular la ganancia.');
                setLoading(false);
                return;
            }

            if (commission === undefined || commission === null || typeof commission !== 'number') {
                console.error('Invalid commission:', commission);
                if (Platform.OS === 'web') alert('Error: No se pudo calcular la comisión.');
                else Alert.alert('Error', 'No se pudo calcular la comisión.');
                setLoading(false);
                return;
            }

            console.log('Validations passed, fetching network state...');
            const netState = await NetInfo.fetch();
            console.log('Network state:', netState);

            // Logic for Seller ID and Device Signature
            console.log('Fetching profiles...');
            const { data: profiles } = await supabase.from('profiles').select('id').eq('role', currentUserRole).limit(1);
            let sellerId = profiles && profiles.length > 0 ? profiles[0].id : null;
            console.log('Seller ID:', sellerId);

            console.log('Getting device signature...');
            const deviceSig = await require('../services/deviceAuth').DeviceAuthService.getDeviceSignature();
            console.log('Device signature obtained');

            let salePayload = {
                seller_id: sellerId || null,
                client_id: client ? client.id : null,
                total_amount: typeof total === 'number' ? total : 0,
                profit_generated: typeof totalProfit === 'number' ? totalProfit : 0,
                commission_amount: typeof commission === 'number' ? commission : 0,
                status: checkoutSaleType || 'completed',
                device_sig: deviceSig || null,
                is_leader_sale: isLeaderSale || false,
                promotion_id: selectedPromo ? selectedPromo.id : null,
                manual_discount_amount: typeof manualDiscountAmt === 'number' ? manualDiscountAmt : 0,
                manual_discount_type: manualDiscountType || 'fixed',
                manual_discount_value: parseFloat(manualDiscount) || 0,
                sale_location: saleLocation || 'local'
            };

            console.log('Sale payload created:', salePayload);

            // Validate salePayload before using it
            if (!salePayload || typeof salePayload !== 'object') {
                console.error('salePayload is invalid:', salePayload);
                throw new Error('Error al preparar los datos de la venta.');
            }

            // --- OFFLINE-FIRST FLUIDITY LOGIC ---
            // We always queue the action locally first to ensure the UI is fast ("fluidez constante")
            // The SyncService will handle the background push to Supabase.
            
            await SyncService.queueAction('sale', salePayload, { items: cart });

            // 1. Optimistic Stock Update
            if (checkoutSaleType !== 'budget') {
                cart.forEach(item => {
                    const localDeduct = saleLocation === 'local' ? item.qty : 0;
                    updateProductStock(item.id, localDeduct, item.qty);
                });
            }

            // 2. Optimistic Finance Update
            if (checkoutSaleType !== 'budget') {
                const optSale = {
                    ...salePayload,
                    id: `local-${Date.now()}`,
                    created_at: new Date().toISOString()
                };
                const optItems = cart.map(item => ({
                    sale_id: optSale.id,
                    product_id: item.id,
                    quantity: item.qty,
                    products: { name: item.name }
                }));
                addSaleLocal(optSale, optItems);
            }

            // Success! 
            if (Platform.OS === 'web') {
                let successTitle = '✅ Operación Registrada';
                let successMessage = `Total: $${total.toFixed(2)}\nCliente: ${client ? client.name : 'Anónimo'}\n\nLa operación se sincronizará en segundo plano. ¿Deseas generar el PDF?`;
                
                if (window.confirm(`${successTitle}\n${successMessage}`)) {
                    await generateReceiptPDF(salePayload, client, cart, checkoutSaleType);
                }
                clearCart();
                setSelectedClient(null);
                setSelectedPromo(null);
                setManualDiscount('');
                setManualDiscountType('fixed');
                setClientModalVisible(false);
                navigation.navigate('Sales');
            } else {
                let successTitle = '✅ Operación Registrada';
                let successMessage = `Total: $${total.toFixed(2)}\nCliente: ${client ? client.name : 'Anónimo'}\n\nLa operación se sincronizará en segundo plano.`;
                
                Alert.alert(
                    successTitle,
                    successMessage,
                    [
                        {
                            text: 'CERRAR',
                            onPress: () => {
                                clearCart();
                                setSelectedClient(null);
                                setSelectedPromo(null);
                                setManualDiscount('');
                                setManualDiscountType('fixed');
                                setClientModalVisible(false);
                                navigation.navigate('Sales');
                            }
                        },
                        {
                            text: 'VER PDF',
                            onPress: async () => {
                                await generateReceiptPDF(salePayload, client, cart, checkoutSaleType);
                                clearCart();
                                setSelectedClient(null);
                                setSelectedPromo(null);
                                setManualDiscount('');
                                setManualDiscountType('fixed');
                                setClientModalVisible(false);
                                navigation.navigate('Sales');
                            }
                        }
                    ]
                );
            }

            return; // Exit here, the background sync handles the rest.

        } catch (error) {
            console.log('Checkout Error:', error);
            if (Platform.OS === 'web') alert(`Error: ${error.message}`);
            else Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    const renderHeader = () => (
        <View style={styles.compactHeader}>
            <View style={styles.headerTopRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtnSmall}>
                    <MaterialCommunityIcons name="arrow-left" size={20} color="#d4af37" />
                </TouchableOpacity>
                <View style={styles.locationSmallToggle}>
                    <TouchableOpacity 
                        style={[styles.locOptionSmall, saleLocation === 'local' && styles.locOptionActive]} 
                        onPress={() => setSaleLocation('local')}
                    >
                        <Text style={[styles.locOptionText, saleLocation === 'local' && styles.locOptionTextActive]}>JUJUY</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.locOptionSmall, saleLocation === 'cordoba' && styles.locOptionActive]} 
                        onPress={() => {
                            setSaleLocation('cordoba');
                            setCommissionType('direct');
                        }}
                    >
                        <Text style={[styles.locOptionText, saleLocation === 'cordoba' && styles.locOptionTextActive]}>CÓRDOBA</Text>
                    </TouchableOpacity>
                </View>
                <View style={{ width: 30 }} />
            </View>

            <View style={styles.summaryCompact}>
                <View>
                    <Text style={styles.summaryLabel}>TOTAL PRODUCTOS</Text>
                    <Text style={styles.summaryAmount}>${total.toLocaleString('es-AR', { minimumFractionDigits: 0 })}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.summaryLabel}>CLIENTE</Text>
                    <TouchableOpacity 
                        onPress={() => setClientModalVisible(true)}
                        style={styles.clientInlineBtn}
                    >
                        <Text style={styles.clientInlineText} numberOfLines={1}>
                            {selectedClient ? selectedClient.name.toUpperCase() : 'SELECCIONAR ▼'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
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

            <FlatList
                data={cart}
                keyExtractor={(item, index) => `${item.id}-${item.color || 'no-color'}-${index}`}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 15, paddingBottom: 250 }}
                renderItem={({ item, index }) => (
                    <CartItem
                        key={item.cartId || `${item.id}-${index}`}
                        item={item}
                        onRemove={removeFromCart}
                        onSplit={splitCartItem}
                        onOverride={setManualOverride}
                        manualOverride={manualOverrides[item.id]}
                        regionalPrice={getRegionalPrice(item, saleLocation)}
                    />
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="cart-plus" size={50} color="#1a1a1a" />
                        <Text style={styles.emptyText}>Lista vacía</Text>
                        <TouchableOpacity style={styles.addInitialBtn} onPress={handleAddProductPress}>
                            <Text style={styles.addInitialText}>AGREGAR PRODUCTO</Text>
                        </TouchableOpacity>
                    </View>
                }
                ListFooterComponent={
                    <View style={styles.formFooter}>
                        <PromotionSelector
                            promos={availablePromos}
                            selectedPromo={selectedPromo}
                            onSelectPromo={setSelectedPromo}
                        />

                        {/* 📦 ORIGEN (SOLO CÓRDOBA) */}
                        {saleLocation === 'cordoba' && (
                            <View style={styles.originPickerSimple}>
                                <Text style={styles.sectionLabel}>ORIGEN DE MERCADERÍA:</Text>
                                <View style={styles.originRow}>
                                    <TouchableOpacity 
                                        style={[styles.originOption, commissionType === 'direct' && styles.originOptionActive]} 
                                        onPress={() => setCommissionType('direct')}
                                    >
                                        <Text style={[styles.originText, commissionType === 'direct' && styles.originTextActive]}>STOCK CBA</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity 
                                        style={[styles.originOption, commissionType === 'closer' && styles.originOptionActive]} 
                                        onPress={() => setCommissionType('closer')}
                                    >
                                        <Text style={[styles.originText, commissionType === 'closer' && styles.originTextActive]}>ENVÍO JUJUY</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                        
                        {/* LIDER SPLIT (SIEMPRE VISIBLE PARA LIDER/ADMIN) */}
                        {(currentUserRole === 'admin' || currentUserRole === 'leader') && (
                            <TouchableOpacity
                                style={[styles.leaderToggleSmall, isLeaderSale && styles.leaderToggleActive]}
                                onPress={() => setIsLeaderSale(!isLeaderSale)}
                            >
                                <MaterialCommunityIcons name="star-circle" size={18} color={isLeaderSale ? "#00ff88" : "#444"} />
                                <Text style={[styles.leaderToggleText, isLeaderSale && { color: '#00ff88' }]}>
                                    VENDE GUILLE (Comisión 5%)
                                </Text>
                            </TouchableOpacity>
                        )}

                        <View style={{ height: 100 }} />
                    </View>
                }
            />

            {/* 🔥 ACCIÓN FINAL (ESTILO STICKY FOOTER) */}
            <View style={styles.actionFooter}>
                <View style={styles.subtotalRow}>
                    <Text style={styles.subtotalLabel}>Subtotal: ${subtotal.toFixed(0)}</Text>
                    {discount > 0 && <Text style={styles.discountLabel}>Desc: -${discount.toFixed(0)}</Text>}
                </View>

                {/* BOTÓN PRINCIPAL */}
                <TouchableOpacity
                    style={[styles.primaryCTA, (cart.length === 0 || loading) && styles.ctaDisabled]}
                    onPress={() => handleCheckout('completed')}
                    disabled={cart.length === 0 || loading}
                >
                    {loading ? <ActivityIndicator color="black" /> : (
                        <Text style={styles.ctaText}>COBRAR ${total.toFixed(0)}</Text>
                    )}
                </TouchableOpacity>

                {/* BOTONES SECUNDARIOS */}
                <View style={styles.secondaryActions}>
                    <TouchableOpacity 
                        style={styles.secBtn} 
                        onPress={() => handleCheckout('pending')}
                        disabled={cart.length === 0 || loading}
                    >
                        <Text style={styles.secBtnText}>MARCAR DEUDA</Text>
                    </TouchableOpacity>
                    <View style={{ width: 10 }} />
                    <TouchableOpacity 
                        style={styles.secBtn} 
                        onPress={() => handleCheckout('budget')}
                        disabled={cart.length === 0 || loading}
                    >
                        <Text style={styles.secBtnText}>PRESUPUESTO</Text>
                    </TouchableOpacity>
                </View>

                {/* BOTÓN ACCESO RÁPIDO AGREGAR */}
                <View style={styles.floatingActionRow}>
                    <TouchableOpacity style={styles.fabBtn} onPress={() => setIsScanning(true)}>
                        <MaterialCommunityIcons name="barcode-scan" size={24} color="#000" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.fabBtn, { backgroundColor: '#111', borderWidth: 1, borderColor: '#333' }]} onPress={handleAddProductPress}>
                        <MaterialCommunityIcons name="plus" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>
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
                selectedColor={selectedColor}
                setSelectedColor={setSelectedColor}
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
                    setSelectedClient(client); // Save client to state
                    setClientModalVisible(false);
                    
                    // If we're in selectClientFirst mode, open product modal instead of checkout
                    if (selectClientFirstMode) {
                        setTimeout(() => {
                            setSelectClientFirstMode(false); // Reset the mode
                            setProductModalVisible(true);
                        }, 300);
                    } else {
                        // Normal flow: process checkout
                        // Use ref instead of state to avoid async timing issues
                        setTimeout(() => processCheckout(client, checkoutTypeRef.current), 500);
                    }
                }}
                showNewClientForm={showNewClientForm}
                setShowNewClientForm={setShowNewClientForm}
                newClientName={newClientName}
                setNewClientName={setNewClientName}
                newClientPhone={newClientPhone}
                setNewClientPhone={setNewClientPhone}
                handleCreateClient={handleCreateClient}
                creatingClient={creatingClient}
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
    container: { flex: 1, backgroundColor: '#000' },
    compactHeader: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 15, backgroundColor: '#000', borderBottomWidth: 1, borderBottomColor: '#111' },
    headerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
    backBtnSmall: { padding: 8, borderRadius: 10, backgroundColor: '#0a0a0a' },
    locationSmallToggle: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderRadius: 8, padding: 3, borderWidth: 1, borderColor: '#111' },
    locOptionSmall: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
    locOptionActive: { backgroundColor: '#d4af37' },
    locOptionText: { color: '#444', fontSize: 10, fontWeight: '900' },
    locOptionTextActive: { color: '#000' },
    summaryCompact: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    summaryLabel: { color: '#444', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
    summaryAmount: { color: '#fff', fontSize: 28, fontWeight: '900' },
    clientInlineBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#1a1a1a' },
    clientInlineText: { color: '#d4af37', fontSize: 11, fontWeight: 'bold' },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
    emptyText: { color: '#333', fontSize: 16, fontWeight: '900', marginTop: 10 },
    addInitialBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#d4af3720', borderRadius: 10, borderWidth: 1, borderColor: '#d4af3740' },
    addInitialText: { color: '#d4af37', fontSize: 12, fontWeight: 'bold' },

    formFooter: { marginTop: 20 },
    sectionLabel: { color: '#444', fontSize: 10, fontWeight: '900', marginLeft: 15, marginBottom: 8, marginTop: 20 },
    originPickerSimple: { paddingHorizontal: 15 },
    originRow: { flexDirection: 'row', gap: 10 },
    originOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#111' },
    originOptionActive: { borderColor: '#d4af37', backgroundColor: '#d4af3710' },
    originText: { color: '#444', fontSize: 11, fontWeight: '900' },
    originTextActive: { color: '#d4af37' },
    leaderToggleSmall: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 15, marginTop: 20, backgroundColor: '#0a0a0a', padding: 12, borderRadius: 10, gap: 10 },
    leaderToggleActive: { backgroundColor: '#00ff8808', borderWidth: 1, borderColor: '#00ff8820' },
    leaderToggleText: { color: '#444', fontSize: 11, fontWeight: 'bold' },

    actionFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#000', padding: 20, paddingBottom: 40, borderTopWidth: 1, borderTopColor: '#111' },
    subtotalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15, paddingHorizontal: 5 },
    subtotalLabel: { color: '#888', fontSize: 13, fontWeight: '700' },
    discountLabel: { color: '#ff3b3b', fontSize: 13, fontWeight: '900' },
    primaryCTA: { backgroundColor: '#d4af37', paddingVertical: 16, borderRadius: 15, alignItems: 'center', shadowColor: '#d4af37', shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 },
    ctaDisabled: { backgroundColor: '#222' },
    ctaText: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    secondaryActions: { flexDirection: 'row', marginTop: 15 },
    secBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: '#0a0a0a', borderRadius: 10, borderWidth: 1, borderColor: '#111' },
    secBtnText: { color: '#666', fontSize: 10, fontWeight: '900' },
    floatingActionRow: { flexDirection: 'row', position: 'absolute', top: -70, right: 20, gap: 10 },
    fabBtn: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 10 },
});
