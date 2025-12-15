import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, StatusBar } from 'react-native';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PromotionsScreen({ navigation }) {
    const [promos, setPromos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');

    useEffect(() => {
        fetchPromos();
    }, []);

    const fetchPromos = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('promotions').select('*').order('created_at', { ascending: false });
        if (data) setPromos(data);
        setLoading(false);
    };

    const handleAddPromo = async () => {
        if (!title) return;
        setLoading(true);
        const { error } = await supabase.from('promotions').insert({ title, description, active: true });

        if (!error) {
            setTitle('');
            setDescription('');
            setModalVisible(false);
            fetchPromos();
        } else {
            alert('Error al guardar');
        }
        setLoading(false);
    };

    const togglePromo = async (id, currentStatus) => {
        // Optimistic update
        setPromos(prev => prev.map(p => p.id === id ? { ...p, active: !currentStatus } : p));
        await supabase.from('promotions').update({ active: !currentStatus }).eq('id', id);
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
                    <View style={styles.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cardTitle}>{item.title}</Text>
                            {item.description ? <Text style={styles.cardDesc}>{item.description}</Text> : null}
                            <Text style={[styles.statusText, { color: item.active ? '#2ecc71' : '#666' }]}>
                                {item.active ? '● VIGENTE' : '○ PAUSADA'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => togglePromo(item.id, item.active)}>
                            <MaterialCommunityIcons
                                name={item.active ? "toggle-switch" : "toggle-switch-off-outline"}
                                size={44}
                                color={item.active ? '#d4af37' : '#444'}
                            />
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No hay promociones activas.</Text>}
            />

            <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                <MaterialCommunityIcons name="plus" size={32} color="black" />
            </TouchableOpacity>

            <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
                <View style={styles.modalContent}>
                    <Text style={styles.modalTitle}>Nueva Promo</Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Título (ej. 2x1 VIP)"
                        value={title}
                        onChangeText={setTitle}
                        placeholderTextColor="#666"
                    />

                    <TextInput
                        style={[styles.input, styles.textArea]}
                        placeholder="Detalles de la oferta..."
                        value={description}
                        onChangeText={setDescription}
                        multiline
                        placeholderTextColor="#666"
                    />

                    <TouchableOpacity style={styles.saveBtn} onPress={handleAddPromo}>
                        {loading ? <ActivityIndicator color="black" /> : <Text style={styles.saveText}>Publicar</Text>}
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                        <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </Modal>
        </SafeAreaView>
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

    fab: { position: 'absolute', bottom: 70, right: 30, width: 65, height: 65, borderRadius: 35, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', shadowColor: '#d4af37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },

    // Modal styles
    modalContent: { flex: 1, padding: 30, backgroundColor: '#121212', marginTop: 0 },
    modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 30, color: '#d4af37', textAlign: 'center', letterSpacing: 1 },
    input: { backgroundColor: '#222', padding: 18, borderRadius: 12, marginBottom: 15, fontSize: 16, color: 'white', borderWidth: 1, borderColor: '#333' },
    textArea: { height: 100, textAlignVertical: 'top' },
    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    saveText: { color: 'black', fontWeight: '900', fontSize: 18, letterSpacing: 1 },
    cancelBtn: { marginTop: 20, alignItems: 'center' },
    cancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' }
});
