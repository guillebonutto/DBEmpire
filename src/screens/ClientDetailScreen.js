import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, ScrollView, StatusBar, Linking, Modal, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClientDetailScreen({ route, navigation }) {
    const { client } = route.params;
    const [sales, setSales] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentClient, setCurrentClient] = useState(client);
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [editData, setEditData] = useState({
        name: client.name,
        phone: client.phone || '',
        notes: client.notes || ''
    });
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchClientSales();
    }, []);

    const fetchClientSales = async () => {
        try {
            const { data, error } = await supabase
                .from('sales')
                .select('*')
                .eq('client_id', currentClient.id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setSales(data || []);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateClient = async () => {
        if (!editData.name) {
            Alert.alert('Error', 'el nombre es obligatorio');
            return;
        }

        setUpdating(true);
        try {
            const { error } = await supabase
                .from('clients')
                .update({
                    name: editData.name,
                    phone: editData.phone,
                    notes: editData.notes
                })
                .eq('id', currentClient.id);

            if (error) throw error;

            setCurrentClient({ ...currentClient, ...editData });
            setEditModalVisible(false);
            Alert.alert('Éxito', 'Datos del cliente actualizados');
        } catch (err) {
            console.log('Update error:', err);
            Alert.alert('Error', 'No se pudieron actualizar los datos');
        } finally {
            setUpdating(false);
        }
    };

    const getVIPLabel = () => {
        const spent = currentClient.totalSpent || 0;
        if (spent > 5000) return { label: 'DIAMANTE', color: '#b9f2ff', icon: 'diamond-stone' };
        if (spent > 2000) return { label: 'ORO', color: '#ffd700', icon: 'crown' };
        if (spent > 500) return { label: 'PLATA', color: '#c0c0c0', icon: 'medal' };
        return { label: 'BRONCE', color: '#cd7f32', icon: 'account' };
    };

    const vip = getVIPLabel();

    const renderSaleItem = ({ item }) => (
        <View style={styles.saleCard}>
            <View>
                <Text style={styles.saleDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                <Text style={styles.saleStatus}>{item.status?.toUpperCase() || 'COMPLETADA'}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.saleAmount}>${item.total_amount?.toFixed(2)}</Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#1a1a1a', '#000']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={28} color="#d4af37" />
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => setEditModalVisible(true)}
                    style={styles.editBtn}
                >
                    <MaterialCommunityIcons name="account-edit" size={24} color="#d4af37" />
                </TouchableOpacity>

                <View style={styles.profileSection}>
                    <View style={[styles.avatar, { borderColor: vip.color }]}>
                        <MaterialCommunityIcons name={vip.icon} size={40} color={vip.color} />
                    </View>
                    <Text style={styles.name}>{currentClient.name}</Text>
                    <View style={[styles.vipBadge, { backgroundColor: vip.color + '22', borderColor: vip.color }]}>
                        <Text style={[styles.vipText, { color: vip.color }]}>CLIENTE {vip.label}</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={styles.statsRow}>
                <View style={styles.statBox}>
                    <Text style={styles.statLabel}>INVERSIÓN TOTAL</Text>
                    <Text style={styles.statValue}>${currentClient.totalSpent?.toFixed(2)}</Text>
                </View>
                <View style={[styles.statBox, { borderLeftWidth: 1, borderLeftColor: '#222' }]}>
                    <Text style={styles.statLabel}>VISITAS</Text>
                    <Text style={styles.statValue}>{sales.length}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <View style={styles.infoSection}>
                    <TouchableOpacity
                        style={styles.infoRow}
                        onPress={() => currentClient.phone && Linking.openURL(`tel:${currentClient.phone}`)}
                    >
                        <MaterialCommunityIcons name="phone" size={20} color="#d4af37" />
                        <Text style={styles.infoText}>{currentClient.phone || 'Sin teléfono'}</Text>
                    </TouchableOpacity>

                    {currentClient.phone && (
                        <TouchableOpacity
                            style={[styles.infoRow, { marginTop: 5 }]}
                            onPress={() => Linking.openURL(`https://wa.me/${currentClient.phone.replace(/[^0-9]/g, '')}`)}
                        >
                            <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
                            <Text style={[styles.infoText, { color: '#25D366', fontWeight: 'bold' }]}>Contactar por WhatsApp</Text>
                        </TouchableOpacity>
                    )}

                    <View style={styles.infoRow}>
                        <MaterialCommunityIcons name="note-text" size={20} color="#d4af37" />
                        <Text style={styles.infoText}>{currentClient.notes || 'Sin notas adicionales'}</Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>HISTORIAL DE COMPRAS</Text>
                {loading ? (
                    <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} />
                ) : (
                    <FlatList
                        data={sales}
                        keyExtractor={item => item.id.toString()}
                        renderItem={renderSaleItem}
                        ListEmptyComponent={<Text style={styles.empty}>No hay compras registradas aún.</Text>}
                        contentContainerStyle={{ paddingBottom: 40 }}
                    />
                )}
            </View>

            <Modal visible={editModalVisible} animationType="fade" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Editar Cliente</Text>

                        <Text style={styles.inputLabel}>NOMBRE</Text>
                        <TextInput
                            style={styles.input}
                            value={editData.name}
                            onChangeText={(t) => setEditData({ ...editData, name: t })}
                            placeholderTextColor="#666"
                        />

                        <Text style={styles.inputLabel}>TELÉFONO</Text>
                        <TextInput
                            style={styles.input}
                            value={editData.phone}
                            onChangeText={(t) => setEditData({ ...editData, phone: t })}
                            placeholderTextColor="#666"
                            keyboardType="phone-pad"
                        />

                        <Text style={styles.inputLabel}>NOTAS / PREFERENCIAS</Text>
                        <TextInput
                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                            value={editData.notes}
                            onChangeText={(t) => setEditData({ ...editData, notes: t })}
                            placeholderTextColor="#666"
                            multiline
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                onPress={() => setEditModalVisible(false)}
                                style={styles.cancelBtn}
                            >
                                <Text style={styles.cancelText}>CANCELAR</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleUpdateClient}
                                style={styles.saveBtn}
                                disabled={updating}
                            >
                                {updating ? <ActivityIndicator size="small" color="#000" /> : <Text style={styles.saveText}>GUARDAR</Text>}
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
    header: { padding: 25, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#222', flexDirection: 'row', justifyContent: 'center' },
    backBtn: { position: 'absolute', left: 20, top: 40 },
    editBtn: { position: 'absolute', right: 20, top: 40 },
    profileSection: { alignItems: 'center', marginTop: 10 },
    avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#0a0a0a', justifyContent: 'center', alignItems: 'center', borderWidth: 2, marginBottom: 15 },
    name: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 8, letterSpacing: 0.5 },
    vipBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
    vipText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },

    statsRow: { flexDirection: 'row', backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#222' },
    statBox: { flex: 1, padding: 20, alignItems: 'center' },
    statLabel: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
    statValue: { color: '#fff', fontSize: 20, fontWeight: 'bold' },

    content: { flex: 1, padding: 20 },
    infoSection: { backgroundColor: '#111', borderRadius: 15, padding: 15, marginBottom: 25 },
    infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    infoText: { color: '#ccc', marginLeft: 10, fontSize: 14 },

    sectionTitle: { color: '#d4af37', fontSize: 12, fontWeight: '900', letterSpacing: 2, marginBottom: 15 },
    saleCard: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 12, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
    saleDate: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
    saleStatus: { color: '#666', fontSize: 10, marginTop: 2 },
    saleAmount: { color: '#2ecc71', fontWeight: '900', fontSize: 16 },
    empty: { textAlign: 'center', color: '#444', marginTop: 20, fontStyle: 'italic' },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
    modalContent: { backgroundColor: '#111', borderRadius: 20, padding: 25, borderWidth: 1, borderColor: '#333' },
    modalTitle: { fontSize: 20, fontWeight: '900', color: '#d4af37', textAlign: 'center', marginBottom: 20, letterSpacing: 1 },
    inputLabel: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 5 },
    input: { backgroundColor: '#000', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#222', fontWeight: 'bold' },
    modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    cancelBtn: { flex: 1, padding: 15, alignItems: 'center' },
    cancelText: { color: '#666', fontWeight: 'bold' },
    saveBtn: { flex: 1, backgroundColor: '#d4af37', padding: 15, borderRadius: 12, alignItems: 'center' },
    saveText: { color: '#000', fontWeight: '900', letterSpacing: 1 }
});
