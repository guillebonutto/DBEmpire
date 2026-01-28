import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, TextInput, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ShippingRatesScreen({ navigation }) {
    const [rates, setRates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingRate, setEditingRate] = useState(null);

    // Form states
    const [courier, setCourier] = useState('Andreani');
    const [destination, setDestination] = useState('Córdoba');
    const [baseRate, setBaseRate] = useState('');
    const [perKgRate, setPerKgRate] = useState('0');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        checkRole();
        fetchRates();
    }, []);

    const checkRole = async () => {
        const role = await AsyncStorage.getItem('user_role');
        if (role !== 'admin') {
            Alert.alert('Acceso Denegado', 'Solo administradores pueden configurar tarifas.');
            navigation.goBack();
        }
    };

    const fetchRates = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('shipping_rates')
                .select('*')
                .eq('active', true)
                .order('courier', { ascending: true })
                .order('destination', { ascending: true });

            if (error) throw error;
            setRates(data || []);
        } catch (err) {
            console.error('Error fetching rates:', err);
            Alert.alert('Error', 'No se pudieron cargar las tarifas');
        } finally {
            setLoading(false);
        }
    };

    const openCreateModal = () => {
        setEditingRate(null);
        setCourier('Andreani');
        setDestination('Córdoba');
        setBaseRate('');
        setPerKgRate('0');
        setNotes('');
        setShowModal(true);
    };

    const openEditModal = (rate) => {
        setEditingRate(rate);
        setCourier(rate.courier);
        setDestination(rate.destination);
        setBaseRate(rate.base_rate.toString());
        setPerKgRate(rate.per_kg_rate?.toString() || '0');
        setNotes(rate.notes || '');
        setShowModal(true);
    };

    const handleSave = async () => {
        if (!courier || !destination || !baseRate) {
            Alert.alert('Error', 'Completa todos los campos obligatorios');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                courier,
                destination,
                base_rate: parseFloat(baseRate),
                per_kg_rate: parseFloat(perKgRate) || 0,
                notes: notes || null,
                updated_at: new Date().toISOString()
            };

            if (editingRate) {
                // Update existing rate
                const { error } = await supabase
                    .from('shipping_rates')
                    .update(payload)
                    .eq('id', editingRate.id);

                if (error) throw error;
                Alert.alert('✅ Actualizado', 'Tarifa actualizada correctamente');
            } else {
                // Create new rate
                const { error } = await supabase
                    .from('shipping_rates')
                    .insert(payload);

                if (error) {
                    if (error.code === '23505') { // Unique constraint violation
                        Alert.alert('Error', 'Ya existe una tarifa para esta combinación de courier y destino');
                    } else {
                        throw error;
                    }
                    return;
                }
                Alert.alert('✅ Creado', 'Tarifa creada correctamente');
            }

            setShowModal(false);
            fetchRates();
        } catch (err) {
            console.error('Error saving rate:', err);
            Alert.alert('Error', 'No se pudo guardar la tarifa: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (rate) => {
        Alert.alert(
            'Confirmar Eliminación',
            `¿Eliminar tarifa de ${rate.courier} a ${rate.destination}?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('shipping_rates')
                                .update({ active: false })
                                .eq('id', rate.id);

                            if (error) throw error;
                            fetchRates();
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo eliminar la tarifa');
                        }
                    }
                }
            ]
        );
    };

    const renderRateItem = ({ item }) => {
        const courierColors = {
            'Andreani': '#3498db',
            'OCA': '#e74c3c',
            'Via Cargo': '#2ecc71'
        };

        return (
            <TouchableOpacity
                style={styles.rateCard}
                onPress={() => openEditModal(item)}
            >
                <View style={styles.rateHeader}>
                    <View style={[styles.courierBadge, { backgroundColor: courierColors[item.courier] || '#666' }]}>
                        <MaterialCommunityIcons name="truck-delivery" size={16} color="#fff" />
                        <Text style={styles.courierText}>{item.courier}</Text>
                    </View>
                    <TouchableOpacity onPress={() => handleDelete(item)}>
                        <MaterialCommunityIcons name="delete" size={20} color="#e74c3c" />
                    </TouchableOpacity>
                </View>

                <View style={styles.rateBody}>
                    <View style={styles.destinationRow}>
                        <MaterialCommunityIcons name="map-marker" size={18} color="#d4af37" />
                        <Text style={styles.destinationText}>{item.destination}</Text>
                    </View>

                    <View style={styles.priceRow}>
                        <View style={styles.priceItem}>
                            <Text style={styles.priceLabel}>Tarifa Base</Text>
                            <Text style={styles.priceValue}>${parseFloat(item.base_rate).toLocaleString('es-AR')}</Text>
                        </View>
                        {item.per_kg_rate > 0 && (
                            <View style={styles.priceItem}>
                                <Text style={styles.priceLabel}>Por Kg</Text>
                                <Text style={styles.priceValue}>${parseFloat(item.per_kg_rate).toFixed(2)}</Text>
                            </View>
                        )}
                    </View>

                    {item.notes && (
                        <Text style={styles.notesText}>{item.notes}</Text>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>TARIFAS DE TRANSPORTE</Text>
                <TouchableOpacity onPress={openCreateModal}>
                    <MaterialCommunityIcons name="plus-circle" size={28} color="#d4af37" />
                </TouchableOpacity>
            </LinearGradient>

            {loading && rates.length === 0 ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#d4af37" />
                </View>
            ) : (
                <FlatList
                    data={rates}
                    renderItem={renderRateItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="truck-delivery-outline" size={64} color="#333" />
                            <Text style={styles.emptyText}>No hay tarifas configuradas</Text>
                            <Text style={styles.emptySubtext}>Agrega tarifas para cada courier y destino</Text>
                        </View>
                    }
                />
            )}

            {/* Create/Edit Modal */}
            <Modal visible={showModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                {editingRate ? 'Editar Tarifa' : 'Nueva Tarifa'}
                            </Text>
                            <TouchableOpacity onPress={() => setShowModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.modalScroll}>
                            <Text style={styles.label}>Empresa de Transporte *</Text>
                            <View style={styles.courierButtons}>
                                {['Andreani', 'OCA', 'Via Cargo'].map(c => (
                                    <TouchableOpacity
                                        key={c}
                                        style={[styles.courierBtn, courier === c && styles.courierBtnActive]}
                                        onPress={() => setCourier(c)}
                                    >
                                        <Text style={[styles.courierBtnText, courier === c && styles.courierBtnTextActive]}>
                                            {c}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Destino *</Text>
                            <View style={styles.destinationButtons}>
                                {['Córdoba', 'Buenos Aires', 'Rosario', 'Mendoza'].map(dest => (
                                    <TouchableOpacity
                                        key={dest}
                                        style={[styles.destBtn, destination === dest && styles.destBtnActive]}
                                        onPress={() => setDestination(dest)}
                                    >
                                        <Text style={[styles.destBtnText, destination === dest && styles.destBtnTextActive]}>
                                            {dest}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.label}>Tarifa Base *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={baseRate}
                                onChangeText={setBaseRate}
                            />

                            <Text style={styles.label}>Costo por Kg (Opcional)</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="0.00"
                                placeholderTextColor="#666"
                                keyboardType="numeric"
                                value={perKgRate}
                                onChangeText={setPerKgRate}
                            />

                            <Text style={styles.label}>Notas</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Ej: Tarifa estándar paquete mediano"
                                placeholderTextColor="#666"
                                multiline
                                value={notes}
                                onChangeText={setNotes}
                            />

                            <TouchableOpacity
                                style={styles.saveBtn}
                                onPress={handleSave}
                                disabled={loading}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#000" />
                                ) : (
                                    <Text style={styles.saveBtnText}>
                                        {editingRate ? 'ACTUALIZAR TARIFA' : 'CREAR TARIFA'}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    listContent: { padding: 20 },

    rateCard: { backgroundColor: '#1e1e1e', borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333', overflow: 'hidden' },
    rateHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#111', borderBottomWidth: 1, borderBottomColor: '#333' },
    courierBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
    courierText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },

    rateBody: { padding: 15 },
    destinationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
    destinationText: { color: '#d4af37', fontSize: 16, fontWeight: 'bold' },

    priceRow: { flexDirection: 'row', gap: 15, marginBottom: 10 },
    priceItem: { flex: 1 },
    priceLabel: { color: '#666', fontSize: 11, marginBottom: 4 },
    priceValue: { color: '#fff', fontSize: 18, fontWeight: 'bold' },

    notesText: { color: '#888', fontSize: 12, fontStyle: 'italic', marginTop: 8 },

    emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    emptyText: { color: '#666', fontSize: 16, fontWeight: 'bold', marginTop: 15 },
    emptySubtext: { color: '#444', fontSize: 13, marginTop: 5, textAlign: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#1e1e1e', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    modalTitle: { color: '#d4af37', fontSize: 18, fontWeight: 'bold' },
    modalScroll: { padding: 20 },

    label: { color: '#d4af37', fontSize: 13, fontWeight: 'bold', marginBottom: 8, marginTop: 12 },
    input: { backgroundColor: '#111', color: '#fff', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },

    courierButtons: { flexDirection: 'row', gap: 10, marginBottom: 15 },
    courierBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#333', alignItems: 'center' },
    courierBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    courierBtnText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    courierBtnTextActive: { color: '#000' },

    destinationButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 15 },
    destBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
    destBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    destBtnText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    destBtnTextActive: { color: '#000' },

    saveBtn: { backgroundColor: '#d4af37', padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 10, marginBottom: 30 },
    saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 14 }
});
