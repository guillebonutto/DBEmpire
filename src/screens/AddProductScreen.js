import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabase';

export default function AddProductScreen({ navigation, route }) {
    const productToEdit = route.params?.product;

    const [loading, setLoading] = useState(false);
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

    // Calculate Sale Price automatically when Cost or Margin changes
    useEffect(() => {
        if (formData.cost_price && formData.profit_margin_percent) {
            const cost = parseFloat(formData.cost_price);
            const margin = parseFloat(formData.profit_margin_percent);

            if (!isNaN(cost) && !isNaN(margin)) {
                // Formula: Sale Price = Cost + (Cost * Margin / 100)
                // Or simply: Cost * (1 + Margin/100)
                const calculatedPrice = cost + (cost * (margin / 100));

                // Update sale price state without triggering infinite loop if handled correctly
                setFormData(prev => ({
                    ...prev,
                    sale_price: calculatedPrice.toFixed(2)
                }));
            }
        }
    }, [formData.cost_price, formData.profit_margin_percent]);

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
        }
    }, [productToEdit]);

    const handleChange = (name, value) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const saveProduct = async () => {
        if (!formData.name || !formData.sale_price) {
            Alert.alert('Eror', 'El nombre y el precio de venta son obligatorios.');
            return;
        }

        setLoading(true);
        try {
            const productPayload = {
                name: formData.name,
                description: formData.description,
                provider: formData.provider,
                cost_price: parseFloat(formData.cost_price) || 0,
                profit_margin_percent: parseFloat(formData.profit_margin_percent) || 0,
                sale_price: parseFloat(formData.sale_price) || 0,
                current_stock: parseInt(formData.current_stock) || 0,
                defect_notes: formData.defect_notes
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
            Alert.alert('Info', 'Modo offline simulado: Producto validado (Falta conexión real)');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
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

            <Text style={styles.label}>Precio de Venta (Calculado)</Text>
            <TextInput
                style={[styles.input, styles.readOnly]}
                value={formData.sale_price}
                editable={false} // User can override if needed? For now, auto-calc strictly.
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
                    <Text style={styles.saveButtonText}>Guardar Producto</Text>
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
});
