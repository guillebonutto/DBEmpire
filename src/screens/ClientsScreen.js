import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Modal, StatusBar, ScrollView, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { CRMService } from '../services/crmService';
import { GeminiService } from '../services/geminiService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function ClientsScreen({ navigation }) {
    const [clients, setClients] = useState([]);
    const [filteredClients, setFilteredClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);
    const [newClient, setNewClient] = useState({ name: '', phone: '', notes: '' });
    const [searchQuery, setSearchQuery] = useState('');
    const [inactiveClients, setInactiveClients] = useState([]);
    const [generatingMsg, setGeneratingMsg] = useState(null); // ID of client being processed

    const fetchClients = async () => {
        setLoading(true);

        try {
            // Get Clients
            const { data: clientsData, error: clientsError } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
            if (clientsError) throw clientsError;

            // Get Completed Sales to calculate total spent
            const { data: salesData, error: salesError } = await supabase
                .from('sales')
                .select('client_id, total_amount')
                .eq('status', 'completed');

            if (salesError) throw salesError;

            if (clientsData) {
                // Calculate Totals
                const clientMap = clientsData.map(client => {
                    const clientSales = salesData ? salesData.filter(s => s.client_id === client.id) : [];
                    const totalSpent = clientSales.reduce((acc, curr) => acc + (curr.total_amount || 0), 0);
                    return { ...client, totalSpent };
                });

                // Sort by Total Spent (Ranking)
                const sortedClients = clientMap.sort((a, b) => b.totalSpent - a.totalSpent);

                setClients(sortedClients);
                setFilteredClients(sortedClients);

                // CRM Insights: Get Inactive
                const inactive = await CRMService.getInactiveClients(30);
                setInactiveClients(inactive.slice(0, 5)); // Show top 5 inactive
            }
        } catch (err) {
            console.log('Error fetching clients:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleRecoverClient = async (client) => {
        setGeneratingMsg(client.id);
        try {
            const prompt = `Genera un mensaje de WhatsApp corto y profesional para recuperar a un cliente llamado ${client.name} que no ha comprado en 30 días. El tono debe ser amigable y ofrecer un 10% de descuento en su próxima compra. Solo devuelve el texto del mensaje.`;
            const message = await GeminiService.generateMarketingCopy(prompt);

            const url = `whatsapp://send?phone=${client.phone}&text=${encodeURIComponent(message)}`;
            const supported = await Linking.canOpenURL(url);

            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', 'WhatsApp no está instalado o el número es inválido.');
            }
        } catch (err) {
            console.log('Recovery error:', err);
            Alert.alert('Error', 'No se pudo generar el mensaje con IA.');
        } finally {
            setGeneratingMsg(null);
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

            {/* AI Insights Section */}
            {!searchQuery && inactiveClients.length > 0 && (
                <View style={styles.insightsContainer}>
                    <View style={styles.insightsHeader}>
                        <MaterialCommunityIcons name="robot" size={18} color="#d4af37" />
                        <Text style={styles.insightsTitle}>AI INSIGHTS: RECUPERACIÓN</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.insightsScroll}>
                        {inactiveClients.map(client => (
                            <View key={client.id} style={styles.insightCard}>
                                <Text style={styles.insightName}>{client.name}</Text>
                                <Text style={styles.insightReason}>Inactivo hace +30 días</Text>
                                <TouchableOpacity
                                    style={styles.recoverBtn}
                                    onPress={() => handleRecoverClient(client)}
                                    disabled={generatingMsg === client.id}
                                >
                                    <MaterialCommunityIcons name="whatsapp" size={14} color="#000" />
                                    <Text style={styles.recoverBtnText}>
                                        {generatingMsg === client.id ? '...' : 'RECUPERAR'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ))}
                    </ScrollView>
                </View>
            )}

            <FlatList
                data={filteredClients}
                keyExtractor={(item) => item.id.toString()}
                renderItem={({ item, index }) => {
                    // Determine Rank Badge
                    let badge = null;
                    // Only rank if they have spent something
                    if (item.totalSpent > 0 && !searchQuery) {
                        if (index === 0) badge = "👑 #1 CLIENTE VIP";
                        else if (index === 1) badge = "🥈 #2";
                        else if (index === 2) badge = "🥉 #3";
                    }

                    return (
                        <TouchableOpacity
                            style={[
                                styles.card,
                                index === 0 && !searchQuery && item.totalSpent > 0 && { borderColor: '#ffd700', borderWidth: 2 } // Gold border for #1
                            ]}
                            onPress={() => navigation.navigate('ClientDetail', { client: item })}
                        >
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <View>
                                    <Text style={styles.name}>{item.name}</Text>
                                    <Text style={styles.info}>{item.phone}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={[styles.spentAmount, index === 0 && !searchQuery && item.totalSpent > 0 && { color: '#ffd700', fontSize: 18 }]}>
                                        ${item.totalSpent?.toFixed(2)}
                                    </Text>
                                    {badge && <Text style={{ color: '#d4af37', fontWeight: 'bold', fontSize: 10, marginTop: 4 }}>{badge}</Text>}
                                </View>
                            </View>
                            <Text style={styles.notes}>{item.notes}</Text>
                        </TouchableOpacity>
                    );
                }}
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
    spentAmount: { color: '#2ecc71', fontWeight: '900', fontSize: 16 },
    notes: { fontStyle: 'italic', color: '#888', marginTop: 8, fontSize: 12 },

    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' },

    // Modal
    modalView: { margin: 20, marginTop: 100, backgroundColor: '#121212', borderRadius: 20, padding: 35, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.5, elevation: 10 },
    modalTitle: { fontSize: 24, fontWeight: '900', marginBottom: 25, color: '#d4af37', textAlign: 'center' },
    input: { backgroundColor: '#222', color: 'white', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },

    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
    saveText: { color: '#d4af37', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    cancelText: { color: '#666', fontSize: 16, fontWeight: 'bold' },

    // AI Insights
    insightsContainer: { paddingVertical: 15, backgroundColor: 'rgba(212, 175, 55, 0.05)', borderBottomWidth: 1, borderBottomColor: '#222' },
    insightsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 10, gap: 8 },
    insightsTitle: { color: '#d4af37', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    insightsScroll: { paddingLeft: 20 },
    insightCard: { backgroundColor: '#111', padding: 15, borderRadius: 12, marginRight: 15, width: 160, borderWidth: 1, borderColor: '#333' },
    insightName: { color: '#fff', fontSize: 14, fontWeight: 'bold', marginBottom: 2 },
    insightReason: { color: '#666', fontSize: 10, marginBottom: 10 },
    recoverBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2ecc71', paddingVertical: 6, borderRadius: 6, gap: 5 },
    recoverBtnText: { color: '#000', fontSize: 10, fontWeight: 'bold' }
});
