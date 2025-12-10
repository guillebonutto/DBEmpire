import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image } from 'react-native';
import { supabase } from '../services/supabase';
import * as ImagePicker from 'expo-image-picker';

export default function AddProductScreen({ navigation, route }) {
    const productToEdit = route.params?.product;

    const [loading, setLoading] = useState(false);
    const [image, setImage] = useState(null);
    const [transportRate, setTransportRate] = useState(0); // Global transport rate %
    const [calculatedTransportCost, setCalculatedTransportCost] = useState(0);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        provider: '',
        cost_price: '',
        profit_margin_percent: '',
        sale_price: '',
        current_stock: '',
        defect_notes: ''
    });

    // Fetch Transport Rate on Mount
    useEffect(() => {
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('settings')
                .select('value')
                .eq('key', 'transport_rate')
                .single();
            if (data) {
                setTransportRate(parseFloat(data.value) || 0);
            }
        };
        fetchSettings();
    }, []);

    // Calculate Sale Price automatically when Cost or Margin changes
    useEffect(() => {
        if (formData.cost_price && formData.profit_margin_percent) {
            const cost = parseFloat(formData.cost_price);
            const margin = parseFloat(formData.profit_margin_percent);

            if (!isNaN(cost) && !isNaN(margin)) {
                // Formula: 
                // 1. Calculate Transport Cost = Cost * TransportRate
                // 2. Final Cost = Cost + Transport Cost
                // 3. Sale Price = Final Cost * (1 + Margin/100)

                const transportCost = cost * transportRate;
                setCalculatedTransportCost(transportCost);

                const finalCost = cost + transportCost;
                const calculatedPrice = finalCost * (1 + (margin / 100));

                // Update sale price state without triggering infinite loop if handled correctly
                setFormData(prev => ({
                    ...prev,
                    sale_price: calculatedPrice.toFixed(2)
                }));
            }
        }
    }, [formData.cost_price, formData.profit_margin_percent, transportRate]);

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
                defect_notes: productToEdit.defect_notes || ''
            });
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
            aspect: [4, 3],
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
                defect_notes: formData.defect_notes,
                image_url: finalImageUrl
            };

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
                const { error: insertError } = await supabase
                    .from('products')
                    .insert([productPayload]);
                error = insertError;
            }

            if (error) throw error;

            Alert.alert('Éxito', 'Producto guardado correctamente');
            navigation.goBack();
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

            {/* Transport Cost Display */}
            <View style={styles.row}>
                <View style={styles.halfInput}>
                    <Text style={[styles.label, { fontSize: 12, color: '#888' }]}>+ Transp. ({(transportRate * 100).toFixed(0)}%)</Text>
                    <TextInput
                        style={[styles.input, styles.readOnly, { fontSize: 14 }]}
                        value={`$${calculatedTransportCost.toFixed(2)}`}
                        editable={false}
                    />
                </View>
                <View style={styles.halfInput}>
                    <Text style={[styles.label, { fontSize: 12, color: '#888' }]}>= Costo Final</Text>
                    <TextInput
                        style={[styles.input, styles.readOnly, { fontSize: 14 }]}
                        value={`$${(parseFloat(formData.cost_price || 0) + calculatedTransportCost).toFixed(2)}`}
                        editable={false}
                    />
                </View>
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

        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5', padding: 20 },
    label: { fontSize: 16, fontWeight: '600', color: '#34495e', marginBottom: 5, marginTop: 10 },
    input: {
        backgroundColor: 'white',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#bdc3c7',
        fontSize: 16,
    },
    readOnly: {
        backgroundColor: '#e8f6f3',
        borderColor: '#1abc9c',
        color: '#16a085',
        fontWeight: 'bold',
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    halfInput: { width: '48%' },
    textArea: { height: 80, textAlignVertical: 'top' },
    defectInput: { borderColor: '#e74c3c', backgroundColor: '#fff5f5' }, // Red tint for defects
    saveButton: {
        backgroundColor: '#3498db',
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
        marginTop: 30,
        marginBottom: 50,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
    },
    saveButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

    // Image Picker Styles
    imagePicker: {
        alignSelf: 'center',
        width: 120,
        height: 120,
        backgroundColor: '#e1e1e1',
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#ccc'
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
    deleteButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});
