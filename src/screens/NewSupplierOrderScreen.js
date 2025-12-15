
import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

export default function NewSupplierOrderScreen({ navigation }) {
    const [provider, setProvider] = useState('');
    const [tracking, setTracking] = useState('');
    const [itemsDesc, setItemsDesc] = useState('');
    const [cost, setCost] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!provider) {
            Alert.alert('Error', 'El nombre del proveedor (Temu, Shein...) es obligatorio.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.from('supplier_orders').insert({
                provider_name: provider,
                tracking_number: tracking || null,
                items_description: itemsDesc,
                total_cost: parseFloat(cost) || 0,
                status: 'pending' // default
            });

            if (error) throw error;

            Alert.alert('✅ Compra Registrada', 'Se ha guardado tu pedido de stock.', [
                { text: 'OK', onPress: () => navigation.goBack() }
            ]);
        } catch (err) {
            Alert.alert('Error', 'No se pudo guardar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.title}>REGISTRAR COMPRA (STOCK)</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView contentContainerStyle={styles.form}>
                <Text style={styles.label}>Proveedor / Tienda</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej: Temu, Shein, Amazon..."
                    placeholderTextColor="#666"
                    value={provider}
                    onChangeText={setProvider}
                />

                <Text style={styles.label}>Número de Seguimiento (Tracking)</Text>
                <View style={styles.trackingRow}>
                    <MaterialCommunityIcons name="barcode-scan" size={24} color="#666" style={{ marginRight: 10 }} />
                    <TextInput
                        style={[styles.input, { flex: 1, marginBottom: 0 }]}
                        placeholder="Pegar código de rastreo"
                        placeholderTextColor="#666"
                        value={tracking}
                        onChangeText={setTracking}
                    />
                </View>

                <Text style={styles.label}>Descripción de Items</Text>
                <TextInput
                    style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                    placeholder="Ej: 50 fundas, 20 vidrios templados..."
                    placeholderTextColor="#666"
                    multiline
                    value={itemsDesc}
                    onChangeText={setItemsDesc}
                />

                <Text style={styles.label}>Costo Total (USD/ARS)</Text>
                <TextInput
                    style={styles.input}
                    placeholder="0.00"
                    placeholderTextColor="#666"
                    keyboardType="numeric"
                    value={cost}
                    onChangeText={setCost}
                />

                <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.saveText}>GUARDAR PEDIDO</Text>}
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 20, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },
    form: { padding: 20 },

    label: { color: '#d4af37', marginBottom: 10, fontWeight: 'bold', marginTop: 10 },
    input: { backgroundColor: '#1e1e1e', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 20, borderWidth: 1, borderColor: '#333' },

    trackingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', padding: 5, paddingLeft: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333', marginBottom: 20 },

    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 10, alignItems: 'center', marginTop: 20 },
    saveText: { color: '#000', fontWeight: '900', fontSize: 16 }
});
