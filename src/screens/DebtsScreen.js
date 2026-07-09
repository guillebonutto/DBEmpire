import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Linking, ActivityIndicator, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from '@react-navigation/native';
import { useFinanceStore } from '../store/useFinanceStore';
import { useClientStore } from '../store/useClientStore';

export default function DebtsScreen({ navigation }) {
    const { sales, fetchAllData, isLoading } = useFinanceStore();
    const { clients } = useClientStore();

    const debts = useMemo(() => {
        return sales
            .filter(sale => sale.status === 'pending')
            .map(sale => ({
                ...sale,
                clients: clients.find(c => c.id === sale.client_id)
            }))
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }, [sales, clients]);

    useFocusEffect(
        useCallback(() => {
            fetchAllData();
        }, [])
    );

    const markAsPaid = async (saleId) => {
        Alert.alert(
            'Confirmar Pago',
            '¿Este cliente ya liquidó su deuda?',
            [
                { text: 'No' },
                {
                    text: 'SÍ, PAGADO',
                    onPress: async () => {
                        const { error } = await supabase
                            .from('sales')
                            .update({ status: 'completed', paid_at: new Date().toISOString() })
                            .eq('id', saleId);

                        if (!error) fetchAllData(true);
                    }
                }
            ]
        );
    };

    const sendReminder = (item) => {
        const client = item.clients;
        if (!client?.phone) {
            Alert.alert('Sin Teléfono', 'Este cliente no tiene un número registrado.');
            return;
        }
        const message = `Hola ${client.name}, te saludo de Digital Boost Empire. Paso a recordarte tu saldo pendiente de $${item.total_amount}. ¡Quedamos atentos! 🚀`;
        const url = `whatsapp://send?phone=${client.phone}&text=${encodeURIComponent(message)}`;
        Linking.openURL(url).catch(() => Alert.alert('Error', 'No se pudo abrir WhatsApp.'));
    };

    const renderItem = ({ item }) => (
        <View style={styles.debtCard}>
            <View style={styles.debtHeader}>
                <View>
                    <Text style={styles.clientName}>{item.clients?.name || 'Cliente Desconocido'}</Text>
                    <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={styles.amount}>${item.total_amount}</Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity style={styles.reminderBtn} onPress={() => sendReminder(item)}>
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
                    <Text style={styles.reminderText}>Recordatorio</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.paidBtn} onPress={() => markAsPaid(item.id)}>
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color="#000" />
                    <Text style={styles.paidText}>Pagado</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safe}>
                <View style={styles.headerRow}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={30} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.header}>CUENTAS POR COBRAR</Text>
                    {debts.length > 0 && (
                        <View style={styles.badge}><Text style={styles.badgeText}>{debts.length}</Text></View>
                    )}
                </View>

                {isLoading && debts.length === 0 ? (
                    <ActivityIndicator color="#d4af37" size="large" style={{ marginTop: 50 }} />
                ) : debts.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <MaterialCommunityIcons name="cash-check" size={80} color="#222" />
                        <Text style={styles.emptyText}>¡TODO AL DÍA!</Text>
                        <Text style={styles.emptySubtext}>No hay deudas pendientes en el imperio.</Text>
                    </View>
                ) : (
                    <FlatList
                        data={debts}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={true}
                        contentContainerStyle={styles.list}
                    />
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safe: { flex: 1 },
    headerRow: { flexDirection: 'row', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    backBtn: { marginRight: 10 },
    header: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    badge: { backgroundColor: '#e74c3c', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, marginLeft: 10 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    list: { padding: 20, paddingBottom: 110 },
    debtCard: { backgroundColor: '#111', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    debtHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    clientName: { fontSize: 18, fontWeight: '900', color: '#fff' },
    date: { fontSize: 12, color: '#666', marginTop: 4 },
    amount: { fontSize: 24, fontWeight: '900', color: '#e74c3c' },
    actions: { flexDirection: 'row', gap: 10 },
    reminderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#112211', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#1a3a1a' },
    reminderText: { color: '#25D366', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
    paidBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d4af37', paddingVertical: 12, borderRadius: 12 },
    paidText: { color: '#000', fontWeight: 'bold', marginLeft: 8, fontSize: 13 },
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyText: { color: '#d4af37', fontSize: 20, fontWeight: '900', marginTop: 20, letterSpacing: 1 },
    emptySubtext: { color: '#666', fontSize: 14, marginTop: 5, textAlign: 'center' }
});
