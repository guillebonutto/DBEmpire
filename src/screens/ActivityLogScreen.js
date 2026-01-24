import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, StatusBar, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SecurityService } from '../services/securityService';
import { LinearGradient } from 'expo-linear-gradient';

export default function ActivityLogScreen({ navigation }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const data = await SecurityService.getLogs(50);
            setLogs(data || []);
        } catch (error) {
            console.log('Error fetching logs:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderLogItem = ({ item }) => {
        let icon = 'information';
        let color = '#3498db';

        if (item.action_type.includes('DELETE')) {
            icon = 'delete-alert';
            color = '#e74c3c';
        } else if (item.action_type.includes('EDIT') || item.action_type.includes('UPDATE')) {
            icon = 'file-edit';
            color = '#f1c40f';
        } else if (item.action_type.includes('SALE')) {
            icon = 'cash-check';
            color = '#2ecc71';
        }

        return (
            <View style={[styles.logCard, { borderLeftColor: color }]}>
                <View style={styles.logHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <MaterialCommunityIcons name={icon} size={20} color={color} />
                        <Text style={[styles.logAction, { color: color }]}>{item.action_type}</Text>
                    </View>
                    <Text style={styles.logDate}>{new Date(item.created_at).toLocaleString()}</Text>
                </View>
                <Text style={styles.logDesc}>{item.description}</Text>
                <View style={styles.logFooter}>
                    <Text style={styles.logMeta}>Role: {item.user_role}</Text>
                    <Text style={styles.logMeta}>Device: {item.device_sig ? item.device_sig.substring(0, 8) + '...' : 'Unknown'}</Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>AUDITORÍA DE SEGURIDAD</Text>
                    <TouchableOpacity onPress={fetchLogs}>
                        <MaterialCommunityIcons name="refresh" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {loading && (
                <View style={styles.loading}>
                    <ActivityIndicator size="large" color="#d4af37" />
                </View>
            )}

            <FlatList
                data={logs}
                keyExtractor={item => item.id.toString()}
                renderItem={renderLogItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={<Text style={styles.empty}>No hay actividad sospechosa registrada.</Text>}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    list: { padding: 20 },

    logCard: {
        backgroundColor: '#111',
        borderRadius: 8,
        padding: 15,
        marginBottom: 12,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: '#222'
    },
    logHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    logAction: { fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
    logDate: { color: '#666', fontSize: 10 },
    logDesc: { color: '#ddd', fontSize: 13, marginBottom: 8 },
    logFooter: { flexDirection: 'row', gap: 15 },
    logMeta: { color: '#555', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

    loading: { padding: 20, alignItems: 'center' },
    empty: { color: '#666', textAlign: 'center', marginTop: 50, fontStyle: 'italic' }
});
