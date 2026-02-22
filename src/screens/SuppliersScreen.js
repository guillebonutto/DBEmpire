import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, StatusBar, ActivityIndicator, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function SuppliersScreen({ navigation }) {
    const [suppliers, setSuppliers] = useState([]);
    const [filteredSuppliers, setFilteredSuppliers] = useState([]);
    const [loading, setLoading] = useState(false);
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

    const fetchSuppliers = async () => {
        setLoading(true);
        try {
            // 1. Fetch Suppliers
            const { data: suppliersData, error: sError } = await supabase
                .from('suppliers')
                .select('*')
                .order('name', { ascending: true });

            if (sError) throw sError;

            // 2. Fetch all products linked to these suppliers via the supplier name field
            const { data: itemsData, error: iError } = await supabase
                .from('supplier_order_items')
                .select('product_id, products(id, name, image_url, current_stock), supplier')
                .not('product_id', 'is', null)
                .not('supplier', 'is', null);

            if (iError) throw iError;

            // 3. Map products to their suppliers
            const suppliersWithProducts = (suppliersData || []).map(s => {
                const uniqueProducts = [];
                const seenProducts = new Set();

                itemsData?.forEach(item => {
                    if (item.supplier === s.name && item.products && !seenProducts.has(item.product_id)) {
                        seenProducts.add(item.product_id);
                        uniqueProducts.push(item.products);
                    }
                });

                return {
                    ...s,
                    products: uniqueProducts
                };
            });

            setSuppliers(suppliersWithProducts);
            setFilteredSuppliers(suppliersWithProducts);
        } catch (err) {
            console.log('Error fetching suppliers:', err);
            Alert.alert('Error', 'No se pudieron cargar los proveedores.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const low = searchQuery.toLowerCase();
            const filtered = suppliers.filter(s =>
                s.name.toLowerCase().includes(low) ||
                (s.category && s.category.toLowerCase().includes(low))
            );
            setFilteredSuppliers(filtered);
        } else {
            setFilteredSuppliers(suppliers);
        }
    }, [searchQuery, suppliers]);

    const handleSave = async () => {
        if (!formData.name) return Alert.alert('Error', 'El nombre es obligatorio');

        try {
            setLoading(true);
            if (editingSupplier) {
                const { error } = await supabase
                    .from('suppliers')
                    .update(formData)
                    .eq('id', editingSupplier.id);
                if (error) throw error;
            } else {
                const { error } = await supabase
                    .from('suppliers')
                    .insert([formData]);
                if (error) throw error;
            }

            setModalVisible(false);
            setEditingSupplier(null);
            setFormData({ name: '', category: '', phone: '', email: '', notes: '' });
            fetchSuppliers();
            Alert.alert('✅ Éxito', editingSupplier ? 'Proveedor actualizado' : 'Proveedor agregado');
        } catch (err) {
            Alert.alert('Error', 'No se pudo guardar el proveedor.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (supplier) => {
        Alert.alert(
            'Eliminar Proveedor',
            `¿Estás seguro de que quieres eliminar a "${supplier.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('suppliers')
                                .delete()
                                .eq('id', supplier.id);
                            if (error) throw error;
                            fetchSuppliers();
                        } catch (err) {
                            Alert.alert('Error', 'No se puede eliminar (es posible que tenga órdenes asociadas).');
                        }
                    }
                }
            ]
        );
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

            {loading && suppliers.length === 0 ? (
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

                            {/* Visual Product Gallery */}
                            <View style={styles.productGalleryContainer}>
                                <Text style={styles.galleryLabel}>CATÁLOGO DEL PROVEEDOR ({item.products?.length || 0})</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.productScroll}>
                                    {item.products && item.products.length > 0 ? (
                                        item.products.map(p => (
                                            <TouchableOpacity
                                                key={p.id}
                                                style={styles.miniProductCard}
                                                onPress={() => navigation.navigate('ProductDetail', { product: p })}
                                            >
                                                {p.image_url ? (
                                                    <Image source={{ uri: p.image_url }} style={styles.miniImage} />
                                                ) : (
                                                    <View style={[styles.miniImage, styles.miniImagePlaceholder]}>
                                                        <MaterialCommunityIcons name="image-off" size={20} color="#333" />
                                                    </View>
                                                )}
                                                <Text style={styles.miniProductName} numberOfLines={1}>{p.name}</Text>
                                                <Text style={styles.miniProductStock}>Stock: {p.current_stock}</Text>
                                            </TouchableOpacity>
                                        ))
                                    ) : (
                                        <Text style={styles.noProductsText}>Sin productos vinculados aún.</Text>
                                    )}
                                </ScrollView>
                            </View>

                            <View style={styles.cardFooter}>
                                {(item.phone || item.email) ? (
                                    <View style={styles.contactRow}>
                                        {item.phone && (
                                            <View style={styles.contactItem}>
                                                <MaterialCommunityIcons name="phone" size={14} color="#666" />
                                                <Text style={styles.contactText}>{item.phone}</Text>
                                            </View>
                                        )}
                                        {item.email && (
                                            <View style={styles.contactItem}>
                                                <MaterialCommunityIcons name="email" size={14} color="#666" />
                                                <Text style={styles.contactText}>{item.email}</Text>
                                            </View>
                                        )}
                                    </View>
                                ) : <View />}

                                <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#e74c3c" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="account-search-outline" size={60} color="#222" />
                            <Text style={styles.emptyText}>No hay proveedores registrados.</Text>
                        </View>
                    }
                />
            )}

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}</Text>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Nombre de la Empresa *</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Importadora Global"
                                placeholderTextColor="#444"
                                value={formData.name}
                                onChangeText={(t) => setFormData({ ...formData, name: t })}
                            />

                            <Text style={styles.label}>Categoría</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="Ej: Electrónica, Ropa..."
                                placeholderTextColor="#444"
                                value={formData.category}
                                onChangeText={(t) => setFormData({ ...formData, category: t })}
                            />

                            <Text style={styles.label}>Teléfono de Contacto</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="+54 9 ..."
                                placeholderTextColor="#444"
                                keyboardType="phone-pad"
                                value={formData.phone}
                                onChangeText={(t) => setFormData({ ...formData, phone: t })}
                            />

                            <Text style={styles.label}>Email</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="contacto@empresa.com"
                                placeholderTextColor="#444"
                                keyboardType="email-address"
                                autoCapitalize="none"
                                value={formData.email}
                                onChangeText={(t) => setFormData({ ...formData, email: t })}
                            />

                            <Text style={styles.label}>Notas / Observaciones</Text>
                            <TextInput
                                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                placeholder="Días de entrega, condiciones de pago..."
                                placeholderTextColor="#444"
                                multiline
                                value={formData.notes}
                                onChangeText={(t) => setFormData({ ...formData, notes: t })}
                            />
                        </ScrollView>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                                <Text style={styles.cancelBtnText}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>GUARDAR</Text>
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
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
    headerLabel: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
    title: { fontSize: 24, fontWeight: 'bold', color: '#fff', letterSpacing: 1 },

    addButton: { width: 45, height: 45, borderRadius: 12, overflow: 'hidden' },
    addBtnGradient: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    searchContainer: { padding: 20 },
    searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 12, paddingHorizontal: 15, borderWidth: 1, borderColor: '#222' },
    searchInput: { flex: 1, color: '#fff', paddingVertical: 12, marginLeft: 10, fontSize: 14 },

    listContent: { paddingHorizontal: 20, paddingBottom: 40 },
    card: { backgroundColor: '#0a0a0a', borderRadius: 15, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a' },
    cardMain: { flexDirection: 'row', alignItems: 'center' },
    iconBox: { width: 45, height: 45, borderRadius: 10, backgroundColor: 'rgba(212, 175, 55, 0.1)', alignItems: 'center', justifyContent: 'center' },
    supplierName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    supplierCategory: { color: '#666', fontSize: 12, marginTop: 2 },

    contactRow: { flexDirection: 'row', marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#1a1a1a', gap: 20 },
    contactItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    contactText: { color: '#888', fontSize: 12 },

    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#444', marginTop: 15, fontStyle: 'italic' },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', borderWidth: 1, borderColor: '#222' },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#d4af37', marginBottom: 25, textAlign: 'center', letterSpacing: 1 },
    label: { color: '#888', fontSize: 11, fontWeight: 'bold', marginBottom: 8, marginLeft: 5 },
    input: { backgroundColor: '#050505', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },

    modalButtons: { flexDirection: 'row', gap: 15, marginTop: 10, paddingBottom: 20 },
    cancelBtn: { flex: 1, padding: 18, borderRadius: 12, alignItems: 'center' },
    cancelBtnText: { color: '#666', fontWeight: 'bold' },
    saveBtn: { flex: 2, backgroundColor: '#d4af37', padding: 18, borderRadius: 12, alignItems: 'center' },
    saveBtnText: { color: '#000', fontWeight: '900', letterSpacing: 1 },

    trustBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(46, 204, 113, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
    trustText: { color: '#2ecc71', fontSize: 9, fontWeight: '900' },

    productGalleryContainer: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#1a1a1a' },
    galleryLabel: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 12 },
    productScroll: { flexDirection: 'row' },
    miniProductCard: { width: 90, marginRight: 15, alignItems: 'center' },
    miniImage: { width: 80, height: 80, borderRadius: 10, backgroundColor: '#111', marginBottom: 8 },
    miniImagePlaceholder: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#222', borderStyle: 'dashed' },
    miniProductName: { color: '#eee', fontSize: 10, fontWeight: 'bold', textAlign: 'center' },
    miniProductStock: { color: '#666', fontSize: 9, marginTop: 2 },
    noProductsText: { color: '#333', fontSize: 11, fontStyle: 'italic', paddingVertical: 10 },

    cardHeaderArea: { paddingBottom: 10 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15 },
    deleteBtn: { padding: 5 }
});
