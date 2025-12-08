import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';

export default function ClientsScreen() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', phone: '', notes: '' });

    const fetchClients = async () => {
        setLoading(true);
        // Mock data for dev if no keys
        // setClients([{ id: 1, name: 'Juan Perez', phone: '555-1234', notes: 'Cliente frecuente' }]); 

        try {
            const { data, error } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            if (data) setClients(data);
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

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <TouchableOpacity style={styles.addButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.addButtonText}>+ Agregar Cliente</Text>
            </TouchableOpacity>

            <FlatList
                data={clients}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item }) => (
                    <View style={styles.card}>
                        <Text style={styles.name}>{item.name}</Text>
                        <Text style={styles.info}>{item.phone}</Text>
                        <Text style={styles.notes}>{item.notes}</Text>
                    </View>
                )}
                ListEmptyComponent={<Text style={styles.empty}>No hay clientes registrados.</Text>}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalView}>
                    <Text style={styles.modalTitle}>Nuevo Cliente</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Nombre"
                        value={newClient.name}
                        onChangeText={(t) => setNewClient({ ...newClient, name: t })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Teléfono"
                        value={newClient.phone}
                        onChangeText={(t) => setNewClient({ ...newClient, phone: t })}
                    />
                    <TextInput
                        style={styles.input}
                        placeholder="Notas (Preferencias, etc)"
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
    container: { flex: 1, padding: 20, backgroundColor: '#000000' },

    addButton: { backgroundColor: '#d4af37', padding: 15, borderRadius: 12, alignItems: 'center', marginBottom: 20, shadowColor: '#d4af37', shadowOpacity: 0.3, elevation: 5 },
    addButtonText: { color: 'black', fontWeight: '900', fontSize: 16, letterSpacing: 1 },

    card: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
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
