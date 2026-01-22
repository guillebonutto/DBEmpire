import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, ActivityIndicator, Alert, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { GeminiService } from '../services/geminiService';
import { supabase } from '../services/supabase';
import { DeviceAuthService } from '../services/deviceAuth';
import { LinearGradient } from 'expo-linear-gradient';

// Helper for base64 to ArrayBuffer for Supabase Storage (React Native compatible)
const decode = (base64) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const lookup = new Uint8Array(256);
    for (let i = 0; i < chars.length; i++) {
        lookup[chars.charCodeAt(i)] = i;
    }

    let bufferLength = base64.length * 0.75;
    let len = base64.length;
    let i, p = 0;
    let encoded1, encoded2, encoded3, encoded4;

    if (base64[base64.length - 1] === '=') {
        bufferLength--;
        if (base64[base64.length - 2] === '=') {
            bufferLength--;
        }
    }

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const bytes = new Uint8Array(arrayBuffer);

    for (i = 0; i < len; i += 4) {
        encoded1 = lookup[base64.charCodeAt(i)];
        encoded2 = lookup[base64.charCodeAt(i + 1)];
        encoded3 = lookup[base64.charCodeAt(i + 2)];
        encoded4 = lookup[base64.charCodeAt(i + 3)];

        bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
        if (p < bufferLength) bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
        if (p < bufferLength) bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
    }

    return arrayBuffer;
};

export default function AssetsScreen({ navigation }) {
    const [image, setImage] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [copies, setCopies] = useState([]);
    const [scripts, setScripts] = useState([]);
    const [isPcMode, setIsPcMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.All,
            allowsEditing: true,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
            setImageBase64(result.assets[0].base64);
            setCopies([]); // Reset copies on new image
        }
    };

    const generateCopies = async () => {
        if (!title && !description) {
            Alert.alert('Falta info', 'Pon al menos un título o descripción para que la IA sepa qué guion o copy generar.');
            return;
        }

        setLoading(true);
        try {
            const prompt = `Eres un experto en marketing viral y guionista publicitario.
            Genera material para este contenido:
            - Título: ${title}
            - Contexto: ${description}
            
            NECESITO:
            1. Un GUION corto (15s) para video (paso a paso).
            2. 3 OPCIONES de pie de foto (copies) persuasivos.
            
            REGLAS:
            - Devuelve ÚNICAMENTE el contenido solicitado.
            - SIN introducciones.
            - Usa ganchos (hooks) potentes y emojis.
            
            Formato: 
            GUION: [texto]
            OPCION 1: [texto]
            OPCION 2: [texto]
            OPCION 3: [texto]`;

            const result = await GeminiService.handleGeneralRequest(prompt, isPcMode ? null : imageBase64);

            // Parsing script
            const scriptPart = result.split(/OPCION 1:/gi)[0].replace(/GUION:/gi, '').trim();
            setScripts([scriptPart]);

            // Parsing copies
            const parts = result.split(/OPCION \d[:.-]/gi);
            const cleanCopies = parts
                .slice(1)
                .map(p => p.trim().replace(/[*#]/g, ''))
                .filter(p => p.length > 0);

            setCopies(cleanCopies);
        } catch (error) {
            Alert.alert('Error IA', error.message);
        } finally {
            setLoading(false);
        }
    };

    const uploadToStorage = async (uri, base64) => {
        try {
            const fileName = `asset_${Date.now()}.${uri.split('.').pop()}`;
            const filePath = `${fileName}`;

            // Convert base64 to ArrayBuffer (Supabase requires this for some environments)

            const { data, error } = await supabase.storage
                .from('assets')
                .upload(filePath, decode(base64), {
                    contentType: uri.endsWith('mp4') ? 'video/mp4' : 'image/jpeg'
                });

            if (error) throw error;

            const { data: publicUrlData } = supabase.storage
                .from('assets')
                .getPublicUrl(filePath);

            return publicUrlData.publicUrl;
        } catch (error) {
            console.error('Storage Error:', error);
            throw new Error('No se pudo subir el archivo a la nube. ¿Creaste el bucket "assets" en Supabase?');
        }
    };

    const handleSaveAndShare = async () => {
        if (!image && !isPcMode) return;

        setSaving(true);
        try {
            const deviceSig = await DeviceAuthService.getDeviceSignature();

            let cloudUrl = null;
            if (image) {
                cloudUrl = await uploadToStorage(image, imageBase64);
            } else if (isPcMode) {
                cloudUrl = 'PC_WORK_BRIDGE';
            }

            // Save to database
            const { error } = await supabase.from('assets').insert({
                device_sig: deviceSig,
                title,
                description,
                ai_copies: copies,
                media_url: cloudUrl,
                status: isPcMode ? 'pc_done' : 'pending'
            });

            if (error) throw error;

            // Share text
            let shareText = isPcMode ? `🖥️ *MATERIAL PARA MI PC* 🖥️\n\n` : `🚀 *NUEVO MATERIAL DE MARKETING* 🚀\n\n`;
            shareText += `📌 *${title}*\n`;
            shareText += `📝 *Contexto:* ${description}\n\n`;

            if (scripts.length > 0) {
                shareText += `🎬 *GUION:* \n${scripts[0]}\n\n`;
            }

            if (copies.length > 0) {
                shareText += `✨ *COPIES:* \n- ${copies[0]}\n\n`;
            }

            shareText += isPcMode ? `¡Copiado desde la App Imperial para trabajar en PC!` : `¡Líder, ya subí el archivo a la base de datos!`;

            await Share.share({
                message: shareText
            });

            Alert.alert('✅ ¡Listo!', isPcMode ? 'Enviado a tu WhatsApp para usar en PC.' : 'Material guardado y compartido con el Líder.');
            navigation.goBack();
        } catch (error) {
            Alert.alert('Error al guardar', error.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="chevron-left" size={30} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>CREADOR DE CONTENIDO</Text>
                    <View style={{ width: 30 }} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll}>
                    <View style={styles.pcModeToggle}>
                        <Text style={styles.pcModeText}>ESTOY TRABAJANDO EN LA PC</Text>
                        <TouchableOpacity
                            onPress={() => {
                                setIsPcMode(!isPcMode);
                                if (!isPcMode) setImage(null); // Clear image if switching to PC
                            }}
                            style={[styles.toggleBtn, isPcMode && styles.toggleActive]}
                        >
                            <MaterialCommunityIcons
                                name={isPcMode ? "monitor" : "cellphone"}
                                size={20}
                                color={isPcMode ? "#d4af37" : "#666"}
                            />
                        </TouchableOpacity>
                    </View>

                    {!isPcMode ? (
                        <TouchableOpacity style={styles.imageBox} onPress={pickImage}>
                            {image ? (
                                <Image source={{ uri: image }} style={styles.preview} />
                            ) : (
                                <View style={styles.placeholder}>
                                    <MaterialCommunityIcons name="camera-plus" size={40} color="#644" />
                                    <Text style={styles.placeholderText}>Subir Video/Foto para Copiar</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    ) : (
                        <View style={[styles.imageBox, { borderStyle: 'solid', backgroundColor: '#050505' }]}>
                            <MaterialCommunityIcons name="lightning-bolt" size={40} color="#d4af37" />
                            <Text style={[styles.placeholderText, { color: '#d4af37' }]}>MODO PC ACTIVO</Text>
                            <Text style={{ color: '#444', fontSize: 10, textAlign: 'center', paddingHorizontal: 20, marginTop: 5 }}>
                                La IA te dará el guion y el texto para que lo uses en tu video de computadora.
                            </Text>
                        </View>
                    )}

                    <Text style={styles.label}>Título del Producto / Oferta</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="Ej: Smartwatch T800 Ultra"
                        placeholderTextColor="#444"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <Text style={styles.label}>¿De qué trata el video/foto?</Text>
                    <TextInput
                        style={[styles.input, { height: 80 }]}
                        placeholder="Ej: Unboxing rápido mostrando la pantalla fluida..."
                        placeholderTextColor="#444"
                        value={description}
                        onChangeText={setDescription}
                        multiline
                    />

                    <TouchableOpacity
                        style={[styles.aiBtn, loading && styles.disabled]}
                        onPress={generateCopies}
                        disabled={loading}
                    >
                        {loading ? (
                            <ActivityIndicator color="black" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="auto-fix" size={20} color="black" />
                                <Text style={styles.aiBtnText}>OBTENER GUION Y COPIES</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {scripts.length > 0 && (
                        <View style={styles.copyCard}>
                            <Text style={[styles.copyNum, { color: '#74b9ff' }]}>🎬 GUION SUGERIDO</Text>
                            <Text style={styles.copyText}>{scripts[0]}</Text>
                        </View>
                    )}

                    {copies.map((copy, idx) => (
                        <View key={idx} style={styles.copyCard}>
                            <Text style={styles.copyNum}>OPCIÓN {idx + 1}</Text>
                            <Text style={styles.copyText}>{copy}</Text>
                            <TouchableOpacity
                                style={styles.copyBtn}
                                onPress={() => Share.share({ message: copy })}
                            >
                                <MaterialCommunityIcons name="content-copy" size={16} color="#d4af37" />
                                <Text style={styles.copyBtnText}>USAR ESTE</Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>

                {(image || isPcMode) && (
                    <TouchableOpacity
                        style={styles.saveBtn}
                        onPress={handleSaveAndShare}
                        disabled={saving}
                    >
                        <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.saveGradient}>
                            {saving ? (
                                <ActivityIndicator color="black" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name={isPcMode ? "whatsapp" : "send"} size={20} color="black" />
                                    <Text style={styles.saveBtnText}>
                                        {isPcMode ? "ENVIAR A MI WHATSAPP" : "ENVIAR AL LÍDER"}
                                    </Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20 },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    scroll: { padding: 20 },
    imageBox: { width: '100%', height: 200, backgroundColor: '#0a0a0a', borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', marginBottom: 20 },
    preview: { width: '100%', height: '100%', resizeMode: 'cover' },
    placeholder: { alignItems: 'center' },
    placeholderText: { color: '#666', marginTop: 10, fontWeight: '700' },
    label: { color: '#888', fontSize: 12, fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
    input: { backgroundColor: '#0a0a0a', borderRadius: 12, padding: 15, color: '#fff', borderWeight: 1, borderColor: '#1a1a1a', marginBottom: 20 },
    aiBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d4af37', padding: 15, borderRadius: 12, marginBottom: 20, gap: 10 },
    aiBtnText: { color: '#000', fontWeight: '900', fontSize: 14 },
    disabled: { opacity: 0.5 },

    pcModeToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, backgroundColor: '#0a0a0a', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#1a1a1a' },
    pcModeText: { color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    toggleBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    toggleActive: { borderColor: '#d4af37', backgroundColor: '#d4af3710' },

    copyCard: { backgroundColor: '#0a0a0a', padding: 15, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#1a1a1a' },
    copyNum: { color: '#d4af37', fontSize: 10, fontWeight: '900', marginBottom: 5 },
    copyText: { color: '#ccc', fontSize: 14, lineHeight: 20 },
    copyBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, alignSelf: 'flex-end', gap: 5 },
    copyBtnText: { color: '#d4af37', fontSize: 10, fontWeight: '900' },
    saveBtn: { margin: 20, borderRadius: 15, overflow: 'hidden' },
    saveGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, gap: 10 },
    saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});
