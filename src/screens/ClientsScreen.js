import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

export default function ClientsScreen() {
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', phone: '', notes: '' });
    const [searchQuery, setSearchQuery] = useState('');

    const fetchClients = async () => {
        setLoading(true);

        try {
            const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) {
                setClients(data);
                setFilteredClients(data);
            }
        } catch (err) {
            console.log('Error fetching clients:', err);
        } finally {
            setLoading(false);
        }
    };

    const addClient = async () => {
        if (!newClient.name) return Alert.alert('Error', 'El nombre es obligatorio');

        try {
            const { error } = await supabase.from('clients').insert([newClient]);
            if (error) throw error;
            setModalVisible(false);
            setNewClient({ name: '', phone: '', notes: '' });
            fetchClients();
            Alert.alert('Éxito', 'Cliente agregado');
        } catch (err) {
            Alert.alert('Error', 'No se pudo guardar (Revisar conexión/claves)');
        }
    };

    useEffect(() => {
        fetchClients();
    }, []);

    // Filter logic
    useEffect(() => {
        if (searchQuery) {
            const filtered = clients.filter(c =>
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.phone && c.phone.includes(searchQuery))
            );
            setFilteredClients(filtered);
        } else {
            setFilteredClients(clients);
        }
    }, [searchQuery, clients]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>CLIENTES</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                    <Text style={styles.addButtonText}>+ AGREGAR</Text>
                </TouchableOpacity>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar cliente (Nombre/Tel)..."
                    placeholderTextColor="#888"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
            </View>

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.info}>{item.phone}</Text>
                        <Text style={styles.notes}>{item.notes}</Text>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>{searchQuery ? 'Sin resultados.' : 'No hay clientes registrados.'}</Text>}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Nuevo Cliente</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nombre"
                        placeholderTextColor="#666"
                        value={newClient.name}
                        onChangeText={(t) => setNewClient({ ...newClient, name: t })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Teléfono"
                        placeholderTextColor="#666"
                        value={newClient.phone}
                        onChangeText={(t) => setNewClient({ ...newClient, phone: t })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Notas (Preferencias, etc)"
                        placeholderTextColor="#666"
                        value={newClient.notes}
                        onChangeText={(t) => setNewClient({ ...newClient, notes: t })}
                    />
                    <View style={styles.modalButtons}>
                        <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.cancelText}>Cancelar</Text></TouchableOpacity>
                        <TouchableOpacity onPress={addClient}><Text style={styles.saveText}>Guardar</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
    title: { fontSize: 20, fontWeight: 'bold', color: '#d4af37' },

    addButton: { backgroundColor: '#d4af37', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
    addButtonText: { color: 'black', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

    searchContainer: { paddingHorizontal: 20, paddingBottom: 10 },
    searchInput: { backgroundColor: '#222', color: '#fff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333' },

    card: { backgroundColor: '#1e1e1e', padding: 20, marginHorizontal: 20, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    name: { fontSize: 18, fontWeight: 'bold', color: '#fff', marginBottom: 5 },
    info: { color: '#d4af37', fontWeight: '600' },
    notes: { fontStyle: 'italic', color: '#888', marginTop: 8, fontSize: 12 },

    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' },

    // Modal
    modalView: { margin: 20, marginTop: 100, backgroundColor: '#121212', borderRadius: 20, padding: 35, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, elevation: 10 },
    modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 25, color: '#d4af37', textAlign: 'center' },
    input: { backgroundColor: '#222', color: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },

    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    saveText: { color: '#d4af37', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    cancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' },
});
