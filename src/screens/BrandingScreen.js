import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, StatusBar, Share, Platform, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import ClassicQRCode from '../components/ClassicQRCode';

const BrandingScreen = ({ navigation }) => {
    const MAIN_LINK = "https://www.instagram.com/dbempire_007/"; // O tu Instagram
    const LOGO_IMPERIAL = require('../../assets/logo_imperial.png');

    const viewShotRef = useRef(null);

    const [customLink, setCustomLink] = useState('');
    const [logoSelection, setLogoSelection] = useState('imperial'); // 'none', 'imperial', 'custom'
    const [customLogoUri, setCustomLogoUri] = useState(null);

    // Si el usuario ingresó un texto que parece una URL pero no tiene el protocolo, se lo agregamos automáticamente.
    // También normalizamos dominios conocidos para asegurar que usen su host canónico (ej: www.tiktok.com)
    // para que lectores como Google Lens los reconozcan con su icono oficial correspondiente en lugar de un mundito genérico.
    let qrValue = customLink.trim() || MAIN_LINK;
    if (qrValue) {
        if (!/^https?:\/\//i.test(qrValue) && (qrValue.includes('.') || qrValue.includes('/'))) {
            qrValue = `https://${qrValue}`;
        }
        try {
            qrValue = qrValue.replace(/^(https?:\/\/)(tiktok\.com|instagram\.com|facebook\.com)/i, '$1www.$2');
        } catch (e) {
            console.log('Error normalizing URL:', e);
        }
    }

    // Determinar qué logo pasarle al QR clásico
    let logoSrcToUse = null;
    if (logoSelection === 'imperial') {
        logoSrcToUse = LOGO_IMPERIAL;
    } else if (logoSelection === 'custom' && customLogoUri) {
        logoSrcToUse = customLogoUri;
    }

    const pickCustomLogo = async () => {
        try {
            // Solicitar permisos de galería
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permiso Requerido', 'Necesitamos acceso a tus fotos para que elijas tu logo.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: [ImagePicker.MediaType.IMAGE],
                allowsEditing: true,
                aspect: [1, 1], // Cuadrado perfecto para el centro del QR
                quality: 0.8
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setCustomLogoUri(result.assets[0].uri);
                setLogoSelection('custom');
            }
        } catch (error) {
            console.log('Error picking logo:', error);
            Alert.alert('Error', 'No se pudo seleccionar la imagen de la galería.');
        }
    };

    const onShare = async () => {
        if (!viewShotRef.current) {
            Alert.alert('Error', 'No se pudo inicializar el generador de imagen.');
            return;
        }

        try {
            // Capturar el contenedor del QR como imagen PNG
            const uri = await viewShotRef.current.capture();
            
            // Verificar si el dispositivo permite compartir archivos
            const isSharingAvailable = await Sharing.isAvailableAsync();
            if (isSharingAvailable) {
                await Sharing.shareAsync(uri, {
                    mimeType: 'image/png',
                    dialogTitle: 'Compartir Código QR Imperial',
                    UTI: 'public.png' // Para compatibilidad con iOS
                });
            } else {
                // Fallback clásico con texto
                await Share.share({
                    message: `Escaneá este código QR del Imperio: ${qrValue}`,
                    url: qrValue
                });
            }
        } catch (error) {
            console.log('Sharing error:', error);
            // Fallback en caso de fallo de captura
            try {
                await Share.share({
                    message: `Escaneá este código QR del Imperio: ${qrValue}`,
                    url: qrValue
                });
            } catch (err) {
                Alert.alert('Error', 'No se pudo compartir el código QR.');
            }
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

                <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
                    <View style={styles.content}>
                        <View style={styles.qrArtContainer}>
                            {/* Capturador de Imagen */}
                            <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }} style={{ backgroundColor: '#ffffff', borderRadius: 20 }}>
                                {/* El Sello Clásico (Fondo Blanco, Módulos Negros Sólidos) */}
                                <ClassicQRCode
                                    value={qrValue}
                                    size={280}
                                    color="#000000"
                                    backgroundColor="#ffffff"
                                    logoSrc={logoSrcToUse}
                                />
                            </ViewShot>
                        </View>

                        <View style={styles.infoBox}>
                            <Text style={styles.brandTitle}>DIGITAL BOOST EMPIRE</Text>
                            <Text style={styles.brandTagline}>LA MARCA DEL ÉXITO</Text>
                            <Text style={styles.currentLinkText} numberOfLines={1}>{qrValue}</Text>

                            {/* Selector de Logo */}
                            <View style={styles.logoSelectorContainer}>
                                <Text style={styles.inputLabel}>LOGO EN EL CENTRO DEL QR</Text>
                                <View style={styles.logoRow}>
                                    <TouchableOpacity 
                                        style={[styles.logoBtn, logoSelection === 'none' && styles.logoBtnActive]} 
                                        onPress={() => setLogoSelection('none')}
                                    >
                                        <MaterialCommunityIcons name="cancel" size={18} color={logoSelection === 'none' ? '#000' : '#888'} />
                                        <Text style={[styles.logoBtnText, logoSelection === 'none' && styles.logoBtnTextActive]}>Ninguno</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        style={[styles.logoBtn, logoSelection === 'imperial' && styles.logoBtnActive]} 
                                        onPress={() => setLogoSelection('imperial')}
                                    >
                                        <MaterialCommunityIcons name="crown" size={18} color={logoSelection === 'imperial' ? '#000' : '#d4af37'} />
                                        <Text style={[styles.logoBtnText, logoSelection === 'imperial' && styles.logoBtnTextActive]}>Imperial</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity 
                                        style={[styles.logoBtn, logoSelection === 'custom' && styles.logoBtnActive]} 
                                        onPress={pickCustomLogo}
                                    >
                                        <MaterialCommunityIcons name="image" size={18} color={logoSelection === 'custom' ? '#000' : '#888'} />
                                        <Text style={[styles.logoBtnText, logoSelection === 'custom' && styles.logoBtnTextActive]} numberOfLines={1}>
                                            {customLogoUri ? 'Cambiar' : 'Subir'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* Generador Personalizado */}
                            <View style={styles.inputWrapper}>
                                <Text style={styles.inputLabel}>LINK / TEXTO DEL QR PERSONALIZADO</Text>
                                <View style={styles.inputContainer}>
                                    <MaterialCommunityIcons name="link-variant" size={20} color="#d4af37" style={{ marginRight: 10 }} />
                                    <TextInput
                                        style={styles.textInput}
                                        placeholder="Ingresá un link (ej: mercadopago, web, etc.)"
                                        placeholderTextColor="#555"
                                        value={customLink}
                                        onChangeText={setCustomLink}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                    />
                                    {customLink.length > 0 && (
                                        <TouchableOpacity onPress={() => setCustomLink('')}>
                                            <MaterialCommunityIcons name="close-circle" size={18} color="#d4af37" />
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            
                            <TouchableOpacity style={styles.shareBtn} onPress={onShare}>
                                <LinearGradient colors={['#d4af37', '#8e6d13']} style={styles.shareGrad}>
                                    <MaterialCommunityIcons name="share-variant" size={24} color="#000" />
                                    <Text style={styles.shareText}>COMPARTIR QR PERSONALIZADO</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </View>
                </ScrollView>
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
        backgroundColor: '#ffffff', // Fondo blanco sólido para fundirse con el QR clásico
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        shadowColor: '#d4af37',
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
        overflow: 'hidden',
        marginBottom: 35,
        borderWidth: 2,
        borderColor: '#d4af37'
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
    brandTagline: { color: '#d4af37', fontSize: 11, fontWeight: '700', letterSpacing: 6, marginTop: 8, marginBottom: 10 },
    currentLinkText: { color: '#d4af37', fontSize: 11, fontWeight: '600', opacity: 0.7, marginBottom: 15 },
    
    // CUSTOM QR INPUT STYLES
    scrollContainer: {
        flexGrow: 1,
        paddingBottom: 40
    },
    inputWrapper: {
        width: '100%',
        marginBottom: 25,
        paddingHorizontal: 10
    },
    inputLabel: {
        color: '#d4af37',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 8
    },
        inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#d4af3740',
        borderRadius: 15,
        paddingHorizontal: 15,
        height: 55
    },
    textInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
        fontWeight: '600'
    },
    
    // LOGO SELECTOR STYLES
    logoSelectorContainer: {
        width: '100%',
        marginBottom: 20,
        paddingHorizontal: 10
    },
    logoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 10
    },
    logoBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111',
        borderWidth: 1,
        borderColor: '#333',
        borderRadius: 12,
        height: 48,
        gap: 6
    },
    logoBtnActive: {
        backgroundColor: '#d4af37',
        borderColor: '#d4af37'
    },
    logoBtnText: {
        color: '#888',
        fontSize: 12,
        fontWeight: 'bold'
    },
    logoBtnTextActive: {
        color: '#000',
        fontWeight: '900'
    },

    shareBtn: { width: '100%', borderRadius: 20, overflow: 'hidden' },
    shareGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 20, gap: 15 },
    shareText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 1 }
});

export default BrandingScreen;
