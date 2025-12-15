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

    // Small Icon for Top Right
    const HeaderIcon = ({ icon, onPress }) => (
        <TouchableOpacity style={styles.headerIconBtn} onPress={onPress}>
            <MaterialCommunityIcons name={icon} size={24} color="#d4af37" />
        </TouchableOpacity>
    );

    // Original Dashboard Card Component
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
                    <View style={styles.topRow}>
                        <View>
                            <Text style={styles.greeting}>Bienvenido,</Text>
                            <Text style={styles.username}>{userRole === 'admin' ? 'LÍDER' : 'NICO A LA ALIANZA'}</Text>
                        </View>
                        <TouchableOpacity onPress={() => navigation.replace('Login')} style={styles.logoutBtn}>
                            <MaterialCommunityIcons name="logout" size={20} color="#666" />
                        </TouchableOpacity>
                    </View>

                    {/* Secondary Functions Top Right */}
                    <View style={styles.secondaryActionsContainer}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.secondaryScroll}>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <HeaderIcon icon="truck-delivery" onPress={() => navigation.navigate('Orders')} />
                                <View style={{ width: 15 }} />
                                <HeaderIcon icon="airplane" onPress={() => navigation.navigate('SupplierOrders')} />
                                <View style={{ width: 15 }} />
                                <HeaderIcon icon="package-variant-closed" onPress={() => navigation.navigate('Stock')} />
                                <View style={{ width: 15 }} />
                                <HeaderIcon icon="chart-line" onPress={() => navigation.navigate('Sales')} />
                                <View style={{ width: 15 }} />
                                <HeaderIcon icon="account-group" onPress={() => navigation.navigate('Clients')} />
                                <View style={{ width: 15 }} />
                                <HeaderIcon icon="tag-multiple" onPress={() => navigation.navigate('Promotions')} />
                                <View style={{ width: 15 }} />
                                <HeaderIcon icon="shield-account" onPress={() => navigation.navigate('Admin')} />
                            </View>
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </LinearGradient>

            <View style={styles.bodyContainer}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                    <Text style={styles.sectionLabel}>OPERACIONES DEL IMPERIO</Text>

                    {/* Main Action - Nueva Venta using Original Card Style */}
                    <DashboardCard
                        title="NUEVA VENTA"
                        icon="cash-register"
                        color="#d4af37"
                        onPress={() => navigation.navigate('NewSale')}
                        fullWidth
                    />
                </ScrollView>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    headerBackground: { paddingBottom: 15, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerContent: { marginTop: 10 },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    greeting: { color: '#888', fontSize: 12, letterSpacing: 1 },
    username: { color: '#d4af37', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
    logoutBtn: { padding: 8, backgroundColor: '#1a1a1a', borderRadius: 8, borderWidth: 1, borderColor: '#333' },

    secondaryActionsContainer: { flexDirection: 'row', justifyContent: 'flex-end' },
    secondaryScroll: { paddingRight: 5 },
    headerIconBtn: { width: 40, height: 40, backgroundColor: '#1a1a1a', borderRadius: 10, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },

    bodyContainer: { flex: 1, marginTop: 10 },
    scrollContent: { paddingHorizontal: 20 },
    sectionLabel: { fontSize: 12, fontWeight: '900', color: '#555', marginBottom: 15, marginTop: 15, letterSpacing: 2 },

    // Original Card Styles preserved
    card: { borderRadius: 15, marginBottom: 15, borderWidth: 1, overflow: 'hidden' },
    cardFull: { width: '100%' },
    cardHalf: { width: '48%' },
    cardGradient: { padding: 20, borderRadius: 15, height: 140, justifyContent: 'space-between' },
    iconContainer: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: 14, fontWeight: 'bold', letterSpacing: 1 },
    arrowContainer: { alignItems: 'flex-end' }
});
