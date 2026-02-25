import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Switch, Modal, FlatList, StatusBar } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CRMService } from '../services/crmService';
import { GeminiService } from '../services/geminiService';
import { Linking } from 'react-native';

export default function AddProductScreen({ navigation, route }) {
    // Wizard Mode: Detect "Product to Edit" either from params or from Queue
    const queueItem = route.params?.importQueue ? route.params.importQueue[route.params.importIndex] : null;
    const productToEdit = queueItem?.product || route.params?.product;
    const isWizardMode = !!route.params?.importQueue;

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const checkRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role !== 'admin') {
                Alert.alert('Acceso Denegado', 'Solo los Líderes pueden agregar productos.');
                navigation.replace('Main');
            }
        };
        checkRole();
        requestPermission(); // Warm up camera
    }, []);
    const [image, setImage] = useState(route.params?.scannedImage || null);

    // Scanner State
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [scanningMode, setScanningMode] = useState('main'); // 'main' or 'bundle'
    const [lastScannedInfo, setLastScannedInfo] = useState(null); // Feedback for bundle scan

    // Bundle / Combo State
    const [isBundle, setIsBundle] = useState(false);
    const [bundleItems, setBundleItems] = useState([]);
    const [allProducts, setAllProducts] = useState([]);
    const [showBundlePicker, setShowBundlePicker] = useState(false);
    const [searchProd, setSearchProd] = useState('');

    // Overhead State
    const [overheadInternet, setOverheadInternet] = useState('');
    const [overheadElectricity, setOverheadElectricity] = useState('');
    const [showOverheadCalc, setShowOverheadCalc] = useState(false);
    const [calcInternet, setCalcInternet] = useState('');
    const [calcElectricity, setCalcElectricity] = useState('');
    const [calcBatch, setCalcBatch] = useState('');

    // CRM Match State
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [potentialClients, setPotentialClients] = useState([]);
    const [generatingMsg, setGeneratingMsg] = useState(null);

    // PPP (Weighted Average) State
    const [pendingPurchases, setPendingPurchases] = useState([]);
    const [showPPPModal, setShowPPPModal] = useState(false);
    const [selectedPPPItems, setSelectedPPPItems] = useState([]);

    // Supplier State
    const [suppliersList, setSuppliersList] = useState([]);
    const [showSupplierModal, setShowSupplierModal] = useState(false);
    const [supplierSearch, setSupplierSearch] = useState('');

    // Variants State
    const [variants, setVariants] = useState([]);

    const [formData, setFormData] = useState({
        name: route.params?.scannedName || '',
        description: route.params?.scannedDescription || '',
        provider: '',
        cost_price: '',
        profit_margin_percent: '',
        sale_price: '',
        stock_local: '',
        stock_cordoba: '',
        defect_notes: '',
        barcode: route.params?.scannedBarcode || ''
    });



    // Calculate Sale Price automatically
    useEffect(() => {
        if (formData.cost_price && formData.profit_margin_percent) {
            const cost = parseFloat(formData.cost_price);
            const margin = parseFloat(formData.profit_margin_percent);

            if (!isNaN(cost) && !isNaN(margin)) {
                // Sale Price = Cost * (1 + Margin)
                const calculatedPrice = cost * (1 + (margin / 100));

                setFormData(prev => ({
                    ...prev,
                    sale_price: calculatedPrice.toFixed(2)
                }));
            }
        }
    }, [formData.cost_price, formData.profit_margin_percent, overheadInternet, overheadElectricity]);

    // Apply Calculator
    const applyOverheadCalc = () => {
        const batch = parseFloat(calcBatch);
        if (!batch || batch <= 0) {
            Alert.alert('Error', 'La cantidad del lote debe ser mayor a 0');
            return;
        }
        const iBill = parseFloat(calcInternet) || 0;
        const eBill = parseFloat(calcElectricity) || 0;

        const iUnit = iBill / batch;
        const eUnit = eBill / batch;

        setOverheadInternet(iUnit.toFixed(2));
        setOverheadElectricity(eUnit.toFixed(2));
        setShowOverheadCalc(false);
    };

    // Synchronize with Scan Parameters from Home
    useEffect(() => {
        if (route.params?.scannedBarcode || route.params?.scannedName) {
            setFormData(prev => ({
                ...prev,
                barcode: route.params.scannedBarcode || prev.barcode,
                name: route.params.scannedName || prev.name,
                description: route.params.scannedDescription || prev.description,
            }));
            if (route.params.scannedImage) {
                setImage(route.params.scannedImage);
            }
        }
    }, [route.params?.scannedBarcode, route.params?.scannedName]);

    useEffect(() => {
        if (productToEdit) {
            if (productToEdit.description?.startsWith('[[BUNDLE:')) {
                try {
                    const parts = productToEdit.description.split(']]');
                    const jsonStr = parts[0].replace('[[BUNDLE:', '');
                    const data = JSON.parse(jsonStr);
                    setBundleItems(data.items || []);
                    setIsBundle(true);

                    // Clean description for the form (removing the tag)
                    setFormData(prev => ({ ...prev, description: parts.slice(1).join(']]').trim() }));
                } catch (e) {
                    console.log('Error parsing bundle:', e);
                }
            }
        }
    }, [productToEdit]);

    const fetchAllProducts = useCallback(async () => {
        const { data } = await supabase
            .from('products')
            .select('id, name, sale_price, barcode, image_url')
            .eq('active', true)
            .order('name');
        setAllProducts(data || []);
    }, []);

    const fetchSuppliers = useCallback(async () => {
        const { data } = await supabase.from('suppliers').select('*').eq('active', true).order('name', { ascending: true });
        if (data) setSuppliersList(data);
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchSuppliers();
            fetchAllProducts();
        }, [fetchSuppliers])
    );

    const handleSupplierSelect = (supplier) => {
        handleChange('provider', supplier.name);
        setShowSupplierModal(false);
    };

    const handleCreateSupplier = async () => {
        if (!supplierSearch.trim()) return;
        try {
            const { data, error } = await supabase
                .from('suppliers')
                .insert({ name: supplierSearch.trim() })
                .select()
                .single();

            if (error) throw error;
            if (data) {
                handleSupplierSelect(data);
                fetchSuppliers();
                Alert.alert('✅ Éxito', 'Proveedor creado y seleccionado.');
            }
        } catch (err) {
            Alert.alert('Error', 'No se pudo crear el proveedor. Verificá si ya existe.');
        }
    };



    const toggleBundleItem = (prod) => {
        setBundleItems(prev => {
            const exists = prev.find(i => i.id === prod.id);
            if (exists) return prev.filter(i => i.id !== prod.id);
            return [...prev, { id: prod.id, name: prod.name, qty: 1 }];
        });
    };

    const updateBundleItemQty = (id, delta) => {
        setBundleItems(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.qty + delta;
                return { ...item, qty: newQty < 1 ? 1 : newQty };
            }
            return item;
        }));
    };

    const handleQuickAddProduct = async (info) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .insert([{
                    name: info.name,
                    barcode: info.barcode,
                    image_url: info.image,
                    active: true,
                    cost_price: 0,
                    sale_price: 0,
                    current_stock: 0,
                    description: 'Creado automáticamente desde escáner de Kit'
                }])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                // Actualizar lista local para que futuras búsquedas lo encuentren
                setAllProducts(prev => [...prev, data]);
                // Añadir al bundle
                setBundleItems(prev => [...prev, { id: data.id, name: data.name, qty: 1 }]);
                setLastScannedInfo(null);
                setScanned(false);
            }
        } catch (err) {
            console.log('Quick add error:', err);
            Alert.alert('Error', 'No se pudo crear el producto automáticamente.');
        } finally {
            setLoading(false);
        }
    };

    // Fetch other pending purchases for PPP
    useEffect(() => {
        const fetchPendingPurchases = async () => {
            if (!queueItem) return;

            try {
                let query = supabase
                    .from('supplier_order_items')
                    .select('*, supplier_orders!inner(status, provider_name, created_at)')
                    .eq('supplier_orders.status', 'pending');

                if (queueItem.product?.id) {
                    query = query.eq('product_id', queueItem.product.id);
                } else {
                    query = query.eq('temp_product_name', queueItem.name);
                }

                const { data, error } = await query;
                if (!error && data) {
                    // Exclude the current item being processed
                    const others = data.filter(item => item.id !== queueItem.id);
                    setPendingPurchases(others);
                }
            } catch (err) {
                console.log('Error fetching pending purchases:', err);
            }
        };

        fetchPendingPurchases();
    }, [route.params?.importIndex, queueItem?.id]);

    const calculatePPP = () => {
        if (!queueItem) return;

        let totalCost = (parseFloat(queueItem.cost) || 0) * (parseInt(queueItem.quantity) || 1);
        let totalQty = parseInt(queueItem.quantity) || 1;

        selectedPPPItems.forEach(item => {
            totalCost += (parseFloat(item.cost_per_unit) || 0) * (parseInt(item.quantity) || 1);
            totalQty += parseInt(item.quantity) || 1;
        });

        const ppp = totalCost / totalQty;
        setFormData(prev => ({
            ...prev,
            cost_price: ppp.toFixed(2),
            // Update stock too if we are receiving them all? 
            // Better only update cost as requested, and let user adjust quantity if needed
        }));
        setShowPPPModal(false);
        Alert.alert('💡 Precio Promediado', `Se calculó un costo promedio de $${ppp.toFixed(2)} basado en las compras seleccionadas.`);
    };

    // Wizard Mode: Pre-fill from Import Queue
    useEffect(() => {
        if (queueItem) {
            setFormData(prev => ({
                ...prev,
                name: queueItem.name || queueItem.temp_product_name || productToEdit?.name || prev.name,
                cost_price: queueItem.cost?.toString() || queueItem.cost_per_unit?.toString() || prev.cost_price,
                stock_local: queueItem.quantity?.toString() || prev.stock_local,
                provider: queueItem.provider || queueItem.supplier || queueItem.supplier_orders?.provider_name || prev.provider
            }));

            if (queueItem.color) {
                setVariants([{ color: queueItem.color, stock: queueItem.quantity?.toString() || "" }]);
            }
        }
    }, [queueItem]);

    // Load data if editing (existing product)
    useEffect(() => {
        if (productToEdit) {
            try {
                setFormData({
                    name: productToEdit.name || '',
                    description: productToEdit.description || '',
                    provider: productToEdit.provider || '',
                    cost_price: productToEdit.cost_price?.toString() || '',
                    profit_margin_percent: productToEdit.profit_margin_percent?.toString() || '',
                    sale_price: productToEdit.sale_price?.toString() || '',
                    stock_local: productToEdit.stock_local?.toString() || '',
                    stock_cordoba: productToEdit.stock_cordoba?.toString() || '',
                    defect_notes: productToEdit.defect_notes || '',
                    barcode: productToEdit.barcode || ''
                });
                setOverheadInternet(productToEdit.internet_cost?.toString() || '');
                setOverheadElectricity(productToEdit.electricity_cost?.toString() || '');
                setVariants(Array.isArray(productToEdit.variants) ? productToEdit.variants : []);
                if (productToEdit.image_url) {
                    setImage(productToEdit.image_url);
                }
            } catch (err) {
                console.error('Error initializing product data:', err);
                Alert.alert('Error', 'Hubo un problema al cargar los datos del producto.');
            }
        }
    }, [productToEdit]);

    const addVariant = () => {
        setVariants([...variants, { color: '', stock: '' }]);
    };

    const removeVariant = (idx) => {
        setVariants(variants.filter((_, i) => i !== idx));
    };

    const updateVariant = (idx, field, value) => {
        const updated = [...variants];
        updated[idx] = { ...updated[idx], [field]: value };
        setVariants(updated);

        // Optional: Auto-update local stock as sum of variants
        const totalVariantStock = updated.reduce((sum, v) => sum + (parseInt(v.stock) || 0), 0);
        if (totalVariantStock > 0) {
            setFormData(prev => ({ ...prev, stock_local: totalVariantStock.toString() }));
        }
    };

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const uploadImage = async (uri) => {
        try {
            const filename = uri.split('/').pop();
            const ext = filename.split('.').pop();
            const path = `${Date.now()}.${ext}`;

            const formData = new FormData();
            formData.append('file', {
                uri,
                name: filename,
                type: `image/${ext}`
            });

            // 1. Attempt Upload
            let { data, error } = await supabase.storage
                .from('product-images')
                .upload(path, formData, {
                    contentType: `image/${ext}`,
                });

            // 2. If Bucket not found, Try to Create it
            if (error && error.message.includes('Bucket not found')) {
                console.log('Bucket missing. Attempting to create "product-images"...');
                const { error: createError } = await supabase.storage.createBucket('product-images', { public: true });

                if (createError) {
                    console.log('Failed to auto-create bucket:', createError);
                    throw new Error('No existe el bucket "product-images" y no tengo permisos para crearlo. Ejecuta el script SQL.');
                }

                // Retry Upload
                const retry = await supabase.storage
                    .from('product-images')
                    .upload(path, formData, {
                        contentType: `image/${ext}`,
                    });
                data = retry.data;
                error = retry.error;
            }

            if (error) {
                console.log('Upload final error:', error);
                throw new Error(error.message || 'Error al subir imagen');
            }

            const { data: publicUrlData } = supabase.storage
                .from('product-images')
                .getPublicUrl(path);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.log('Image upload failed:', error);
            Alert.alert('Error Subida', error.message);
            return null;
        }
    };

    const saveProduct = async () => {
        if (!formData.name || !formData.sale_price) {
            Alert.alert('Error', 'El nombre y el precio de venta son obligatorios.');
            return;
        }

        // Check for Liquidation Condition
        if (productToEdit) {
            const oldCost = parseFloat(productToEdit.cost_price);
            const newCost = parseFloat(formData.cost_price);
            const oldPrice = parseFloat(productToEdit.sale_price);
            const newPrice = parseFloat(formData.sale_price);
            const oldStock = (parseInt(productToEdit.stock_local) || 0) + (parseInt(productToEdit.stock_cordoba) || 0);
            const newTotalStock = (parseInt(formData.stock_local) || 0) + (parseInt(formData.stock_cordoba) || 0);
            const addedStock = newTotalStock - oldStock;

            // --- PROMEDIO DE PRECIO: Si cambió el costo y se está agregando stock ---
            if (oldCost !== newCost && addedStock > 0 && oldStock > 0) {
                const pppAvg = ((oldCost * oldStock) + (newCost * addedStock)) / (oldStock + addedStock);
                Alert.alert(
                    '📊 Costo Promedio Detectado',
                    `Tenías ${oldStock} unidades a $${oldCost} y agregás ${addedStock} a $${newCost}.\n\nCosto promedio ponderado: $${pppAvg.toFixed(2)}\n\n¿Querés usar el promedio o mantener el nuevo precio?`,
                    [
                        {
                            text: `Usar Promedio ($${pppAvg.toFixed(2)})`,
                            onPress: () => {
                                setFormData(prev => ({ ...prev, cost_price: pppAvg.toFixed(2) }));
                                // Re-trigger save after updating
                                setTimeout(() => checkLiquidationAndSave(false, pppAvg), 100);
                            }
                        },
                        {
                            text: `Mantener Nuevo ($${newCost})`,
                            onPress: () => checkLiquidationAndSave(false, newCost)
                        },
                        { text: 'Cancelar', style: 'cancel' }
                    ]
                );
                return;
            }

            // --- LIQUIDATION: Si cambió el precio venta y hay stock viejo ---
            if (oldPrice !== newPrice && addedStock > 0 && oldStock > 0) {
                Alert.alert(
                    'Cambio de Precio Detectado',
                    `El precio ha cambiado de $${oldPrice} a $${newPrice}.\n\n¿Qué deseas hacer con las ${oldStock} unidades anteriores?`,
                    [
                        {
                            text: 'Actualizar Todo',
                            onPress: () => executeSave(false),
                            style: 'default'
                        },
                        {
                            text: 'Liquidar Viejo Stock',
                            onPress: () => executeSave(true),
                            style: 'destructive'
                        },
                        {
                            text: 'Cancelar',
                            style: 'cancel'
                        }
                    ]
                );
                return;
            }
        }

        // Default save (New product or no critical change)
        executeSave(false);
    };

    // Helper for post-PPP save (avoids re-running all checks)
    const checkLiquidationAndSave = (isLiquidation, resolvedCost) => {
        executeSave(isLiquidation, resolvedCost);
    };

    const executeSave = async (isLiquidation, overrideCost = null) => {
        setLoading(true);
        try {
            let finalImageUrl = image;

            // If image is local URI (not http), upload it
            if (image && !image.startsWith('http')) {
                const uploadedUrl = await uploadImage(image);
                if (uploadedUrl) {
                    finalImageUrl = uploadedUrl;
                } else {
                    Alert.alert('Advertencia', 'No se pudo subir la imagen. Se guardará sin foto nueva.');
                    finalImageUrl = productToEdit?.image_url || null;
                }
            }

            // Common Payload Data
            let finalDescription = formData.description;
            if (isBundle && bundleItems.length > 0) {
                // Remove existing bundle tags if any (prevent nesting)
                const cleanDesc = formData.description.replace(/^\[\[BUNDLE:.*?\]\]/s, '').trim();
                finalDescription = `[[BUNDLE:${JSON.stringify({ items: bundleItems })}]] ${cleanDesc}`;
            }

            const basePayload = {
                description: finalDescription,
                provider: formData.provider,
                cost_price: parseFloat(formData.cost_price) || 0,
                profit_margin_percent: parseFloat(formData.profit_margin_percent) || 0,
                internet_cost: parseFloat(overheadInternet) || 0,
                electricity_cost: parseFloat(overheadElectricity) || 0,
                defect_notes: formData.defect_notes,
                variants: variants,
                active: true,
                image_url: finalImageUrl,
            };

            let productId = productToEdit?.id;
            let stockDifference = 0;
            let costPrice = overrideCost !== null ? overrideCost : (parseFloat(formData.cost_price) || 0);

            if (isLiquidation && productToEdit) {
                // --- LIQUIDATION LOGIC ---
                // 1. Update OLD product (Liquidation)
                const oldStockLocal = parseInt(productToEdit.stock_local) || 0;
                const oldStockCordoba = parseInt(productToEdit.stock_cordoba) || 0;
                const { error: updateError } = await supabase
                    .from('products')
                    .update({
                        name: `${productToEdit.name} (LIQUIDACIÓN)`,
                        barcode: `LIQ-${productToEdit.barcode || Date.now()}`,
                        // Keep old price and old stock
                        sale_price: productToEdit.sale_price,
                        stock_local: oldStockLocal,
                        stock_cordoba: oldStockCordoba,
                        current_stock: oldStockLocal + oldStockCordoba, // Maintain for legacy if needed
                        active: true // Ensure it stays active
                    })
                    .eq('id', productToEdit.id);

                if (updateError) throw updateError;

                // 2. Create NEW product
                const newTotalStock = (parseInt(formData.stock_local) || 0) + (parseInt(formData.stock_cordoba) || 0);
                const oldTotalStock = oldStockLocal + oldStockCordoba;
                const newStockOnly = newTotalStock - oldTotalStock; // Only the new units
                stockDifference = newStockOnly; // For expense calculation

                const { data: newProd, error: insertError } = await supabase
                    .from('products')
                    .insert([{
                        ...basePayload,
                        name: formData.name, // New Name
                        sale_price: parseFloat(formData.sale_price) || 0, // New Price
                        current_stock: newStockOnly, // Only new stock
                        barcode: formData.barcode?.trim() || null // New Barcode (or kept from scan)
                    }])
                    .select()
                    .single();

                if (insertError) throw insertError;
                productId = newProd.id; // Future operations on the NEW product

                Alert.alert('Liquidación Exitosa', 'Se ha separado el stock antiguo como "Liquidación" y creado el nuevo ingreso.');

            } else {
                // --- NORMAL LOGIC (Update or Insert) ---
                const productPayload = {
                    ...basePayload,
                    name: formData.name,
                    sale_price: parseFloat(formData.sale_price) || 0,
                    stock_local: parseInt(formData.stock_local) || 0,
                    stock_cordoba: parseInt(formData.stock_cordoba) || 0,
                    current_stock: (parseInt(formData.stock_local) || 0) + (parseInt(formData.stock_cordoba) || 0),
                    barcode: formData.barcode?.trim() || null
                };

                if (productToEdit) {
                    // Update
                    const { error: updateError } = await supabase
                        .from('products')
                        .update(productPayload)
                        .eq('id', productToEdit.id);
                    if (updateError) throw updateError;

                    // Calculate stock diff for expense
                    const oldStock = (parseInt(productToEdit.stock_local) || 0) + (parseInt(productToEdit.stock_cordoba) || 0);
                    const newStock = (parseInt(formData.stock_local) || 0) + (parseInt(formData.stock_cordoba) || 0);
                    if (newStock > oldStock) {
                        stockDifference = newStock - oldStock;
                    }
                } else {
                    // Insert
                    const { data: newProd, error: insertError } = await supabase
                        .from('products')
                        .insert([productPayload])
                        .select()
                        .single();
                    if (insertError) throw insertError;
                    if (newProd) productId = newProd.id;

                    stockDifference = (parseInt(formData.stock_local) || 0) + (parseInt(formData.stock_cordoba) || 0);
                }
            }

            // --- AUTO EXPENSE & ORDER GENERATION ---
            if (stockDifference > 0 && costPrice > 0 && !isWizardMode && !isBundle) {
                try {
                    const oldVariants = Array.isArray(productToEdit?.variants) ? productToEdit.variants : [];
                    const newVariants = variants || [];
                    const additions = [];

                    if (newVariants.length > 0) {
                        newVariants.forEach(nv => {
                            const ov = oldVariants.find(o => o.color === nv.color);
                            const oldQty = parseInt(ov?.stock) || 0;
                            const newQty = parseInt(nv.stock) || 0;
                            if (newQty > oldQty) {
                                additions.push({ color: nv.color, qty: newQty - oldQty });
                            }
                        });
                    }

                    const totalExpenseAmount = stockDifference * costPrice;
                    const details = additions.length > 0 ? additions : [{ color: 'General', qty: stockDifference }];

                    await supabase.from('expenses').insert({
                        description: `Inventario: ${formData.name}${additions.length > 0 ? ' (Color Mix)' : ''} (x${stockDifference})`,
                        amount: totalExpenseAmount,
                        category: 'Inventario',
                        product_id: productId,
                        quantity: stockDifference,
                        details: details,
                        created_at: new Date().toISOString()
                    });

                    // 2. Create Supplier Order (Auto-generated)
                    const { data: orderData, error: orderError } = await supabase
                        .from('supplier_orders')
                        .insert({
                            provider_name: formData.provider || 'Sin Proveedor',
                            items_description: `Ingreso Manual: ${formData.name} (x${stockDifference})`,
                            total_cost: totalExpenseAmount,
                            status: 'received',
                            installments_total: 1,
                            installments_paid: 1, // Already paid if it's an auto-expense
                            created_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                    if (!orderError && orderData && productId) {
                        // 3. Link Item (Detailing variants if possible)
                        if (additions.length > 0) {
                            for (const add of additions) {
                                await supabase.from('supplier_order_items').insert({
                                    supplier_order_id: orderData.id,
                                    product_id: productId,
                                    quantity: add.qty,
                                    cost_per_unit: costPrice,
                                    color: add.color
                                });
                            }
                        } else {
                            await supabase.from('supplier_order_items').insert({
                                supplier_order_id: orderData.id,
                                product_id: productId,
                                quantity: stockDifference,
                                cost_per_unit: costPrice
                            });
                        }
                    }
                } catch (expErr) {
                    console.log('Auto-expense error:', expErr);
                    Alert.alert('Nota', 'Producto guardado, pero falló el registro automático del gasto detalle.');
                }
            }
            // -------------------------------

            if (!isLiquidation) {
                // NOTE: Do NOT show 'guardado' Alert here if CRM modal will open.
                // The modal itself serves as confirmation. We show it only if no clients found.
                if (productId) {
                    const interested = await CRMService.findInterestedClients({
                        id: productId,
                        name: formData.name
                    });

                    if (interested.length > 0) {
                        // Show CRM modal — navigation happens when user dismisses it
                        setPotentialClients(interested);
                        setShowMatchModal(true);
                        // Navigation is handled by the modal's close/dismiss action
                        return; // Early return — don't navigate yet
                    } else {
                        Alert.alert('✅ Éxito', 'Producto guardado correctamente.');
                    }
                }
            }

            // --- WIZARD MODE NAVIGATION ---
            if (route.params?.importQueue && productId) {
                const currentItem = route.params.importQueue[route.params.importIndex];

                const { error: linkError } = await supabase
                    .from('supplier_order_items')
                    .update({ product_id: productId })
                    .eq('id', currentItem.id);

                if (linkError) console.log('Error linking product to order item:', linkError);

                const nextIndex = route.params.importIndex + 1;
                if (nextIndex < route.params.importQueue.length) {
                    Alert.alert('✅ Siguiente', 'Producto registrado. Vamos con el próximo...');
                    navigation.replace('AddProduct', {
                        importQueue: route.params.importQueue,
                        importIndex: nextIndex
                    });
                } else {
                    Alert.alert('🎉 Importación Completa', 'Todos los productos nuevos han sido registrados e ingresados al inventario.');
                    navigation.navigate('SupplierOrders');
                }
            } else {
                if (productId) {
                    navigation.navigate('Main', { screen: 'Inventario', params: { refresh: Date.now() } });
                }
            }

        } catch (err) {
            console.log('Error saving product:', err);

            if (err.code === '23505' || err.message?.includes('unique constraint')) {
                // Duplicate Barcode check
                try {
                    const { data: existing } = await supabase
                        .from('products')
                        .select('name')
                        .eq('barcode', formData.barcode?.trim())
                        .single();

                    if (existing) {
                        Alert.alert(
                            'Código Duplicado ⚠️',
                            `El código "${formData.barcode}" ya pertenece al producto: "${existing.name}".\n\nPor favor, usa un código diferente o editá el producto existente.`
                        );
                    } else {
                        Alert.alert('Error de Duplicado', 'Ya existe un producto con estos datos (posiblemente el mismo código de barras).');
                    }
                } catch (e) {
                    Alert.alert('Error', 'Este código de barras ya existe en el sistema.');
                }
            } else {
                Alert.alert('Error', 'Hubo un error al guardar. Revisa la consola/conexión.');
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        Alert.alert(
            'Eliminar Producto',
            '¿Estás seguro de que quieres eliminar este producto?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error: deleteError } = await supabase
                                .from('products')
                                .delete()
                                .eq('id', productToEdit.id);

                            if (deleteError) {
                                // If product has sales history, archive it instead
                                if (deleteError.message.includes('foreign key constraint') ||
                                    deleteError.code === '23503') {
                                    const { error: archiveError } = await supabase
                                        .from('products')
                                        .update({ active: false })
                                        .eq('id', productToEdit.id);

                                    if (archiveError) {
                                        throw archiveError;
                                    }

                                    Alert.alert(
                                        'Producto Archivado',
                                        'Este producto tiene ventas registradas, por lo que se ha archivado para mantener el historial. Ya no aparecerá en el inventario.',
                                        [{ text: 'Entendido' }]
                                    );
                                    navigation.goBack();
                                } else {
                                    throw deleteError;
                                }
                            } else {
                                Alert.alert('Éxito', 'Producto eliminado correctamente');
                                navigation.goBack();
                            }
                        } catch (err) {
                            console.log('Error deleting product:', err);
                            Alert.alert('Error', 'No se pudo eliminar el producto');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderWizardHeader = () => {
        if (!isWizardMode) return null;
        const current = (route.params.importIndex || 0) + 1;
        const total = route.params.importQueue.length;

        return (
            <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.wizardHeader}>
                <View style={styles.wizardContent}>
                    <MaterialCommunityIcons name="auto-fix" size={20} color="#000" />
                    <Text style={styles.wizardText}>
                        PROCESANDO INGRESO: <Text style={{ fontWeight: '900' }}>{current} de {total}</Text>
                    </Text>
                </View>
                <Text style={styles.wizardSub}>Estamos actualizando los datos de esta compra en tu inventario</Text>
            </LinearGradient>
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safe} edges={['top']}>
                {renderWizardHeader()}
            </SafeAreaView>

            <TouchableOpacity onPress={pickImage} style={styles.imagePicker}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.imagePreview} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <Text style={styles.imagePlaceholderText}>+ FOTO</Text>
                    </View>
                )}
            </TouchableOpacity>

            <Text style={styles.label}>Nombre del Producto *</Text>
            <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => handleChange('name', text)}
                placeholder="Ej. Zapatillas Nike Air"
            />

            <Text style={styles.label}>Código de Barras</Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                    style={[styles.input, { flex: 1 }]}
                    value={formData.barcode}
                    onChangeText={(text) => handleChange('barcode', text)}
                    placeholder="Escanear o escribir..."
                />
                <TouchableOpacity
                    style={{ backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 8 }}
                    onPress={async () => {
                        if (permission && !permission.granted) {
                            const result = await requestPermission();
                            if (!result.granted) {
                                Alert.alert("Permiso requerido", "Habilita la cámara para escanear.");
                                return;
                            }
                        }
                        setScanningMode('main');
                        setScanned(false);
                        setIsScanning(true);
                    }}
                >
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="#d4af37" />
                </TouchableOpacity>
            </View>

            <View style={styles.row}>
                <View style={styles.halfInput}>
                    <Text style={styles.label}>Costo ($)</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.cost_price}
                        onChangeText={(text) => handleChange('cost_price', text)}
                        keyboardType="numeric"
                        placeholder="0.00"
                    />
                    {pendingPurchases.length > 0 && (
                        <TouchableOpacity
                            style={styles.pppBadge}
                            onPress={() => setShowPPPModal(true)}
                        >
                            <MaterialCommunityIcons name="calculator-variant" size={14} color="#d4af37" />
                            <Text style={styles.pppBadgeText}>PROMEDIAR CON {pendingPurchases.length} COMPRAS</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.halfInput}>
                    <Text style={styles.label}>Margen (%)</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.profit_margin_percent}
                        onChangeText={(text) => handleChange('profit_margin_percent', text)}
                        keyboardType="numeric"
                        placeholder="30"
                    />
                </View>
            </View>

            {/* PPP MODAL */}
            <Modal visible={showPPPModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>PROMEDIO PONDERADO (PPP)</Text>
                        <Text style={styles.modalSubtitle}>Selecciona las compras "en camino" que llegaron en este lote para unificar el costo.</Text>

                        <ScrollView style={{ maxHeight: 300 }}>
                            <View style={styles.pppItemCurrent}>
                                <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 12 }}>ESTA COMPRA (ACTUAL)</Text>
                                <Text style={{ color: '#fff' }}>{queueItem?.quantity} un. x ${queueItem?.cost}</Text>
                            </View>

                            {pendingPurchases.map(item => {
                                const isSelected = selectedPPPItems.find(i => i.id === item.id);
                                return (
                                    <TouchableOpacity
                                        key={item.id}
                                        style={[styles.pppItem, isSelected && styles.pppItemSelected]}
                                        onPress={() => {
                                            if (isSelected) {
                                                setSelectedPPPItems(prev => prev.filter(i => i.id !== item.id));
                                            } else {
                                                setSelectedPPPItems(prev => [...prev, item]);
                                            }
                                        }}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.supplier_orders.provider_name}</Text>
                                            <Text style={{ color: '#666', fontSize: 11 }}>{new Date(item.supplier_orders.created_at).toLocaleDateString()}</Text>
                                            <Text style={{ color: '#d4af37' }}>{item.quantity} un. x ${item.cost_per_unit}</Text>
                                        </View>
                                        <MaterialCommunityIcons
                                            name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                                            size={24}
                                            color={isSelected ? "#d4af37" : "#444"}
                                        />
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        <Text style={styles.pppResultText}>
                            Nuevo Costo Estimado: <Text style={{ color: '#2ecc71' }}>${
                                (() => {
                                    let totalCost = (parseFloat(queueItem?.cost) || 0) * (parseInt(queueItem?.quantity) || 1);
                                    let totalQty = parseInt(queueItem?.quantity) || 1;
                                    selectedPPPItems.forEach(item => {
                                        totalCost += (parseFloat(item.cost_per_unit) || 0) * (parseInt(item.quantity) || 1);
                                        totalQty += parseInt(item.quantity) || 1;
                                    });
                                    return (totalCost / totalQty).toFixed(2);
                                })()
                            }</Text>
                        </Text>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelButton} onPress={() => setShowPPPModal(false)}>
                                <Text style={styles.cancelButtonText}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.applyButton} onPress={calculatePPP}>
                                <Text style={styles.applyButtonText}>APLICAR PROMEDIO</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* CRM MATCH MODAL */}
            <Modal
                visible={showMatchModal}
                transparent
                animationType="slide"
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.crmModalContent}>
                        <View style={styles.crmModalHeader}>
                            <MaterialCommunityIcons name="target" size={32} color="#d4af37" />
                            <Text style={styles.crmModalTitle}>¡Oportunidad Imperial!</Text>
                        </View>

                        <View style={{ backgroundColor: 'rgba(46,204,113,0.1)', borderRadius: 10, padding: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <MaterialCommunityIcons name="check-circle" size={18} color="#2ecc71" />
                            <Text style={{ color: '#2ecc71', fontWeight: 'bold', fontSize: 13 }}>✅ Producto guardado correctamente</Text>
                        </View>

                        <Text style={styles.crmModalSubtitle}>
                            He detectado clientes que podrían estar interesados en este ingreso:
                        </Text>

                        <ScrollView style={{ maxHeight: 300 }}>
                            {potentialClients.map((client, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={styles.clientMatchCard}
                                    onPress={async () => {
                                        setGeneratingMsg(index);
                                        try {
                                            const prompt = `Genera un mensaje de WhatsApp corto y entusiasta para avisarle a un cliente llamado ${client.name} que el producto "${formData.name}" ya está disponible nuevamente. El cliente ya lo había comprado antes o compró algo similar (${client.lastPurchasedItem}). Solo devuelve el texto del mensaje.`;
                                            const message = await GeminiService.generateMarketingCopy(prompt);

                                            const phone = client.phone?.replace(/[^0-9]/g, '');
                                            Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`);
                                        } catch (err) {
                                            console.log('Gemini error:', err);
                                            // Fallback to simple message
                                            const greeting = client.gender === 'F' ? 'Estimada' : 'Estimado';
                                            const message = `${greeting} ${client.name}, queríamos avisarle que estamos trayendo ${formData.name}, ¿estaría interesado?`;
                                            const phone = client.phone?.replace(/[^0-9]/g, '');
                                            Linking.openURL(`whatsapp://send?phone=${phone}&text=${encodeURIComponent(message)}`);
                                        } finally {
                                            setGeneratingMsg(null);
                                        }
                                    }}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.clientMatchName}>{client.name}</Text>
                                        <Text style={styles.clientMatchReason}>{client.reason}</Text>
                                        <Text style={styles.clientMatchDetail}>Venta previa: {client.lastPurchasedItem}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        <TouchableOpacity
                            style={styles.crmCloseBtn}
                            onPress={() => {
                                setShowMatchModal(false);
                                navigation.navigate('Main', { screen: 'Inventario', params: { refresh: Date.now() } });
                            }}
                        >
                            <Text style={styles.crmCloseBtnText}>CONTINUAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Break-even Analysis Section */}
            <View style={styles.analysisContainer}>
                <Text style={[styles.sectionTitle, { color: '#d4af37' }]}>ANÁLISIS DE RENTABILIDAD</Text>

                <Text style={styles.helperText}>Calcula cuántas ventas necesitas para pagar el Internet y la Luz de este periodo.</Text>

                <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.label}>Factura Internet ($)</Text>
                        <TextInput
                            style={styles.input}
                            value={overheadInternet}
                            onChangeText={setOverheadInternet}
                            keyboardType="numeric"
                            placeholder="Total a cubrir"
                            placeholderTextColor="#444"
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>Factura Luz ($)</Text>
                        <TextInput
                            style={styles.input}
                            value={overheadElectricity}
                            onChangeText={setOverheadElectricity}
                            keyboardType="numeric"
                            placeholder="Total a cubrir"
                            placeholderTextColor="#444"
                        />
                    </View>
                </View>

                {/* Analysis Result */}
                {(parseFloat(overheadInternet) > 0 || parseFloat(overheadElectricity) > 0) && (
                    <View style={styles.resultBox}>
                        {(() => {
                            const price = parseFloat(formData.sale_price) || 0;
                            const cost = parseFloat(formData.cost_price) || 0;
                            const margin = price - cost;
                            const totalFixed = (parseFloat(overheadInternet) || 0) + (parseFloat(overheadElectricity) || 0);

                            if (margin <= 0) return <Text style={{ color: '#e74c3c' }}>El precio de venta debe ser mayor al costo para calcular.</Text>;

                            const breakEven = Math.ceil(totalFixed / margin);

                            return (
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 15 }}>
                                        <MaterialCommunityIcons name="check-circle" size={26} color="#2ecc71" />
                                        <View style={{ marginLeft: 10, flex: 1 }}>
                                            <Text style={{ fontSize: 13, color: '#aaa', fontWeight: 'bold', letterSpacing: 0.5 }}>PUNTO DE EQUILIBRIO</Text>
                                            <Text style={{ fontSize: 16, color: '#fff', lineHeight: 22 }}>
                                                Con los precios actuales, el negocio cubre los gastos fijos a partir de la venta <Text style={{ fontSize: 22, color: '#2ecc71', fontWeight: '900' }}>#{breakEven}</Text> del mes.
                                            </Text>
                                        </View>
                                    </View>

                                    <View style={{ padding: 12, backgroundColor: 'rgba(241, 196, 15, 0.15)', borderRadius: 8, borderLeftWidth: 4, borderLeftColor: '#f1c40f' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                                            <MaterialCommunityIcons name="lightbulb-on" size={18} color="#f1c40f" />
                                            <Text style={{ marginLeft: 6, color: '#f1c40f', fontWeight: 'bold', fontSize: 14 }}>Indicador (Por Producto)</Text>
                                        </View>
                                        <Text style={{ fontSize: 14, color: '#ecf0f1', fontStyle: 'italic' }}>
                                            "Si solo vendieras este producto, cubrirías tus gastos en <Text style={{ fontWeight: 'bold', color: '#fff' }}>{breakEven} unidades</Text>."
                                        </Text>
                                    </View>
                                </View>
                            );
                        })()}
                    </View>
                )}
            </View>

            <Text style={styles.label}>Precio de Venta (Calculado)</Text>
            <TextInput
                style={[styles.input, styles.readOnly]}
                value={formData.sale_price}
                editable={false}
                placeholder="0.00"
            />

            <View style={styles.row}>
                <View style={styles.halfInput}>
                    <Text style={styles.label}>Stock Jujuy</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.stock_local}
                        onChangeText={(text) => handleChange('stock_local', text)}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                </View>
                <View style={styles.halfInput}>
                    <Text style={styles.label}>Stock Córdoba</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.stock_cordoba}
                        onChangeText={(text) => handleChange('stock_cordoba', text)}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                </View>
            </View>

            {/* VARIANTS SECTION */}
            <View style={{ marginTop: 20, padding: 15, backgroundColor: '#0a0a0a', borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
                    <View>
                        <Text style={{ color: '#3498db', fontSize: 13, fontWeight: '900' }}>COLORES / VARIANTES</Text>
                        <Text style={{ color: '#555', fontSize: 10 }}>Control de stock por color</Text>
                    </View>
                    <TouchableOpacity onPress={addVariant} style={{ backgroundColor: '#3498db20', padding: 8, borderRadius: 8 }}>
                        <MaterialCommunityIcons name="plus" size={20} color="#3498db" />
                    </TouchableOpacity>
                </View>

                {variants.map((v, idx) => (
                    <View key={idx} style={{ flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'center' }}>
                        <TextInput
                            style={[styles.input, { flex: 2, marginBottom: 0 }]}
                            placeholder="Color"
                            placeholderTextColor="#666"
                            value={v.color}
                            onChangeText={(val) => updateVariant(idx, 'color', val)}
                        />
                        <TextInput
                            style={[styles.input, { flex: 1, marginBottom: 0 }]}
                            placeholder="Cant."
                            placeholderTextColor="#666"
                            keyboardType="numeric"
                            value={v.stock !== undefined && v.stock !== null ? v.stock.toString() : ''}
                            onChangeText={(val) => updateVariant(idx, 'stock', val)}
                        />
                        <TouchableOpacity onPress={() => removeVariant(idx)}>
                            <MaterialCommunityIcons name="close-circle" size={24} color="#e74c3c" />
                        </TouchableOpacity>
                    </View>
                ))}
                {variants.length > 0 && (
                    <Text style={{ color: '#555', fontSize: 10, marginTop: 5, fontStyle: 'italic' }}>
                        * El stock total se actualizará automáticamente basado en las variantes.
                    </Text>
                )}
            </View>

            <Text style={styles.label}>Proveedor</Text>
            <View style={[styles.input, { flexDirection: 'row', alignItems: 'center', padding: 0 }]}>
                <TextInput
                    style={{ flex: 1, color: '#fff', padding: 15 }}
                    value={formData.provider}
                    onChangeText={(text) => handleChange('provider', text)}
                    placeholder="Ej. Distribuidora X"
                    placeholderTextColor="#444"
                />
                <TouchableOpacity
                    style={{ padding: 15 }}
                    onPress={() => {
                        fetchSuppliers();
                        setShowSupplierModal(true);
                    }}
                >
                    <MaterialCommunityIcons name="database-search" size={24} color="#d4af37" />
                </TouchableOpacity>
            </View>

            {/* COMBO / BUNDLE SECTION */}
            <View style={{ marginTop: 20, padding: 15, backgroundColor: '#0a0a0a', borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ color: '#d4af37', fontSize: 13, fontWeight: '900' }}>¿ES UN COMBO / KIT?</Text>
                        <Text style={{ color: '#555', fontSize: 10 }}>Descuenta stock de varios productos</Text>
                    </View>
                    <Switch
                        value={isBundle}
                        onValueChange={setIsBundle}
                        trackColor={{ false: '#333', true: '#d4af37' }}
                        thumbColor={isBundle ? '#fff' : '#666'}
                    />
                </View>

                {isBundle && (
                    <View style={{ marginTop: 15 }}>
                        {bundleItems.map(item => (
                            <View key={item.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 5 }}>
                                <Text style={{ color: '#fff', flex: 1, fontSize: 12 }}>{item.name}</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <TouchableOpacity onPress={() => updateBundleItemQty(item.id, -1)}>
                                        <MaterialCommunityIcons name="minus-circle-outline" size={20} color="#666" />
                                    </TouchableOpacity>
                                    <Text style={{ color: '#d4af37', fontWeight: 'bold', width: 20, textAlign: 'center' }}>{item.qty}</Text>
                                    <TouchableOpacity onPress={() => updateBundleItemQty(item.id, 1)}>
                                        <MaterialCommunityIcons name="plus-circle-outline" size={20} color="#666" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => toggleBundleItem(item)} style={{ marginLeft: 5 }}>
                                        <MaterialCommunityIcons name="delete" size={20} color="#e74c3c" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                        <TouchableOpacity
                            style={{ backgroundColor: '#1a1a1a', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: '#d4af37' }}
                            onPress={() => setShowBundlePicker(true)}
                        >
                            <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>+ AGREGAR PRODUCTO AL KIT</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            <Text style={styles.label}>Descripción / Notas</Text>
            <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) => handleChange('description', text)}
                multiline
                numberOfLines={3}
                placeholder="Detalles del producto..."
            />

            <Text style={styles.label}>Comentarios de Fallas (Opcional)</Text>
            <TextInput
                style={[styles.input, styles.textArea, styles.defectInput]}
                value={formData.defect_notes}
                onChangeText={(text) => handleChange('defect_notes', text)}
                multiline
                numberOfLines={2}
                placeholder="Si vino fallado, explicar aquí..."
            />

            <TouchableOpacity
                style={styles.saveButton}
                onPress={saveProduct}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="white" />
                ) : (
                    <Text style={styles.saveButtonText}>{productToEdit ? 'Actualizar Producto' : 'Guardar Producto'}</Text>
                )}
            </TouchableOpacity>


            <Modal visible={isScanning} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'black' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
                        }}
                        onBarcodeScanned={scanned ? undefined : async ({ data }) => {
                            if (scanningMode === 'bundle') {
                                setScanned(true); // Temporarily pause

                                // 1. Search in local inventory (robust match)
                                let found = allProducts.find(p =>
                                    p.barcode && p.barcode.toString().trim() === data.trim()
                                );

                                // 1.5 Fallback: If not found in memory, try a quick DB search 
                                // (just in case the local list is stale or was limited)
                                if (!found) {
                                    const { data: dbProd } = await supabase
                                        .from('products')
                                        .select('id, name, sale_price, barcode, image_url')
                                        .eq('barcode', data.trim())
                                        .eq('active', true)
                                        .single();
                                    if (dbProd) found = dbProd;
                                }

                                if (found) {
                                    setBundleItems(prev => {
                                        const exists = prev.find(i => i.id === found.id);
                                        if (exists) return prev.map(i => i.id === found.id ? { ...i, qty: i.qty + 1 } : i);
                                        return [...prev, { id: found.id, name: found.name, qty: 1 }];
                                    });
                                    setLastScannedInfo({ name: found.name, image: found.image_url, source: 'Inventario' });
                                    setTimeout(() => { setScanned(false); setLastScannedInfo(null); }, 1500);
                                } else {
                                    // 2. Not in inventory - Try external lookup for recognition
                                    setLastScannedInfo({ name: 'Buscando...', source: 'Nube' });
                                    try {
                                        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
                                        const result = await response.json();
                                        if (result.status === 1) {
                                            const pName = result.product.product_name || result.product.product_name_es || 'Desconocido';
                                            setLastScannedInfo({
                                                name: pName,
                                                image: result.product.image_url,
                                                source: 'Nuevo (No en Inventario)',
                                                barcode: data
                                            });
                                            // No auto-dismiss here so user can click "Quick Add"
                                        } else {
                                            setLastScannedInfo({ name: 'Código no registrado', source: 'Error' });
                                            setTimeout(() => { setScanned(false); setLastScannedInfo(null); }, 2000);
                                        }
                                    } catch (e) {
                                        setLastScannedInfo({ name: 'Error de red', source: 'Error' });
                                        setTimeout(() => { setScanned(false); setLastScannedInfo(null); }, 2000);
                                    }
                                }
                                return;
                            }

                            setScanned(true);
                            handleChange('barcode', data);
                            setIsScanning(false);

                            // Auto-fetch details
                            setLoading(true);
                            try {
                                const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
                                const result = await response.json();

                                if (result.status === 1) {
                                    const product = result.product;
                                    const newName = product.product_name || product.product_name_es || '';
                                    const newDesc = product.generic_name || product.brands || '';
                                    const newImage = product.image_url || null;

                                    if (newName) {
                                        setFormData(prev => ({
                                            ...prev,
                                            name: prev.name ? prev.name : newName, // Only fill if empty? Or overwrite? User asked to "put the title", implying fill.
                                            description: prev.description ? prev.description : newDesc
                                        }));
                                        if (newImage && !image) {
                                            setImage(newImage);
                                        }
                                        Alert.alert('Producto Encontrado', `Se completaron los datos de: ${newName}`);
                                    } else {
                                        Alert.alert('Escaneado', `Código: ${data} (Sin nombre registrado)`);
                                    }
                                } else {
                                    Alert.alert('Escaneado', `Código: ${data} (No encontrado en base de datos pública)`);
                                }
                            } catch (error) {
                                console.log('Error fetching product details:', error);
                                Alert.alert('Escaneado', `Código: ${data}`);
                            } finally {
                                setLoading(false);
                            }
                        }}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}
                        onPress={() => setIsScanning(false)}
                    >
                        <MaterialCommunityIcons name="close" size={30} color="white" />
                    </TouchableOpacity>
                    <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center', alignItems: 'center', width: '100%' }}>
                        {lastScannedInfo ? (
                            <View style={{ backgroundColor: 'rgba(0,0,0,0.8)', padding: 15, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#d4af37', width: '80%' }}>
                                {lastScannedInfo.image && (
                                    <Image source={{ uri: lastScannedInfo.image }} style={{ width: 60, height: 60, borderRadius: 10, marginBottom: 10 }} />
                                )}
                                <Text style={{ color: '#d4af37', fontWeight: '900', textAlign: 'center' }}>{lastScannedInfo.name}</Text>

                                {lastScannedInfo.source === 'Nuevo (No en Inventario)' ? (
                                    <View style={{ marginTop: 15, width: '100%', gap: 10 }}>
                                        <TouchableOpacity
                                            style={{ backgroundColor: '#d4af37', padding: 12, borderRadius: 12, alignItems: 'center' }}
                                            onPress={() => handleQuickAddProduct(lastScannedInfo)}
                                        >
                                            <Text style={{ color: '#000', fontWeight: '900', fontSize: 13 }}>CREAR Y AÑADIR AL KIT</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={{ backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 12, alignItems: 'center' }}
                                            onPress={() => {
                                                setScanned(false);
                                                setLastScannedInfo(null);
                                            }}
                                        >
                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>DESCARTAR / VOLVER A ESCANEAR</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    <View style={{ alignItems: 'center', marginTop: 5 }}>
                                        <Text style={{ color: '#fff', fontSize: 10, letterSpacing: 1 }}>{lastScannedInfo.source.toUpperCase()}</Text>
                                        <ActivityIndicator size="small" color="#d4af37" style={{ marginTop: 5 }} />
                                    </View>
                                )}
                            </View>
                        ) : (
                            <View style={{ alignItems: 'center' }}>
                                <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>
                                    {scanningMode === 'bundle' ? `Escaneando Kit (${bundleItems.length} items)` : 'Apunta al código de barras'}
                                </Text>
                                {scanningMode === 'bundle' && (
                                    <TouchableOpacity
                                        style={{ marginTop: 20, backgroundColor: '#d4af37', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 }}
                                        onPress={() => setIsScanning(false)}
                                    >
                                        <Text style={{ color: '#000', fontWeight: 'bold' }}>TERMINAR Y VOLVER</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* CRM SMART MATCH MODAL */}
            <Modal visible={showMatchModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.crmModalContent}>
                        <View style={styles.crmModalHeader}>
                            <MaterialCommunityIcons name="robot-happy" size={30} color="#d4af37" />
                            <Text style={styles.crmModalTitle}>MATCH INTELIGENTE</Text>
                        </View>
                        <Text style={styles.crmModalSubtitle}>
                            La IA encontró {potentialClients.length} clientes potenciales interesados en este producto.
                        </Text>

                        <FlatList
                            data={potentialClients}
                            keyExtractor={(item, index) => item.id ? item.id.toString() : index.toString()}
                            style={{ maxHeight: 300 }}
                            renderItem={({ item }) => (
                                <View style={styles.clientMatchCard}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.clientMatchName}>{item.name}</Text>
                                        <Text style={styles.clientMatchReason}>{item.match_reason || 'Interés detectado por historial'}</Text>
                                        <Text style={styles.clientMatchDetail}>
                                            {item.last_purchase ? `Ültima compra: ${new Date(item.last_purchase).toLocaleDateString()}` : 'Cliente nuevo / prospecto'}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => {
                                            const msg = `Hola ${item.name}! 👋 Te aviso que acaba de ingresar: *${formData.name}* a $${formData.sale_price}. Creí que te podría interesar! 😉`;
                                            Linking.openURL(`https://wa.me/${item.phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`);
                                        }}
                                        style={{ padding: 10 }}
                                    >
                                        <MaterialCommunityIcons name="whatsapp" size={30} color="#25D366" />
                                    </TouchableOpacity>
                                </View>
                            )}
                        />

                        <TouchableOpacity
                            style={styles.crmCloseBtn}
                            onPress={() => {
                                setShowMatchModal(false);
                                navigation.navigate('Main', { screen: 'Inventario', params: { refresh: Date.now() } });
                            }}
                        >
                            <Text style={styles.crmCloseBtnText}>LISTO, CONTINUAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* BUNDLE ITEM PICKER MODAL */}
            <Modal visible={showBundlePicker} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { padding: 0 }]}>
                    <View style={[styles.modalContent, { height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 'auto', backgroundColor: '#111' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>SELECCIONAR PRODUCTOS</Text>
                            <TouchableOpacity onPress={() => setShowBundlePicker(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TextInput
                                style={[styles.input, { flex: 1 }]}
                                placeholder="Buscar producto..."
                                placeholderTextColor="#444"
                                value={searchProd}
                                onChangeText={setSearchProd}
                            />
                            <TouchableOpacity
                                style={{ width: 50, height: 50, backgroundColor: '#0a0a0a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' }}
                                onPress={() => {
                                    setScanningMode('bundle');
                                    setScanned(false);
                                    setIsScanning(true);
                                }}
                            >
                                <MaterialCommunityIcons name="barcode-scan" size={24} color="#d4af37" />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={allProducts.filter(p => !searchProd || p.name.toLowerCase().includes(searchProd.toLowerCase()))}
                            keyExtractor={item => item.id}
                            style={{ marginTop: 20 }}
                            renderItem={({ item }) => {
                                const isSelected = bundleItems.find(bi => bi.id === item.id);
                                return (
                                    <TouchableOpacity
                                        style={{ flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: isSelected ? '#d4af3710' : '#0a0a0a', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: isSelected ? '#d4af37' : '#1a1a1a' }}
                                        onPress={() => toggleBundleItem(item)}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={{ color: isSelected ? '#d4af37' : '#fff', fontWeight: 'bold' }}>{item.name}</Text>
                                            <Text style={{ color: '#555', fontSize: 12 }}>${item.sale_price}</Text>
                                        </View>
                                        {isSelected && <MaterialCommunityIcons name="check-circle" size={24} color="#d4af37" />}
                                    </TouchableOpacity>
                                );
                            }}
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, { marginTop: 20, marginBottom: 10 }]}
                            onPress={() => setShowBundlePicker(false)}
                        >
                            <Text style={styles.saveButtonText}>LISTO</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* SUPPLIER PICKER MODAL */}
            <Modal visible={showSupplierModal} animationType="slide" transparent>
                <View style={[styles.modalOverlay, { padding: 0 }]}>
                    <View style={[styles.modalContent, { height: '80%', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: 'auto', backgroundColor: '#111' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.modalTitle}>MIS PROVEEDORES</Text>
                            <TouchableOpacity onPress={() => setShowSupplierModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            placeholder="Buscar proveedor..."
                            placeholderTextColor="#444"
                            value={supplierSearch}
                            onChangeText={setSupplierSearch}
                        />

                        <FlatList
                            data={suppliersList.filter(s => !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()))}
                            keyExtractor={item => item.id}
                            style={{ marginTop: 20 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={{ flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#0a0a0a', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#1a1a1a' }}
                                    onPress={() => handleSupplierSelect(item)}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.name}</Text>
                                        <Text style={{ color: '#555', fontSize: 12 }}>{item.category || 'Sin Categoría'}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={24} color="#333" />
                                </TouchableOpacity>
                            )}
                            ListFooterComponent={
                                <View>
                                    {supplierSearch.length > 0 && !suppliersList.find(s => s.name.toLowerCase() === supplierSearch.toLowerCase()) && (
                                        <TouchableOpacity
                                            style={{ flexDirection: 'row', alignItems: 'center', padding: 15, backgroundColor: '#d4af3710', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#d4af37' }}
                                            onPress={handleCreateSupplier}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>+ CREAR: "{supplierSearch}"</Text>
                                                <Text style={{ color: '#555', fontSize: 12 }}>Agregar proveedor al catálogo</Text>
                                            </View>
                                            <MaterialCommunityIcons name="plus-circle" size={24} color="#d4af37" />
                                        </TouchableOpacity>
                                    )}
                                    <TouchableOpacity
                                        style={{ padding: 15, alignItems: 'center' }}
                                        onPress={() => { setShowSupplierModal(false); navigation.navigate('Suppliers'); }}
                                    >
                                        <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>+ GESTIONAR PROVEEDORES</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        />

                        <TouchableOpacity
                            style={[styles.saveButton, { marginTop: 20, marginBottom: 10 }]}
                            onPress={() => setShowSupplierModal(false)}
                        >
                            <Text style={styles.saveButtonText}>CANCELAR</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

        </ScrollView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000', padding: 20 },
    label: { fontSize: 13, fontWeight: '900', color: '#d4af37', marginBottom: 8, marginTop: 20, letterSpacing: 1, textTransform: 'uppercase' },
    input: {
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        fontSize: 16,
        color: '#fff'
    },
    readOnly: {
        backgroundColor: '#0a0a0a',
        borderColor: '#d4af37',
        color: '#d4af37',
        fontWeight: '900',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    halfInput: { width: '48%' },
    textArea: { height: 80, textAlignVertical: 'top' },
    defectInput: { borderColor: '#e74c3c', backgroundColor: '#100' },
    saveButton: {
        backgroundColor: '#d4af37',
        padding: 18,
        borderRadius: 15,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 50,
        shadowColor: '#d4af37',
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 4 },
        elevation: 10,
    },
    saveButtonText: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 },

    // Image Picker Styles
    imagePicker: {
        alignSelf: 'center',
        width: 140,
        height: 140,
        backgroundColor: '#0a0a0a',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#1a1a1a'
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center'
    },
    imagePlaceholderText: {
        color: '#666',
        fontWeight: 'bold'
    },
    deleteButton: {
        backgroundColor: '#e74c3c', // Red
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 80, // Extra space at bottom
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    deleteButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 10,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center',
        padding: 20
    },
    modalContent: {
        backgroundColor: '#1e1e1e',
        padding: 25,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 10
    },
    modalTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#d4af37',
        marginBottom: 5,
        textAlign: 'center',
        letterSpacing: 1
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#888',
        marginBottom: 20,
        textAlign: 'center'
    },
    modalLabel: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
        marginBottom: 5
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 25
    },
    cancelButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#444'
    },
    cancelButtonText: { color: '#ccc', fontWeight: 'bold' },
    applyButton: {
        backgroundColor: '#d4af37',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        flex: 1,
        alignItems: 'center',
        marginLeft: 10
    },
    applyButtonText: { color: '#000', fontWeight: 'bold' },
    switchContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: '#fff',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bdc3c7'
    },
    // CRM Modal styles
    crmModalContent: {
        backgroundColor: '#1a1a1a',
        padding: 25,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#d4af37',
    },
    crmModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        marginBottom: 10
    },
    crmModalTitle: {
        color: '#d4af37',
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center'
    },
    crmModalSubtitle: {
        color: '#aaa',
        fontSize: 14,
        textAlign: 'center',
        marginBottom: 20
    },
    clientMatchCard: {
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10
    },
    clientMatchName: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold'
    },
    clientMatchReason: {
        color: '#d4af37',
        fontSize: 12,
        fontWeight: 'bold',
        marginTop: 2
    },
    clientMatchDetail: {
        color: '#666',
        fontSize: 11,
        marginTop: 2
    },
    crmCloseBtn: {
        backgroundColor: '#d4af37',
        padding: 15,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 15
    },
    crmCloseBtnText: {
        color: '#000',
        fontWeight: 'bold',
        letterSpacing: 1
    },
    // PPP Styles
    pppBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d4af3720',
        paddingVertical: 5,
        paddingHorizontal: 8,
        borderRadius: 6,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#d4af3740'
    },
    pppBadgeText: {
        color: '#d4af37',
        fontSize: 9,
        fontWeight: '900',
        marginLeft: 5,
    },
    pppItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#222'
    },
    pppItemSelected: {
        borderColor: '#d4af37',
        backgroundColor: '#d4af3710'
    },
    pppItemCurrent: {
        backgroundColor: '#222',
        padding: 12,
        borderRadius: 10,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: '#333',
        borderStyle: 'dashed'
    },
    pppResultText: {
        textAlign: 'center',
        color: '#888',
        fontSize: 15,
        fontWeight: 'bold',
        marginTop: 20,
        paddingTop: 15,
        borderTopWidth: 1,
        borderTopColor: '#333'
    },
    // Wizard Header Styles
    wizardHeader: {
        padding: 20,
        marginBottom: 10,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    wizardContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 5
    },
    wizardText: {
        color: '#000',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5
    },
    wizardSub: {
        color: 'rgba(0,0,0,0.6)',
        fontSize: 12,
        fontWeight: '600'
    }
});
