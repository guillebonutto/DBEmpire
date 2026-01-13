import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Switch, Modal } from 'react-native';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CRMService } from '../services/crmService';
import { GeminiService } from '../services/geminiService';
import { Linking } from 'react-native';

export default function AddProductScreen({ navigation, route }) {
    const productToEdit = route.params?.product;

    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState(route.params?.scannedImage || null);

    // Scanner State
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    // Overhead State
    const [overheadInternet, setOverheadInternet] = useState('');
    const [overheadElectricity, setOverheadElectricity] = useState('');
    const [showOverheadCalc, setShowOverheadCalc] = useState(false);
    const [calcInternet, setCalcInternet] = useState('');
    const [calcElectricity, setCalcElectricity] = useState('');
    const [calcBatch, setCalcBatch] = useState('');

    // CRM Match State
    const [potentialClients, setPotentialClients] = useState([]);
    const [showMatchModal, setShowMatchModal] = useState(false);
    const [generatingMsg, setGeneratingMsg] = useState(null);

    const [formData, setFormData] = useState({
        name: route.params?.scannedName || '',
        description: route.params?.scannedDescription || '',
        provider: '',
        cost_price: '',
        profit_margin_percent: '',
        sale_price: '',
        current_stock: '',
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

    // Load data if editing
    useEffect(() => {
        if (productToEdit) {
            setFormData({
                name: productToEdit.name,
                description: productToEdit.description || '',
                provider: productToEdit.provider || '',
                cost_price: productToEdit.cost_price?.toString() || '',
                profit_margin_percent: productToEdit.profit_margin_percent?.toString() || '',
                sale_price: productToEdit.sale_price?.toString() || '',
                current_stock: productToEdit.current_stock?.toString() || '',
                current_stock: productToEdit.current_stock?.toString() || '',
                defect_notes: productToEdit.defect_notes || '',
                barcode: productToEdit.barcode || ''
            });
            setOverheadInternet(productToEdit.internet_cost?.toString() || '');
            setOverheadElectricity(productToEdit.electricity_cost?.toString() || '');
            if (productToEdit.image_url) {
                setImage(productToEdit.image_url);
            }
        }
    }, [productToEdit]);

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
                    // If we were editing and had an old image, decide whether to keep it or null. 
                    // If image is local uri and upload fail, we probably shouldn't save the local uri to DB.
                    // For now, let's just keep the old one if exists or null.
                    finalImageUrl = productToEdit?.image_url || null;
                }
            }

            const productPayload = {
                name: formData.name,
                description: formData.description,
                provider: formData.provider,
                cost_price: parseFloat(formData.cost_price) || 0,
                profit_margin_percent: parseFloat(formData.profit_margin_percent) || 0,
                sale_price: parseFloat(formData.sale_price) || 0,
                current_stock: parseInt(formData.current_stock) || 0,
                internet_cost: parseFloat(overheadInternet) || 0,
                electricity_cost: parseFloat(overheadElectricity) || 0,
                defect_notes: formData.defect_notes,
                image_url: finalImageUrl,
                barcode: formData.barcode // Add barcode
            };

            let productId = productToEdit?.id;
            let error;
            if (productToEdit) {
                // Update
                const { error: updateError } = await supabase
                    .from('products')
                    .update(productPayload)
                    .eq('id', productToEdit.id);
                error = updateError;
            } else {
                // Insert
                const { data: newProd, error: insertError } = await supabase
                    .from('products')
                    .insert([productPayload])
                    .select()
                    .single();
                error = insertError;
                if (newProd) productId = newProd.id;
            }

            if (error) throw error;

            // --- AUTO EXPENSE & ORDER GENERATION ---
            try {
                const newStock = parseInt(formData.current_stock) || 0;
                const costPrice = parseFloat(formData.cost_price) || 0;
                let stockDifference = 0;

                if (productToEdit) {
                    // Updating existing product: Calculate difference
                    const oldStock = parseInt(productToEdit.current_stock) || 0;
                    if (newStock > oldStock) {
                        stockDifference = newStock - oldStock;
                    }
                } else {
                    // New Product: Entire stock is new
                    stockDifference = newStock;
                }

                if (stockDifference > 0 && costPrice > 0) {
                    const expenseAmount = stockDifference * costPrice;

                    // 1. Create Expense
                    const { error: expenseError } = await supabase.from('expenses').insert({
                        description: `Inventario: ${formData.name} (x${stockDifference})`,
                        amount: expenseAmount,
                        category: 'Inventario',
                        created_at: new Date().toISOString()
                    });
                    if (expenseError) throw expenseError;

                    // 2. Create Supplier Order (Auto-generated)
                    const { data: orderData, error: orderError } = await supabase
                        .from('supplier_orders')
                        .insert({
                            provider_name: formData.provider || 'Sin Proveedor',
                            items_description: `Ingreso Manual: ${formData.name}`,
                            total_cost: expenseAmount,
                            status: 'received', // Already in stock
                            installments_total: 1,
                            installments_paid: 0,
                            created_at: new Date().toISOString()
                        })
                        .select()
                        .single();

                    if (orderError) {
                        console.log('Error creating auto-order:', orderError);
                    } else if (orderData && productId) {
                        // 3. Link Item
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
                Alert.alert('Nota', 'Producto guardado, pero falló el registro automático del gasto.');
            }
            // -------------------------------

            Alert.alert('Éxito', 'Producto guardado correctamente');

            // --- CRM SMART MATCH ---
            const interested = await CRMService.findInterestedClients({
                id: productToEdit?.id,
                name: formData.name
            });

            if (interested.length > 0) {
                setPotentialClients(interested);
                setShowMatchModal(true);
            } else {
                navigation.navigate('Main', { screen: 'Inventario', params: { refresh: Date.now() } });
            }
            // ------------------------
        } catch (err) {
            console.log('Error saving product:', err);
            // Fallback for development (If no Supabase keys)
            Alert.alert('Error', 'Hubo un error al guardar. Revisa la consola/conexión.');
            // navigation.goBack(); // Don't go back on error
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

    return (
        <ScrollView style={styles.container}>
            {/* ... existing fields ... */}
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
                    <Text style={styles.label}>Stock Actual</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.current_stock}
                        onChangeText={(text) => handleChange('current_stock', text)}
                        keyboardType="numeric"
                        placeholder="0"
                    />
                </View>
                <View style={styles.halfInput}>
                    <Text style={styles.label}>Proveedor</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.provider}
                        onChangeText={(text) => handleChange('provider', text)}
                        placeholder="Ej. Distribuidora X"
                    />
                </View>
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
                        onBarcodeScanned={scanned ? undefined : async ({ data }) => {
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
                    <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center' }}>
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Apunta al código de barras</Text>
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
    }
});
