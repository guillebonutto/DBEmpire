import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width } = Dimensions.get('window');

export default function LoginScreen({ navigation }) {
    const [loading, setLoading] = useState(false);

    const handleSelectUser = async (role) => {
        setLoading(true);
        // Simulate a sleek loading delay for effect
        setTimeout(async () => {
            try {
                await AsyncStorage.setItem('user_role', role);
                setLoading(false);
                navigation.replace('Home');
            } catch (error) {
                setLoading(false);
            }
        }, 800);
    };

    const RoleCard = ({ role, title, subtitle, icon, color, onPress }) => (
        <TouchableOpacity
            style={styles.cardContainer}
            activeOpacity={0.9}
            onPress={onPress}
        >
            <View style={[styles.iconContainer, { backgroundColor: color + '15', borderColor: color }]}>
                <MaterialCommunityIcons name={icon} size={32} color={color} />
            </View>
            <View style={styles.textContainer}>
                <Text style={[styles.cardTitle, { color: color }]}>{title}</Text>
                <Text style={styles.cardSubtitle}>{subtitle}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#555" />
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={['#000000', '#1a1a1a', '#000000']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.background}
            />

            <SafeAreaView style={styles.content}>
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <MaterialCommunityIcons name="bullseye-arrow" size={60} color="#d4af37" />
                    </View>
                    <Text style={styles.appName}>DIGITAL BOOST</Text>
                    <Text style={styles.appTagline}>EMPIRE</Text>
                </View>

                <View style={styles.cardSection}>
                    <Text style={styles.sectionTitle}>IDENTIFÍCATE</Text>

                    <RoleCard
                        role="admin"
                        title="SOY EL LÍDER"
                        subtitle="Gestión Total & Finanzas"
                        icon="crown"
                        color="#d4af37" // Gold
                        onPress={() => handleSelectUser('admin')}
                    />

                    <RoleCard
                        role="seller"
                        title="SOY EL ALIADO"
                        subtitle="Ventas, Clientes & Caja"
                        icon="sword-cross"
                        color="#bdc3c7" // Silver
                        onPress={() => handleSelectUser('seller')}
                    />
                </View>

                {loading && (
                    <View style={styles.loadingOverlay}>
                        <ActivityIndicator size="large" color="#d4af37" />
                        <Text style={styles.loadingText}>Accediendo al Imperio...</Text>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    background: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
    content: { flex: 1, justifyContent: 'center', padding: 25 },
    header: { alignItems: 'center', marginBottom: 60 },
    logoContainer: {
        width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center', alignItems: 'center', marginBottom: 20,
        borderWidth: 2, borderColor: '#d4af37'
    },
    appName: { fontSize: 32, fontWeight: '900', color: '#d4af37', letterSpacing: 2, textTransform: 'uppercase' }, // Gold Text
    appTagline: { fontSize: 14, color: '#bdc3c7', letterSpacing: 6, marginTop: 5, textTransform: 'uppercase' }, // Silver Text

    cardSection: {
        backgroundColor: '#121212',
        borderRadius: 20,
        padding: 25,
        borderWidth: 1,
        borderColor: '#333',
        shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 15, elevation: 10
    },
    sectionTitle: { fontSize: 14, fontWeight: '700', color: '#666', marginBottom: 20, textAlign: 'center', letterSpacing: 2 },

    cardContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1e1e1e', borderRadius: 12, padding: 18, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    iconContainer: { width: 50, height: 50, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 15, borderWidth: 1 },
    textContainer: { flex: 1 },
    cardTitle: { fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 },
    cardSubtitle: { fontSize: 12, color: '#888', marginTop: 4 },

    loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
    loadingText: { color: '#d4af37', marginTop: 15, fontWeight: '600', letterSpacing: 1 }
});
