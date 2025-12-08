import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function HomeScreen({ navigation }) {
    const [userRole, setUserRole] = useState('seller');

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setUserRole(role);
        });
    }, []);

    const DashboardCard = ({ title, icon, color, onPress, fullWidth }) => (
        <TouchableOpacity
            style={[styles.card, fullWidth ? styles.cardFull : styles.cardHalf, { borderColor: color }]}
            onPress={onPress}
            activeOpacity={0.8}
        >
            <LinearGradient
                colors={['#1e1e1e', '#121212']}
                style={styles.cardGradient}
            >
                <View style={[styles.iconContainer, { backgroundColor: color + '15' }]}>
                    <MaterialCommunityIcons name={icon} size={32} color={color} />
                </View>
                <Text style={[styles.cardTitle, { color: color }]}>{title}</Text>
                <View style={styles.arrowContainer}>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#555" />
                </View>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#121212']}
                style={styles.headerBackground}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
            >
                <SafeAreaView style={styles.headerContent}>
                    <View>
                        <Text style={styles.greeting}>Bienvenido,</Text>
                        <Text style={styles.username}>{userRole === 'admin' ? 'LÍDER' : 'NICO A LA ALIANZA'}</Text>
                    </View>
                    <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.logoutBtn}>
                        <MaterialCommunityIcons name="logout" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.bodyContainer}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    <Text style={styles.sectionLabel}>OPERACIONES DEL IMPERIO</Text>
                    <View style={styles.grid}>
                        <DashboardCard
                            title="NUEVA VENTA"
                            icon="cash-register"
                            color="#d4af37" // GOLD
                            onPress={() => navigation.navigate('NewSale')}
                            fullWidth
                        />
                        <DashboardCard
                            title="CAJA & CIERRES"
                            icon="chart-line"
                            color="#ecf0f1" // SILVER
                            onPress={() => navigation.navigate('Sales')}
                        />
                        <DashboardCard
                            title="INVENTARIO"
                            icon="package-variant-closed"
                            color="#ecf0f1" // SILVER
                            onPress={() => navigation.navigate('Stock')}
                        />
                    </View>

                    <Text style={styles.sectionLabel}>GESTIÓN & RECURSOS</Text>
                    <View style={styles.grid}>
                        <DashboardCard
                            title="CLIENTES"
                            icon="account-group"
                            color="#a29bfe"
                            onPress={() => navigation.navigate('Clients')}
                        />
                        <DashboardCard
                            title="PROMOS"
                            icon="tag-multiple"
                            color="#e74c3c"
                            onPress={() => navigation.navigate('Promotions')}
                        />
                        <DashboardCard
                            title="EQUIPO"
                            icon="shield-account"
                            color="#95a5a6"
                            onPress={() => navigation.navigate('Admin')}
                            fullWidth
                        />
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' }, // Pure black bg
    headerBackground: { paddingBottom: 30, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
    greeting: { color: '#888', fontSize: 14, letterSpacing: 1 },
    username: { color: '#d4af37', fontSize: 24, fontWeight: '900', letterSpacing: 1 },
    logoutBtn: { padding: 10, backgroundColor: '#222', borderRadius: 12, borderWidth: 1, borderColor: '#333' },

    bodyContainer: { flex: 1, marginTop: 10 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
    sectionLabel: { fontSize: 12, fontWeight: '900', color: '#555', marginBottom: 15, marginTop: 15, letterSpacing: 2 },

    grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    card: { borderRadius: 15, marginBottom: 15, borderWidth: 1, overflow: 'hidden' }, // Border coloring handled in component
    cardFull: { width: '100%' },
    cardHalf: { width: '48%' },
    cardGradient: { padding: 20, borderRadius: 15, height: 140, justifyContent: 'space-between' },
    iconContainer: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: 14, fontWeight: 'bold', letterSpacing: 1 }, // Color injected
    arrowContainer: { alignItems: 'flex-end' }
});
