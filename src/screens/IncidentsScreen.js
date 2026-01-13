import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';

const INCIDENT_TYPES = [
    { id: 'faltante_caja', label: 'Faltó plata', icon: 'cash-remove', color: '#e74c3c' },
    { id: 'queja_cliente', label: 'Cliente se quejó', icon: 'account-alert', color: '#f1c40f' },
    { id: 'devolucion_producto', label: 'Producto devuelto', icon: 'package-variant-minus', color: '#3498db' },
    { id: 'otro', label: 'Otro', icon: 'dots-horizontal-circle', color: '#95a5a6' }
];

export default function IncidentsScreen({ navigation }) {
    const [incidents, setIncidents] = useState([]);
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [type, setType] = useState('faltante_caja');
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        fetchIncidents();
    }, []);

    const fetchIncidents = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('incidents')
                .select('*, profiles(full_name)')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) throw error;
            setIncidents(data || []);
        } catch (error) {
            console.log('Error fetching incidents:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveIncident = async () => {
        if (!description && type !== 'faltante_caja') {
            Alert.alert('Error', 'La descripción es obligatoria');
            return;
        }

        setAdding(true);
        try {
            const { error } = await supabase
                .from('incidents')
                .insert({
                    type,
                    description: description.trim() || (type === 'faltante_caja' ? 'Faltante de caja' : 'Incidente reportado'),
                    amount: parseFloat(amount) || 0,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;

            Alert.alert('✅ Registrado', 'El incidente ha sido guardado correctamente.');
            setDescription('');
            setAmount('');
            fetchIncidents();
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar el incidente.');
            console.log(error);
        } finally {
            setAdding(false);
        }
    };

    const renderHeader = () => (
        <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
            <View style={styles.headerTop}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>REGISTRO DE INCIDENTES</Text>
                <View style={{ width: 40 }} />
            </View>
        </LinearGradient>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {renderHeader()}

            <ScrollView style={styles.form} contentContainerStyle={{ paddingBottom: 20 }}>
                <Text style={styles.label}>TIPO DE INCIDENTE:</Text>
                <View style={styles.typeGrid}>
                    {INCIDENT_TYPES.map(item => (
                        <TouchableOpacity
                            key={item.id}
                            style={[
                                styles.typeCard,
                                type === item.id && { borderColor: item.color, backgroundColor: `${item.color}20` }
                            ]}
                            onPress={() => setType(item.id)}
                        >
                            <MaterialCommunityIcons name={item.icon} size={24} color={type === item.id ? item.color : '#666'} />
                            <Text style={[styles.typeLabel, type === item.id && { color: item.color }]}>{item.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.label}>DESCRIPCIÓN:</Text>
                <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Explica qué pasó..."
                    placeholderTextColor="#666"
                    value={description}
                    onChangeText={setDescription}
                    multiline
                />

                <Text style={styles.label}>MONTO RELACIONADO (OPCIONAL):</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Ej. 500"
                    placeholderTextColor="#666"
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                />

                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveIncident} disabled={adding}>
                    {adding ? <ActivityIndicator color="black" /> : (
                        <>
                            <MaterialCommunityIcons name="alert-circle-check" size={24} color="black" />
                            <Text style={styles.saveBtnText}>REPORTAR NOVEDAD</Text>
                        </>
                    )}
                </TouchableOpacity>

                <View style={styles.divider} />
                <Text style={styles.sectionTitle}>ÚLTIMOS REPORTES</Text>

                {loading ? (
                    <ActivityIndicator color="#d4af37" style={{ marginTop: 20 }} />
                ) : (
                    incidents.map((item, index) => {
                        const typeInfo = INCIDENT_TYPES.find(t => t.id === item.type) || INCIDENT_TYPES[3];
                        return (
                            <View key={item.id} style={styles.incidentCard}>
                                <View style={[styles.iconBadge, { backgroundColor: `${typeInfo.color}20` }]}>
                                    <MaterialCommunityIcons name={typeInfo.icon} size={20} color={typeInfo.color} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 15 }}>
                                    <View style={styles.cardHeader}>
                                        <Text style={styles.cardType}>{typeInfo.label.toUpperCase()}</Text>
                                        <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                    </View>
                                    <Text style={styles.cardDesc}>{item.description}</Text>
                                    {item.amount > 0 && <Text style={styles.cardAmount}>Monto: ${item.amount}</Text>}
                                </View>
                            </View>
                        );
                    })
                )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, paddingTop: 10, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    backBtn: { padding: 5 },

    form: { padding: 20 },
    label: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
    typeCard: { width: '48%', backgroundColor: '#111', padding: 15, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#222', gap: 8 },
    typeLabel: { color: '#666', fontSize: 12, fontWeight: 'bold' },

    input: { backgroundColor: '#111', color: '#fff', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
    textArea: { height: 100, textAlignVertical: 'top' },

    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16 },

    divider: { height: 1, backgroundColor: '#222', marginVertical: 30 },
    sectionTitle: { color: '#d4af37', fontSize: 14, fontWeight: '900', marginBottom: 20, letterSpacing: 2 },

    incidentCard: { backgroundColor: '#111', padding: 15, borderRadius: 15, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-start', borderWidth: 1, borderColor: '#222' },
    iconBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
    cardType: { color: '#fff', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    cardDate: { color: '#666', fontSize: 10 },
    cardDesc: { color: '#aaa', fontSize: 14, lineHeight: 20 },
    cardAmount: { color: '#e74c3c', fontSize: 12, fontWeight: 'bold', marginTop: 5 }
});
