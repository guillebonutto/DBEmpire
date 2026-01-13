import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, StatusBar, ScrollView } from 'react-native';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { GeminiService } from '../services/geminiService';

export default function PromotionsScreen({ navigation }) {
    const [promos, setPromos] = useState([]);
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [editingPromoId, setEditingPromoId] = useState(null);

    // AI State
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [generatedCopy, setGeneratedCopy] = useState('');

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState('global_percent'); // global_percent, buy_x_get_y, fixed_discount
    const [value, setValue] = useState('');
    const [selectedProducts, setSelectedProducts] = useState([]);

    useEffect(() => {
        fetchPromos();
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        const { data } = await supabase.from('products').select('id, name').eq('active', true).order('name');
        if (data) setProducts(data);
    };

    const fetchPromos = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('promotions')
            .select(`
                *,
                promotion_products (
                    product_id,
                    products (
                        name
                    )
                )
            `)
            .order('created_at', { ascending: false });

        if (data) setPromos(data);
        setLoading(false);
    };

    const handleSavePromo = async () => {
        if (!title || !type) return;

        // Validation for values
        const numericValue = parseFloat(value.toString().replace(',', '.')) || 0;
        if (type !== 'buy_x_get_y' && numericValue <= 0) {
            Alert.alert('Falta Valor', 'Por favor ingresa un porcentaje o monto de descuento mayor a 0 en el campo correspondiente.');
            return;
        }

        setLoading(true);

        const promoPayload = {
            title,
            description,
            type,
            value: numericValue,
            active: true
        };

        let promoData, promoError;

        if (editingPromoId) {
            const result = await supabase
                .from('promotions')
                .update(promoPayload)
                .eq('id', editingPromoId)
                .select()
                .single();
            promoData = result.data;
            promoError = result.error;
        } else {
            const result = await supabase
                .from('promotions')
                .insert(promoPayload)
                .select()
                .single();
            promoData = result.data;
            promoError = result.error;
        }

        if (promoError) {
            alert('Error al guardar la promoción: ' + promoError.message);
            setLoading(false);
            return;
        }

        if (editingPromoId) {
            await supabase.from('promotion_products').delete().eq('promotion_id', editingPromoId);
        }

        if (selectedProducts.length > 0) {
            const links = selectedProducts.map(pid => ({
                promotion_id: promoData.id,
                product_id: pid
            }));
            const { error: linkError } = await supabase.from('promotion_products').insert(links);
            if (linkError) console.error('Error linking products:', linkError);
        }

        resetForm();
        setModalVisible(false);
        fetchPromos();
        setLoading(false);
    };

    const handleDeletePromo = async (id) => {
        Alert.alert(
            'Eliminar Promoción',
            '¿Estás seguro?',
            [
                { text: 'No', style: 'cancel' },
                {
                    text: 'SÍ, BORRAR',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        await supabase.from('promotions').delete().eq('id', id);
                        fetchPromos();
                    }
                }
            ]
        );
    };

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setType('global_percent');
        setValue('');
        setSelectedProducts([]);
        setEditingPromoId(null);
    };

    const openEditModal = (promo) => {
        setTitle(promo.title);
        setDescription(promo.description || '');
        setType(promo.type);
        setValue(promo.value?.toString() || '');
        setSelectedProducts(promo.promotion_products?.map(pp => pp.product_id) || []);
        setEditingPromoId(promo.id);
        setModalVisible(true);
    };

    const toggleProductSelection = (id) => {
        setSelectedProducts(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const togglePromo = async (id, currentStatus) => {
        // Optimistic update
        setPromos(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
        await supabase.from('promotions').update({ active: !currentStatus }).eq('id', id);
    };

    const handleGenerateMagic = async (promo) => {
        setAiLoading(true);
        setAiModalVisible(true);
        setGeneratedCopy('');

        try {
            const productsInPromo = promo.promotion_products?.map(pp => pp.products) || [];
            const result = await GeminiService.generateMarketingCopy(promo.title, promo.description, productsInPromo);
            setGeneratedCopy(result);
        } catch (error) {
            Alert.alert('Error IA', error.message);
            setAiModalVisible(false);
        } finally {
            setAiLoading(false);
        }
    };

    const copyToClipboard = async () => {
        await Clipboard.setStringAsync(generatedCopy);
        Alert.alert('¡Copiado!', 'El texto está listo para pegar en WhatsApp.');
    };

    const renderHeader = () => (
        <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
            <View style={styles.headerContent}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>OFERTAS</Text>
                <View style={{ width: 40 }} />
            </View>
        </LinearGradient>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {renderHeader()}

            <FlatList
                data={promos}
                keyExtractor={item => item.id}
                contentContainerStyle={styles.list}
                refreshing={loading}
                onRefresh={fetchPromos}
                renderItem={({ item }) => (
                    <TouchableOpacity style={styles.card} onPress={() => openEditModal(item)}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 5 }}>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <View style={[styles.typeBadge, { backgroundColor: item.type === 'buy_x_get_y' ? '#e67e22' : '#d4af37' }]}>
                                    <Text style={styles.typeBadgeText}>
                                        {item.type === 'global_percent' ? `${item.value}% OFF` :
                                            item.type === 'buy_x_get_y' ? '2x1' :
                                                item.type === 'fixed_discount' ? `$${item.value} OFF` : 'PROMO'}
                                    </Text>
                                </View>
                            </View>

                            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}

                            {/* Linked Products Tags */}
                            {item.promotion_products && item.promotion_products.length > 0 && (
                                <View style={styles.tagsContainer}>
                                    {item.promotion_products.map((pp, idx) => (
                                        <View key={idx} style={styles.tag}>
                                            <Text style={styles.tagText}>{pp.products?.name}</Text>
                                        </View>
                                    ))}
                                </View>
                            )}

                            <Text style={[styles.statusText, { color: item.active ? '#2ecc71' : '#666' }]}>
                                {item.active ? '● VIGENTE' : '○ PAUSADA'}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <TouchableOpacity onPress={() => handleGenerateMagic(item)} style={{ padding: 10 }}>
                                <MaterialCommunityIcons name="auto-fix" size={24} color="#a29bfe" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDeletePromo(item.id)} style={{ padding: 10 }}>
                                <MaterialCommunityIcons name="trash-can-outline" size={24} color="#666" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => togglePromo(item.id, item.active)}>
                                <MaterialCommunityIcons
                                    name={item.active ? "toggle-switch" : "toggle-switch-off-outline"}
                                    size={44}
                                    color={item.active ? '#d4af37' : '#444'}
                                />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No hay promociones activas.</Text>}
            />

            <TouchableOpacity style={styles.fab} onPress={() => { resetForm(); setModalVisible(true); }}>
                <MaterialCommunityIcons name="plus" size={32} color="black" />
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={[styles.modalContent, { flex: 1 }]}>
                    <ScrollView showsVerticalScrollIndicator={false}>
                        <Text style={styles.modalTitle}>{editingPromoId ? 'Editar Promo' : 'Nueva Promo'}</Text>

                        <Text style={styles.label}>TIPO DE PROMOCIÓN:</Text>
                        <View style={styles.typeSelector}>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'global_percent' && styles.typeBtnActive]}
                                onPress={() => setType('global_percent')}
                            >
                                <Text style={[styles.typeBtnText, type === 'global_percent' && styles.typeBtnTextActive]}>% GLOBAL</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'buy_x_get_y' && styles.typeBtnActive]}
                                onPress={() => setType('buy_x_get_y')}
                            >
                                <Text style={[styles.typeBtnText, type === 'buy_x_get_y' && styles.typeBtnTextActive]}>2x1</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.typeBtn, type === 'fixed_discount' && styles.typeBtnActive]}
                                onPress={() => setType('fixed_discount')}
                            >
                                <Text style={[styles.typeBtnText, type === 'fixed_discount' && styles.typeBtnTextActive]}>FIJO $</Text>
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.label}>TÍTULO:</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej. Black Friday 20%"
                            value={title}
                            onChangeText={setTitle}
                            placeholderTextColor="#666"
                        />

                        {type !== 'buy_x_get_y' && (
                            <>
                                <Text style={styles.label}>{type === 'global_percent' ? 'PORCENTAJE (%)' : 'MONTO DE DESCUENTO ($)'}:</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej. 10"
                                    value={value}
                                    onChangeText={setValue}
                                    keyboardType="numeric"
                                    placeholderTextColor="#666"
                                />
                            </>
                        )}

                        <Text style={styles.label}>DESCRIPCIÓN (OPCIONAL):</Text>
                        <TextInput
                            style={[styles.input, styles.textArea]}
                            placeholder="Detalles adicionales..."
                            value={description}
                            onChangeText={setDescription}
                            multiline
                            placeholderTextColor="#666"
                        />

                        {type !== 'global_percent' && (
                            <>
                                <Text style={styles.label}>VINCULAR PRODUCTOS:</Text>
                                <View style={styles.productSelectionList}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                                        {products.map(product => (
                                            <TouchableOpacity
                                                key={product.id}
                                                style={[
                                                    styles.productChip,
                                                    selectedProducts.includes(product.id) && styles.productChipSelected
                                                ]}
                                                onPress={() => toggleProductSelection(product.id)}
                                            >
                                                <Text style={[
                                                    styles.productChipText,
                                                    selectedProducts.includes(product.id) && styles.productChipTextSelected
                                                ]}>
                                                    {product.name}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            </>
                        )}

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSavePromo}>
                            {loading ? <ActivityIndicator color="black" /> : <Text style={styles.saveText}>{editingPromoId ? 'Actualizar Promo' : 'Publicar Promo'}</Text>}
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                            <Text style={styles.cancelText}>Cancelar</Text>
                        </TouchableOpacity>

                        <View style={{ height: 50 }} />
                    </ScrollView>
                </View>
            </Modal>

            {/* AI MAGIC MODAL */}
            <Modal visible={aiModalVisible} animationType="fade" transparent>
                <View style={styles.aiModalOverlay}>
                    <View style={styles.aiModalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={styles.aiTitle}>✨ ASISTENTE DE MARKETING ✨</Text>
                            <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        {aiLoading ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#a29bfe" />
                                <Text style={{ color: '#a29bfe', marginTop: 20, fontStyle: 'italic' }}>
                                    Creando mensajes persuasivos... 🧠
                                </Text>
                            </View>
                        ) : (
                            <>
                                <ScrollView style={{ maxHeight: 400 }} contentContainerStyle={{ paddingBottom: 20 }}>
                                    <Text style={styles.aiText}>{generatedCopy}</Text>
                                </ScrollView>
                                <TouchableOpacity style={styles.copyBtn} onPress={copyToClipboard}>
                                    <MaterialCommunityIcons name="content-copy" size={20} color="black" />
                                    <Text style={styles.copyBtnText}>COPIAR TEXTO</Text>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },

    header: { paddingTop: 40, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
    backBtn: { padding: 5 },

    list: { padding: 20 },
    card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, marginBottom: 15, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 5, letterSpacing: 0.5 },
    cardDesc: { color: '#888', fontSize: 14, marginBottom: 8 },
    statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' },

    typeBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10 },
    typeBadgeText: { color: '#000', fontSize: 10, fontWeight: '900' },

    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginBottom: 10 },
    tag: { backgroundColor: '#d4af3720', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 5, borderWidth: 1, borderColor: '#d4af3740' },
    tagText: { color: '#d4af37', fontSize: 10, fontWeight: 'bold' },

    fab: { position: 'absolute', bottom: 70, right: 30, width: 65, height: 65, borderRadius: 35, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', shadowColor: '#d4af37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },

    // Modal styles
    modalContent: { flex: 1, padding: 30, backgroundColor: '#121212', marginTop: 0 },
    modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 30, color: '#d4af37', textAlign: 'center', letterSpacing: 1 },
    label: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#222', padding: 18, borderRadius: 12, marginBottom: 20, fontSize: 16, color: 'white', borderWidth: 1, borderColor: '#333' },
    textArea: { height: 80, textAlignVertical: 'top' },

    typeSelector: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 25 },
    typeBtn: { flex: 1, backgroundColor: '#1a1a1a', paddingVertical: 12, borderRadius: 10, alignItems: 'center', marginRight: 5, borderWidth: 1, borderColor: '#333' },
    typeBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    typeBtnText: { color: '#666', fontSize: 10, fontWeight: 'bold' },
    typeBtnTextActive: { color: '#000' },

    productSelectionList: { marginBottom: 25 },
    productChip: { backgroundColor: '#1a1a1a', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 10, borderWidth: 1, borderColor: '#333' },
    productChipSelected: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    productChipText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
    productChipTextSelected: { color: '#000' },

    saveText: { color: 'black', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
    cancelBtn: { marginTop: 20, marginBottom: 30, alignItems: 'center' },
    cancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' },

    // AI Modal Styles
    aiModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
    aiModalContent: { backgroundColor: '#1a1a1a', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#a29bfe' },
    aiTitle: { color: '#a29bfe', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    aiText: { color: '#e0e0e0', fontSize: 16, lineHeight: 24 },
    copyBtn: { backgroundColor: '#a29bfe', padding: 15, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 10 },
    copyBtnText: { color: 'black', fontWeight: '900', fontSize: 16 }
});
