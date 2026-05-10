import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, StatusBar, ActivityIndicator, ScrollView, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSupplierStore } from '../store/useSupplierStore';
import { SyncService } from '../services/syncService';

export default function SuppliersScreen({ navigation }) {
    const { suppliers, fetchSuppliers, loadingSuppliers } = useSupplierStore();
    const [modalVisible, setModalVisible] = useState(false);
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        category: '',
        phone: '',
        email: '',
        notes: ''
    });

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const filteredSuppliers = useMemo(() => {
        if (!searchQuery) return suppliers;
        const low = searchQuery.toLowerCase();
        return (suppliers || []).filter(s =>
            s.name.toLowerCase().includes(low) ||
            (s.category && s.category.toLowerCase().includes(low))
        );
    }, [searchQuery, suppliers]);

    const handleSave = async () => {
        if (!formData.name) return Alert.alert('Error', 'El nombre es obligatorio');

        try {
            if (editingSupplier) {
                const updatedSupplier = { ...editingSupplier, ...formData };
                await SyncService.queueAction('supplier', updatedSupplier, {}, 'UPDATE');
                // Local state will be updated by SyncService (optimistic)
            } else {
                const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                    const r = Math.random() * 16 | 0;
                    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                });
                const newSupplier = {
                    id: generateUUID(),
                    ...formData,
                    active: true,
                    created_at: new Date().toISOString()
                };
                await SyncService.queueAction('supplier', newSupplier, {}, 'INSERT');
            }

            setModalVisible(false);
            setEditingSupplier(null);
            setFormData({ name: '', category: '', phone: '', email: '', notes: '' });
            
            // Re-fetch local to show changes
            useSupplierStore.getState().initStore();

            if (Platform.OS === 'web') alert(`✅ Éxito: ${editingSupplier ? 'Proveedor actualizado' : 'Proveedor agregado'}`);
            else Alert.alert('✅ Éxito', editingSupplier ? 'Proveedor actualizado' : 'Proveedor agregado');
        } catch (error) {
            if (Platform.OS === 'web') alert(`Falla: ${error.message}`);
            else Alert.alert('Falla', error.message);
        }
    };

    const handleDelete = (supplier) => {
        const performDelete = async () => {
            try {
                await SyncService.queueAction('supplier', { id: supplier.id }, {}, 'DELETE');
                useSupplierStore.getState().initStore();
            } catch (err) {
                if (Platform.OS === 'web') alert('Error: No se puede eliminar.');
                else Alert.alert('Error', 'No se puede eliminar.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Estás seguro de que quieres eliminar a "${supplier.name}"?`)) {
                performDelete();
            }
        } else {
            Alert.alert(
                'Eliminar Proveedor',
                `¿Estás seguro de que quieres eliminar a "${supplier.name}"?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: performDelete }
                ]
            );
        }
    };

    const openModal = (supplier = null) => {
        if (supplier) {
            setEditingSupplier(supplier);
            setFormData({
                name: supplier.name,
                category: supplier.category || '',
                phone: supplier.phone || '',
                email: supplier.email || '',
                notes: supplier.notes || ''
            });
        } else {
            setEditingSupplier(null);
            setFormData({ name: '', category: '', phone: '', email: '', notes: '' });
        }
        setModalVisible(true);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerLabel}>GESTIÓN DE ALIADOS</Text>
                    <Text style={styles.title}>PROVEEDORES</Text>
                </View>
                <TouchableOpacity style={styles.addButton} onPress={() => openModal()}>
                    <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.addBtnGradient}>
                        <MaterialCommunityIcons name="plus" size={24} color="#000" />
                    </LinearGradient>
                </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#555" />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar proveedor..."
                        placeholderTextColor="#444"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                </View>
            </View>

            {loadingSuppliers && (!suppliers || suppliers.length === 0) ? (
                <ActivityIndicator size="large" color="#d4af37" style={{ marginTop: 50 }} />
            ) : (
                <FlatList
                    data={filteredSuppliers}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <View style={styles.card}>
                            <TouchableOpacity
                                style={styles.cardHeaderArea}
                                onPress={() => openModal(item)}
                            >
                                <View style={styles.cardMain}>
                                    <View style={styles.iconBox}>
                                        <MaterialCommunityIcons name="factory" size={24} color="#d4af37" />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 15 }}>
                                        <Text style={styles.supplierName}>{item.name}</Text>
                                        <Text style={styles.supplierCategory}>{item.category || 'Sin Categoría'}</Text>
                                    </View>
                                    <View style={styles.trustBadge}>
                                        <MaterialCommunityIcons name="check-decagram" size={14} color="#2ecc71" />
                                        <Text style={styles.trustText}>CALIDAD OK</Text>
                                    </View>
                                </View>
                            </TouchableOpacity>

                            <View style={styles.cardActions}>
                                <TouchableOpacity style={styles.actionBtn} onPress={() => openModal(item)}>
                                    <MaterialCommunityIcons name="pencil" size={18} color="#d4af37" />
                                    <Text style={styles.actionText}>Editar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, styles.deleteBtn]} onPress={() => handleDelete(item)}>
                                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#e74c3c" />
                                    <Text style={[styles.actionText, styles.deleteText]}>Eliminar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingSupplier ? 'EDITAR PROVEEDOR' : 'NUEVO PROVEEDOR'}</Text>
                        
                        <ScrollView>
                            <TextInput
                                style={styles.input}
                                placeholder="Nombre del Proveedor"
                                placeholderTextColor="#666"
                                value={formData.name}
                                onChangeText={(text) => setFormData({...formData, name: text})}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Categoría (Ej: Electrónica)"
                                placeholderTextColor="#666"
                                value={formData.category}
                                onChangeText={(text) => setFormData({...formData, category: text})}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Teléfono"
                                placeholderTextColor="#666"
                                keyboardType="phone-pad"
                                value={formData.phone}
                                onChangeText={(text) => setFormData({...formData, phone: text})}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Email"
                                placeholderTextColor="#666"
                                keyboardType="email-address"
                                value={formData.email}
                                onChangeText={(text) => setFormData({...formData, email: text})}
                            />
                            <TextInput
                                style={[styles.input, { height: 100 }]}
                                placeholder="Notas adicionales..."
                                placeholderTextColor="#666"
                                multiline
                                value={formData.notes}
                                onChangeText={(text) => setFormData({...formData, notes: text})}
                            />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    headerLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
    title: { color: '#d4af37', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
    addButton: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden' },
    addBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    searchContainer: { paddingHorizontal: 20, marginBottom: 10 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 15, height: 45, borderWidth: 1, borderColor: '#222' },
    searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 14 },
    listContent: { padding: 20 },
    card: { backgroundColor: '#111', borderRadius: 20, marginBottom: 15, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
    cardHeaderArea: { padding: 20 },
    cardMain: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 50, height: 50, borderRadius: 15, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
    supplierName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    supplierCategory: { color: '#666', fontSize: 12, marginTop: 2 },
    trustBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46, 204, 113, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    trustText: { color: '#2ecc71', fontSize: 9, fontWeight: 'bold', marginLeft: 4 },
    cardActions: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#222' },
    actionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 8 },
    actionText: { color: '#d4af37', fontSize: 13, fontWeight: 'bold' },
    deleteBtn: { borderLeftWidth: 1, borderLeftColor: '#222' },
    deleteText: { color: '#e74c3c' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#111', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#333', maxHeight: '80%' },
    modalTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: 20 },
    input: { backgroundColor: '#1a1a1a', borderRadius: 12, padding: 15, color: '#fff', marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    modalButtons: { flexDirection: 'row', gap: 15, marginTop: 10 },
    cancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, backgroundColor: '#222', alignItems: 'center' },
    cancelBtnText: { color: '#fff', fontWeight: 'bold' },
    saveBtn: { flex: 1, paddingVertical: 15, borderRadius: 12, backgroundColor: '#d4af37', alignItems: 'center' },
    saveBtnText: { color: '#000', fontWeight: 'bold' }
});
