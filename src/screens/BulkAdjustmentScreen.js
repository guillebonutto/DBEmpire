import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function BulkAdjustmentScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [percentage, setPercentage] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase.from('products').select('id, name, sale_price').eq('active', true).order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    const applyAdjustment = async () => {
        const pct = parseFloat(percentage);
        if (isNaN(pct)) return Alert.alert('Error', 'Ingresa un porcentaje válido');

        Alert.alert(
            'Confirmar Ajuste',
            `¿Estás seguro de ajustar el precio de ${products.length} productos en un ${pct}%?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'SÍ, APLICAR',
                    onPress: async () => {
                        setUpdating(true);
                        try {
                            for (const product of products) {
                                const newPrice = product.sale_price * (1 + (pct / 100));
                                await supabase
                                    .from('products')
                                    .update({ sale_price: parseFloat(newPrice.toFixed(2)) })
                                    .eq('id', product.id);
                            }
                            Alert.alert('Éxito', 'Precios actualizados masivamente');
                            navigation.goBack();
                        } catch (err) {
                            Alert.alert('Error', 'Hubo un fallo al actualizar');
                        } finally {
                            setUpdating(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.title}>AJUSTE MASIVO</Text>
                <View style={{ width: 28 }} />
            </View>

            <View style={styles.card}>
                <Text style={styles.label}>PORCENTAJE DE AJUSTE (%)</Text>
                <Text style={styles.helper}>Ej: "10" para subir 10%, "-5" para bajar 5%.</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej. 10"
                    placeholderTextColor="#444"
                    keyboardType="numeric"
                    value={percentage}
                    onChangeText={setPercentage}
                />

                <TouchableOpacity
                    style={[styles.applyBtn, updating && { opacity: 0.5 }]}
                    onPress={applyAdjustment}
                    disabled={updating}
                >
                    {updating ? <ActivityIndicator color="#000" /> : <Text style={styles.applyBtnText}>APLICAR A TODO EL INVENTARIO</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.preview}>
                <Text style={styles.previewTitle}>VISTA PREVIA DE CAMBIOS</Text>
                {loading ? <ActivityIndicator color="#d4af37" /> : products.map(p => {
                    const pct = parseFloat(percentage) || 0;
                    const newPrice = p.sale_price * (1 + (pct / 100));
                    return (
                        <View key={p.id} style={styles.previewRow}>
                            <Text style={styles.prodName} numberOfLines={1}>{p.name}</Text>
                            <View style={styles.priceRow}>
                                <Text style={styles.oldPrice}>${p.sale_price}</Text>
                                <MaterialCommunityIcons name="arrow-right" size={12} color="#444" style={{ marginHorizontal: 5 }} />
                                <Text style={styles.newPrice}>${newPrice.toFixed(2)}</Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    title: { fontSize: 18, fontWeight: '900', color: '#d4af37', letterSpacing: 1 },

    card: { backgroundColor: '#0a0a0a', margin: 20, padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#222' },
    label: { color: '#d4af37', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
    helper: { color: '#666', fontSize: 12, marginBottom: 15 },
    input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 10, fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#333', textAlign: 'center' },

    applyBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, marginTop: 20, alignItems: 'center' },
    applyBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

    preview: { flex: 1, paddingHorizontal: 20 },
    previewTitle: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
    previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#111' },
    prodName: { color: '#888', flex: 1, fontSize: 14 },
    priceRow: { flexDirection: 'row', alignItems: 'center' },
    oldPrice: { color: '#444', textDecorationLine: 'line-through', fontSize: 12 },
    newPrice: { color: '#fff', fontWeight: 'bold', fontSize: 14, marginLeft: 5 }
});
