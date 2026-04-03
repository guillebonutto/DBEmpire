import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar, Share, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DotQRCode from '../components/DotQRCode';

const BrandingScreen = ({ navigation }) => {
    const MAIN_LINK = "https://www.instagram.com/dbempire_007/"; // O tu Instagram
    const LOGO_IMPERIAL = require('../../assets/logo_imperial.png');

    const onShare = async () => {
        try {
            await Share.share({
                message: `Sumate al Imperio de Digital Boost Empire: ${MAIN_LINK}`,
                url: MAIN_LINK
            });
        } catch (error) {
            console.log(error);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#0a0a0a', '#000']} style={styles.background} />
            
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={32} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>EL SELLO DEL IMPERIO</Text>
                    <View style={{ width: 32 }} />
                </View>

                <View style={styles.content}>
                    <View style={styles.qrArtContainer}>
                        {/* El Logo de Fondo (Contraste ajustado para lectura) */}
                        <Image source={LOGO_IMPERIAL} style={styles.backgroundLogo} />
                        
                        {/* El Sello de PUNTOS (Halftone Imperial) */}
                        <View style={styles.qrOverlay}>
                            <DotQRCode
                                value={MAIN_LINK}
                                size={280}
                                dotColor="#d4af37"
                                centerSize={0.32} // Ajustado para ser más legible
                                dotScale={0.88}   // Puntos más gorditos para que el Celu lo lea 100%
                            />
                        </View>
                    </View>

                    <View style={styles.infoBox}>
                        <Text style={styles.brandTitle}>DIGITAL BOOST EMPIRE</Text>
                        <Text style={styles.brandTagline}>LA MARCA DEL ÉXITO</Text>
                        
                        <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                            <LinearGradient colors={['#d4af37', '#8e6d13']} style={styles.shareGrad}>
                                <MaterialCommunityIcons name="whatsapp" size={24} color="#000" />
                                <Text style={styles.shareText}>COMPARTIR EL SELLO</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    background: { ...StyleSheet.absoluteFillObject },
    safe: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10 },
    headerTitle: { color: '#d4af37', fontSize: 13, fontWeight: '900', letterSpacing: 3 },
    content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
    
    // EL SELLO (CAPAS)
    qrArtContainer: {
        width: 320,
        height: 320,
        backgroundColor: '#000', // Fondo negro para máximo contraste con el dorado
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#d4af37',
        shadowOpacity: 0.5,
        shadowRadius: 20,
        elevation: 15,
        overflow: 'hidden',
        marginBottom: 50,
        borderWidth: 1,
        borderColor: '#d4af3750'
    },
    backgroundLogo: {
        width: '95%',
        height: '95%',
        position: 'absolute',
        opacity: 0.7, // Lo bajamos un poquito para que el QR sea el héroe
        resizeMode: 'contain'
    },
    qrOverlay: {
        zIndex: 10,
        backgroundColor: 'transparent',
        padding: 10
    },
    
    // Marcadores estilizados (más robustos)
    customEye: {
        position: 'absolute',
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 10,
        borderColor: '#d4af37',
        backgroundColor: 'white'
    },
    customEyeSmall: {
        position: 'absolute',
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 6,
        borderColor: '#d4af37',
        backgroundColor: 'white'
    },

    infoBox: { alignItems: 'center', width: '100%' },
    brandTitle: { color: '#fff', fontSize: 22, fontWeight: '900', letterSpacing: 4 },
    brandTagline: { color: '#d4af37', fontSize: 11, fontWeight: '700', letterSpacing: 6, marginTop: 8, marginBottom: 40 },
    
    shareBtn: { width: '100%', borderRadius: 20, overflow: 'hidden' },
    shareGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 22, gap: 15 },
    shareText: { color: '#000', fontWeight: '900', fontSize: 15, letterSpacing: 1 }
});

export default BrandingScreen;
