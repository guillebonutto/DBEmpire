import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, Share, Image,
    ActivityIndicator, StatusBar, Platform, Modal, ScrollView, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { GlobalDataService } from '../services/GlobalDataService';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { WebView } from 'react-native-webview';
import QRCode from 'react-native-qrcode-svg';
import JSZip from 'jszip';
import { logoBase64 } from '../assets/logoBase64';

// Logos para los QR kits
const WA_LOGO = require('../assets/WhatsApp.png');
const TT_LOGO = require('../assets/Tiktok-Logo-Black-Innovative-Design-Concept-PNG-thumb.png');
const IG_LOGO = require('../assets/Instagram.png');

export default function CatalogScreen({ navigation }) {
    const [products, setProducts] = useState(GlobalDataService.getProducts());
    const [loading, setLoading] = useState(products.length === 0);
    const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'qr'

    // --- QR Factory state ---
    const [generatingAll, setGeneratingAll] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentGenerating, setCurrentGenerating] = useState(null);
    const waRef = useRef();
    const igRef = useRef();
    const ttRef = useRef();

    // --- Poster PDF state ---
    const [posterHtml, setPosterHtml] = useState(null);
    const [showPosterWebView, setShowPosterWebView] = useState(false);
    const webViewRef = useRef(null);

    useEffect(() => { fetchProducts(); }, []);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            await GlobalDataService.preloadAll();
            const fresh = GlobalDataService.getProducts();
            if (fresh.length > 0) {
                setProducts(fresh);
            } else {
                const { data } = await supabase
                    .from('products')
                    .select('*')
                    .eq('active', true)
                    .order('name');
                if (data) setProducts(data);
            }
        } catch (e) { console.log(e); }
        finally { setLoading(false); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // CATÁLOGO TAB — Poster PDF logic (from the Telegram version)
    // ─────────────────────────────────────────────────────────────────────────

    const shareViaText = async () => {
        let catalogText = "👑 *DIGITAL BOOST EMPIRE - Catálogo Virtual* 👑\n\n";
        products.forEach(p => {
            catalogText += `🔹 *${p.name}*\n💰 Precio: $${p.sale_price}\n${p.description ? p.description + '\n' : ''}\n`;
        });
        catalogText += "\n🚀 ¡Haz tu pedido ahora!";
        try {
            await Share.share({ message: catalogText, title: 'Mi Catálogo Digital' });
        } catch (error) { Alert.alert('Error', error.message); }
    };

    const generatePosterPDF = async () => {
        setLoading(true);
        try {
            const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=" +
                encodeURIComponent("https://www.instagram.com/dbempire_007/") + "&ecc=H&color=000&bgcolor=fff";

            const findHero = (keywords) =>
                products.find(p => keywords.some(k => p.name.toLowerCase().includes(k.toLowerCase()))) || products[0];

            const hero1 = findHero(['RFID', 'Blocking']);
            const hero2 = findHero(['Powerbank', 'Batería']);
            const hero3 = findHero(['Cable', 'Carga']);
            const heroes = [hero1, hero2, hero3].filter(Boolean);

            const catalog8 = products
                .filter(p => !p.name.toLowerCase().includes('combo'))
                .filter(p => !heroes.some(h => h && h.id === p.id))
                .slice(0, 8);

            const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Roboto:wght@300;400;700&display=swap');
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    body { background: #0a0a0a; color: #fff; font-family: 'Roboto', sans-serif; width: 1000px; margin: 0; padding: 0; }
                    .poster {
                        width: 1000px; min-height: 1500px; padding: 50px 50px 40px;
                        display: flex; flex-direction: column; position: relative;
                        background-color: #0a0a0a; overflow: hidden;
                    }
                    .bg-lines { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; pointer-events: none; }
                    .header, .subtitle-line, .section-title, .heroes-section, .catalog-grid, .footer { position: relative; z-index: 2; }
                    .header { display: flex; flex-direction: column; align-items: center; margin-bottom: 10px; }
                    .logo-wrapper { position: relative; width: 340px; height: 340px; display: flex; align-items: center; justify-content: center; }
                    .logo-glow-svg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
                    .logo-frame {
                        position: relative; z-index: 2; width: 270px; height: 270px;
                        background: linear-gradient(135deg, #b8860b 0%, #f9f295 25%, #e6be8a 50%, #f9f295 75%, #b8860b 100%);
                        padding: 6px; border-radius: 4px; display: flex; align-items: center; justify-content: center;
                        box-shadow: 0 0 30px rgba(0,0,0,0.5);
                    }
                    .logo-img { width: 100%; height: 100%; object-fit: contain; background: #000; border-radius: 2px; position: relative; z-index: 3; }
                    .subtitle-line { margin-top: 10px; margin-bottom: 30px; padding-left: 10px; border-left: 4px solid #d4af37; }
                    .subtitle { font-family: 'Orbitron', sans-serif; color: #d4af37; font-size: 22px; font-weight: 700; letter-spacing: 3px; text-transform: uppercase; }
                    .section-title { font-family: 'Orbitron', sans-serif; text-align: center; margin-bottom: 20px; letter-spacing: 3px; font-size: 22px; color: #fff; border-bottom: 1px solid rgba(212,175,55,0.35); padding-bottom: 10px; }
                    .heroes-section { display: flex; justify-content: space-between; gap: 18px; margin-bottom: 35px; }
                    .hero-card { flex: 1; background: rgba(20,20,20,0.9); border: 1px solid rgba(212,175,55,0.5); border-radius: 16px; padding: 16px; text-align: center; }
                    .hero-img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 10px; margin-bottom: 12px; background: #111; }
                    .hero-label { font-family: 'Orbitron', sans-serif; color: #d4af37; font-weight: 900; font-size: 15px; text-transform: uppercase; letter-spacing: 1px; }
                    .catalog-grid { display: flex; flex-wrap: wrap; gap: 14px; margin-bottom: 30px; }
                    .grid-item { width: calc(25% - 11px); background: #111; border: 1px solid rgba(212,175,55,0.25); border-radius: 12px; overflow: hidden; display: flex; flex-direction: column; }
                    .grid-img { width: 100%; aspect-ratio: 1/1; object-fit: cover; background: #0d0d0d; display: block; }
                    .grid-info { padding: 8px 10px; }
                    .item-name { font-size: 14px; color: #ccc; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; margin-bottom: 3px; }
                    .item-price { font-weight: 900; color: #d4af37; font-size: 16px; }
                    .footer { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; padding-top: 20px; border-top: 1px solid rgba(212,175,55,0.3); }
                    .footer-cta { color: #888; font-size: 12px; font-weight: 700; letter-spacing: 1px; margin-bottom: 6px; text-transform: uppercase; }
                    .handle { font-size: 32px; font-family: 'Orbitron', sans-serif; font-weight: 900; color: #fff; }
                    .whatsapp { font-size: 20px; color: #d4af37; font-weight: 700; margin-top: 6px; }
                    .qr-container { display: flex; flex-direction: column; align-items: center; gap: 8px; }
                    .qr-img { width: 130px; height: 130px; background: #fff; padding: 6px; border-radius: 6px; border: 2px solid #d4af37; }
                    .qr-label { color: #d4af37; font-family: 'Orbitron', sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; }
                </style>
            </head>
            <body>
                <div class="poster">
                    <svg class="bg-lines" viewBox="0 0 1000 1500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice">
                        <line x1="60" y1="0" x2="60" y2="320" stroke="#d4af37" stroke-width="1" stroke-opacity="0.35"/>
                        <line x1="60" y1="320" x2="180" y2="320" stroke="#d4af37" stroke-width="1" stroke-opacity="0.35"/>
                        <line x1="180" y1="320" x2="180" y2="480" stroke="#d4af37" stroke-width="1" stroke-opacity="0.35"/>
                        <circle cx="60" cy="320" r="4" fill="#d4af37" fill-opacity="0.6"/>
                        <circle cx="180" cy="320" r="4" fill="#d4af37" fill-opacity="0.6"/>
                        <line x1="940" y1="0" x2="940" y2="280" stroke="#d4af37" stroke-width="1" stroke-opacity="0.35"/>
                        <line x1="940" y1="280" x2="820" y2="280" stroke="#d4af37" stroke-width="1" stroke-opacity="0.35"/>
                        <circle cx="940" cy="280" r="4" fill="#d4af37" fill-opacity="0.6"/>
                        <circle cx="820" cy="280" r="4" fill="#d4af37" fill-opacity="0.6"/>
                        <line x1="60" y1="1250" x2="200" y2="1250" stroke="#d4af37" stroke-width="1" stroke-opacity="0.25"/>
                        <circle cx="60" cy="1250" r="3" fill="#d4af37" fill-opacity="0.4"/>
                        <line x1="940" y1="1250" x2="800" y2="1250" stroke="#d4af37" stroke-width="1" stroke-opacity="0.25"/>
                        <circle cx="940" cy="1250" r="3" fill="#d4af37" fill-opacity="0.4"/>
                    </svg>

                    <div class="header">
                        <div class="logo-wrapper">
                            <svg class="logo-glow-svg" viewBox="0 0 340 340" xmlns="http://www.w3.org/2000/svg">
                                <defs>
                                    <radialGradient id="logoGlow1" cx="50%" cy="50%" r="50%">
                                        <stop offset="0%" stop-color="#d4af37" stop-opacity="0.9"/>
                                        <stop offset="60%" stop-color="#d4af37" stop-opacity="0.15"/>
                                        <stop offset="100%" stop-color="#d4af37" stop-opacity="0"/>
                                    </radialGradient>
                                </defs>
                                <ellipse cx="170" cy="170" rx="160" ry="160" fill="url(#logoGlow1)"/>
                            </svg>
                            <div class="logo-frame">
                                <img src="${logoBase64}" class="logo-img" />
                            </div>
                        </div>
                    </div>

                    <div class="subtitle-line">
                        <div class="subtitle">Gadgets de Seguridad Digital y Carga Rápida</div>
                    </div>

                    <div class="section-title">PRODUCTOS DESTACADOS</div>
                    <div class="heroes-section">
                        ${heroes.map(p => `
                            <div class="hero-card">
                                <img src="${p.image_url}" class="hero-img" crossorigin="anonymous" />
                                <div class="hero-label">${p.name.split(' ').slice(0, 3).join(' ')}</div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="section-title">CATÁLOGO</div>
                    <div class="catalog-grid">
                        ${catalog8.map(p => `
                            <div class="grid-item">
                                <img src="${p.image_url}" class="grid-img" crossorigin="anonymous" />
                                <div class="grid-info">
                                    <div class="item-name">${p.name}</div>
                                    <div class="item-price">$${p.sale_price}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div class="footer">
                        <div>
                            <div class="footer-cta">SOLICITÁ TU PEDIDO // PRECIOS POR DM</div>
                            <div class="handle">@dbempire_007</div>
                            <div class="whatsapp">WhatsApp: +54 388 419-7137</div>
                        </div>
                        <div class="qr-container">
                            <img src="${qrUrl}" class="qr-img" crossorigin="anonymous" />
                            <div class="qr-label">INSTAGRAM OFICIAL</div>
                        </div>
                    </div>
                </div>

                <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
                <script>
                    window.onload = function() {
                        setTimeout(function() {
                            var el = document.querySelector('.poster');
                            html2canvas(el, { scale: 3, useCORS: true, backgroundColor: '#0a0a0a', logging: false })
                                .then(function(canvas) {
                                    if (typeof window.ReactNativeWebView !== 'undefined') {
                                        window.ReactNativeWebView.postMessage(canvas.toDataURL('image/png', 1.0));
                                    } else {
                                        var link = document.createElement('a');
                                        link.href = canvas.toDataURL('image/png', 1.0);
                                        link.download = 'Poster_DigitalBoostEmpire.png';
                                        link.click();
                                    }
                                })
                                .catch(function() {
                                    if (typeof window.ReactNativeWebView !== 'undefined') {
                                        window.ReactNativeWebView.postMessage('error');
                                    }
                                });
                        }, 2000);
                    };
                </script>
            </body>
            </html>`;

            if (Platform.OS === 'web') {
                const blob = new Blob([htmlContent], { type: 'text/html' });
                const blobUrl = URL.createObjectURL(blob);
                const printWindow = window.open(blobUrl, '_blank');
                if (!printWindow) Alert.alert('Bloqueado', 'Permití las ventanas emergentes e intentá de nuevo.');
            } else {
                setPosterHtml(htmlContent);
                setShowPosterWebView(true);
            }
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo generar el póster: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleWebViewMessage = async (event) => {
        try {
            const base64Data = event.nativeEvent.data;
            if (!base64Data || base64Data === 'error') {
                setShowPosterWebView(false);
                Alert.alert('Error', 'No se pudo generar la imagen del póster.');
                return;
            }
            const base64 = base64Data.replace('data:image/png;base64,', '');
            const fileUri = FileSystem.cacheDirectory + 'poster_dbempire.png';
            await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
            setShowPosterWebView(false);
            await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: 'Guardar Póster' });
        } catch (err) {
            console.error(err);
            setShowPosterWebView(false);
            Alert.alert('Error', 'No se pudo guardar la imagen: ' + err.message);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // QR TAB — QR Kit factory logic (original CatalogScreen logic)
    // ─────────────────────────────────────────────────────────────────────────

    const getQrUrl = (product, platform) => {
        const phone = "543884197137";
        const igUser = "dbempire_007";
        const ttUser = "dbempire.007";
        const code = product?.barcode || product?.id || "000";
        if (!product) return "https://dbempire.com";
        switch (platform) {
            case 'whatsapp':
                return `https://wa.me/${phone}?barcode=${code}&text=${encodeURIComponent(`¡Hola! Me interesa: ${product.name}`)}`;
            case 'instagram':
                return `https://instagram.com/${igUser}?barcode=${code}`;
            case 'tiktok':
                return `https://www.tiktok.com/@${ttUser}?barcode=${code}`;
            default:
                return `https://dbempire.com/p/${code}`;
        }
    };

    const captureQR = async (ref, name) => {
        return new Promise((resolve, reject) => {
            if (!ref || !ref.toDataURL) return reject(`Generador ${name} no disponible`);
            try {
                ref.toDataURL((data) => {
                    if (data) resolve(data);
                    else reject(`Fallo captura de ${name}`);
                });
            } catch (err) { reject(err.message); }
        });
    };

    const processProduct = async (product) => {
        setCurrentGenerating(product);
        await new Promise(r => setTimeout(r, 800));
        const wa = await captureQR(waRef.current, 'WhatsApp');
        const ig = await captureQR(igRef.current, 'Instagram');
        const tt = await captureQR(ttRef.current, 'TikTok');
        return { whatsapp: wa, instagram: ig, tiktok: tt };
    };

    const handleIndividualKit = async (product) => {
        setLoading(true);
        try {
            const kit = await processProduct(product);
            const zip = new JSZip();
            zip.file("WhatsApp.png", kit.whatsapp, { base64: true });
            zip.file("Instagram.png", kit.instagram, { base64: true });
            zip.file("TikTok.png", kit.tiktok, { base64: true });
            if (Platform.OS === 'web') {
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `KIT_${product.name.replace(/\s/g, '_')}.zip`;
                link.click();
            } else {
                const b64 = await zip.generateAsync({ type: 'base64' });
                const fileUri = FileSystem.cacheDirectory + `Kit_${product.name.substring(0, 10)}.zip`;
                await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: 'base64' });
                await Sharing.shareAsync(fileUri);
            }
        } catch (error) {
            Alert.alert('Fábrica QR', 'Falla: ' + error);
        } finally {
            setLoading(false);
            setCurrentGenerating(null);
        }
    };

    const handleBatchProcess = async () => {
        if (products.length === 0) return;
        setGeneratingAll(true);
        try {
            const zip = new JSZip();
            for (let i = 0; i < products.length; i++) {
                const p = products[i];
                setProgress(((i + 1) / products.length) * 100);
                const kit = await processProduct(p);
                const folder = zip.folder(p.name.replace(/[^\w\s]/gi, '') || `Producto_${i}`);
                folder.file("QR_WhatsApp.png", kit.whatsapp, { base64: true });
                folder.file("QR_Instagram.png", kit.instagram, { base64: true });
                folder.file("QR_TikTok.png", kit.tiktok, { base64: true });
            }
            if (Platform.OS === 'web') {
                const blob = await zip.generateAsync({ type: 'blob' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url; link.download = 'DBE_KIT_MARKETING_FULL.zip'; link.click();
            } else {
                const b64 = await zip.generateAsync({ type: 'base64' });
                const fileUri = FileSystem.cacheDirectory + 'Marketing_Imperial.zip';
                await FileSystem.writeAsStringAsync(fileUri, b64, { encoding: 'base64' });
                await Sharing.shareAsync(fileUri);
            }
            Alert.alert('✅ Listo', 'El pack completo fue generado exitosamente.');
        } catch (e) { Alert.alert('Error', 'Fallo en proceso masivo: ' + e); }
        finally { setGeneratingAll(false); setCurrentGenerating(null); setProgress(0); }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    const renderCatalogTab = () => {
        const heroes = products.slice(0, 3);
        const rest = products.slice(3);
        return (
            <ScrollView contentContainerStyle={styles.catalogScroll} showsVerticalScrollIndicator={false}>
                {/* Hero Products */}
                <Text style={styles.sectionLabel}>⭐ DESTACADOS</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.heroRow} contentContainerStyle={{ gap: 12, paddingRight: 20 }}>
                    {heroes.map(item => (
                        <View key={item.id} style={styles.heroCard}>
                            {item.image_url
                                ? <Image source={{ uri: item.image_url }} style={styles.heroImage} />
                                : <View style={[styles.heroImage, styles.noImage]}><MaterialCommunityIcons name="image-off" size={28} color="#333" /></View>
                            }
                            <LinearGradient colors={['transparent', 'rgba(0,0,0,0.95)']} style={styles.heroOverlay}>
                                <Text style={styles.heroName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.heroPrice}>${item.sale_price}</Text>
                            </LinearGradient>
                        </View>
                    ))}
                </ScrollView>

                {/* Full Catalog Grid */}
                <Text style={styles.sectionLabel}>📦 CATÁLOGO COMPLETO</Text>
                <View style={styles.catalogGrid}>
                    {rest.map(item => (
                        <View key={item.id} style={styles.catalogCard}>
                            {item.image_url
                                ? <Image source={{ uri: item.image_url }} style={styles.catalogImage} />
                                : <View style={[styles.catalogImage, styles.noImage]}><MaterialCommunityIcons name="image-off" size={22} color="#333" /></View>
                            }
                            <View style={styles.catalogInfo}>
                                <Text style={styles.catalogName} numberOfLines={2}>{item.name}</Text>
                                <Text style={styles.catalogPrice}>${item.sale_price}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Bottom Action Buttons */}
                <View style={styles.catalogActions}>
                    <TouchableOpacity style={styles.actionBtn} onPress={generatePosterPDF}>
                        <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.actionGradient}>
                            <MaterialCommunityIcons name="file-image-outline" size={20} color="#000" />
                            <Text style={styles.actionText}>GENERAR PÓSTER</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.actionBtn} onPress={shareViaText}>
                        <LinearGradient colors={['#25D366', '#128C7E']} style={styles.actionGradient}>
                            <MaterialCommunityIcons name="whatsapp" size={20} color="#fff" />
                            <Text style={[styles.actionText, { color: '#fff' }]}>COMPARTIR</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        );
    };

    const renderQRItem = useCallback(({ item }) => (
        <View style={styles.productRow}>
            {item.image_url
                ? <Image source={{ uri: item.image_url }} style={styles.productImg} />
                : <View style={[styles.productImg, styles.noImage]}><MaterialCommunityIcons name="image-off" size={18} color="#333" /></View>
            }
            <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.productSub}>ID: {item.barcode || 'S/N'} · ${item.sale_price}</Text>
            </View>
            <TouchableOpacity style={styles.kitBtn} onPress={() => handleIndividualKit(item)}>
                <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.kitGradient}>
                    <MaterialCommunityIcons name="qrcode-scan" size={15} color="#000" />
                    <Text style={styles.kitBtnText}>KIT QR</Text>
                </LinearGradient>
            </TouchableOpacity>
        </View>
    ), [currentGenerating]);

    // ─────────────────────────────────────────────────────────────────────────
    // MAIN RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            {/* Hidden WebView for PNG generation */}
            {showPosterWebView && posterHtml && (
                <Modal visible={true} transparent={false} animationType="none">
                    <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
                        <ActivityIndicator color="#d4af37" size="large" />
                        <Text style={{ color: '#d4af37', marginTop: 20, fontWeight: '900', letterSpacing: 2 }}>GENERANDO PÓSTER...</Text>
                        <WebView
                            ref={webViewRef}
                            style={{ width: 1, height: 1, opacity: 0 }}
                            originWhitelist={['*']}
                            source={{ html: posterHtml }}
                            onMessage={handleWebViewMessage}
                            javaScriptEnabled={true}
                            mixedContentMode="always"
                        />
                    </View>
                </Modal>
            )}

            {/* Hidden QR Generators */}
            <View style={{ position: 'absolute', opacity: 0, left: -9999 }}>
                {currentGenerating && (
                    <>
                        <QRCode value={getQrUrl(currentGenerating, 'whatsapp')} getRef={(c) => (waRef.current = c)} size={400} quietZone={30} ecl="Q" logo={WA_LOGO} logoSize={60} logoBackgroundColor='white' logoMargin={6} logoBorderRadius={30} enableLinearGradient linearGradient={['#d4af37', '#8e6d13']} />
                        <QRCode value={getQrUrl(currentGenerating, 'instagram')} getRef={(c) => (igRef.current = c)} size={400} quietZone={30} ecl="Q" logo={IG_LOGO} logoSize={60} logoBackgroundColor='white' logoMargin={6} logoBorderRadius={30} enableLinearGradient linearGradient={['#d4af37', '#8e6d13']} />
                        <QRCode value={getQrUrl(currentGenerating, 'tiktok')} getRef={(c) => (ttRef.current = c)} size={400} quietZone={30} ecl="Q" logo={TT_LOGO} logoSize={60} logoBackgroundColor='white' logoMargin={6} logoBorderRadius={30} enableLinearGradient linearGradient={['#d4af37', '#8e6d13']} />
                    </>
                )}
            </View>

            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={30} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {activeTab === 'catalog' ? 'CATÁLOGO' : 'IMPRESIÓN DE QR'}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Tab Bar */}
                <View style={styles.tabBar}>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'catalog' && styles.tabActive]}
                        onPress={() => setActiveTab('catalog')}
                    >
                        <MaterialCommunityIcons name="view-grid-outline" size={16} color={activeTab === 'catalog' ? '#000' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'catalog' && styles.tabTextActive]}>CATÁLOGO</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.tab, activeTab === 'qr' && styles.tabActive]}
                        onPress={() => setActiveTab('qr')}
                    >
                        <MaterialCommunityIcons name="qrcode" size={16} color={activeTab === 'qr' ? '#000' : '#666'} />
                        <Text style={[styles.tabText, activeTab === 'qr' && styles.tabTextActive]}>IMPRESIÓN QR</Text>
                    </TouchableOpacity>
                </View>

                {/* Content */}
                {loading ? (
                    <ActivityIndicator color="#d4af37" size="large" style={{ marginTop: 50 }} />
                ) : activeTab === 'catalog' ? (
                    renderCatalogTab()
                ) : generatingAll ? (
                    <View style={styles.progressBox}>
                        <ActivityIndicator size="large" color="#d4af37" />
                        <Text style={styles.progressText}>CONSTRUYENDO IMPERIO... {Math.round(progress)}%</Text>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { width: `${progress}%` }]} />
                        </View>
                        {currentGenerating && <Text style={styles.progressSub}>{currentGenerating.name}</Text>}
                    </View>
                ) : (
                    <FlatList
                        data={products}
                        renderItem={renderQRItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ padding: 16, paddingBottom: 130 }}
                        ListEmptyComponent={<Text style={styles.empty}>No hay productos activos.</Text>}
                    />
                )}

                {/* QR Tab Bottom Button */}
                {activeTab === 'qr' && !generatingAll && (
                    <View style={styles.bulkWrapper}>
                        <TouchableOpacity style={styles.bulkBtn} onPress={handleBatchProcess}>
                            <LinearGradient colors={['#d4af37', '#8e6d13']} style={styles.bulkGradient}>
                                <MaterialCommunityIcons name="folder-zip-outline" size={22} color="#000" />
                                <Text style={styles.bulkBtnText}>GENERAR Y DESCARGAR TODO (.ZIP)</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safe: { flex: 1 },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },

    // Tab bar
    tabBar: { flexDirection: 'row', margin: 16, marginBottom: 8, backgroundColor: '#111', borderRadius: 14, padding: 4, borderWidth: 1, borderColor: '#1e1e1e' },
    tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 11, gap: 6 },
    tabActive: { backgroundColor: '#d4af37' },
    tabText: { color: '#555', fontWeight: '900', fontSize: 12, letterSpacing: 0.5 },
    tabTextActive: { color: '#000' },

    // Catalog tab
    catalogScroll: { padding: 16, paddingBottom: 40 },
    sectionLabel: { color: '#d4af37', fontSize: 13, fontWeight: '900', letterSpacing: 2, marginBottom: 12, marginTop: 8 },

    heroRow: { marginBottom: 24, marginHorizontal: -16, paddingLeft: 16 },
    heroCard: { width: 180, height: 220, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: '#2a2a2a' },
    heroImage: { width: '100%', height: '100%', resizeMode: 'cover' },
    heroOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingVertical: 10 },
    heroName: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 3 },
    heroPrice: { color: '#d4af37', fontWeight: '900', fontSize: 15 },

    catalogGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
    catalogCard: { width: '47%', backgroundColor: '#0d0d0d', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#1e1e1e' },
    catalogImage: { width: '100%', aspectRatio: 1, resizeMode: 'cover', backgroundColor: '#111' },
    catalogInfo: { padding: 10 },
    catalogName: { color: '#ccc', fontSize: 12, fontWeight: '600', marginBottom: 4 },
    catalogPrice: { color: '#d4af37', fontWeight: '900', fontSize: 14 },

    noImage: { justifyContent: 'center', alignItems: 'center', backgroundColor: '#111' },

    catalogActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
    actionBtn: { flex: 1, borderRadius: 14, overflow: 'hidden', elevation: 5 },
    actionGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, gap: 8 },
    actionText: { color: '#000', fontWeight: '900', fontSize: 13 },

    // QR tab
    productRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 12, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: '#1a1a1a' },
    productImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#111' },
    productInfo: { flex: 1, marginLeft: 12 },
    productName: { color: '#fff', fontSize: 13, fontWeight: '900' },
    productSub: { color: '#555', fontSize: 11, marginTop: 3 },
    kitBtn: { borderRadius: 10, overflow: 'hidden' },
    kitGradient: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 13, gap: 5 },
    kitBtnText: { color: '#000', fontWeight: '900', fontSize: 11 },

    bulkWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: 'rgba(0,0,0,0.92)', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
    bulkBtn: { borderRadius: 14, overflow: 'hidden', elevation: 10, shadowColor: '#d4af37', shadowOpacity: 0.3, shadowRadius: 8 },
    bulkGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, gap: 10 },
    bulkBtnText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

    progressBox: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
    progressText: { color: '#d4af37', fontSize: 14, fontWeight: '900', marginTop: 25, letterSpacing: 1 },
    progressSub: { color: '#666', fontSize: 11, marginTop: 10, textAlign: 'center' },
    progressBar: { width: '100%', height: 4, backgroundColor: '#111', borderRadius: 2, marginTop: 20, overflow: 'hidden' },
    progressFill: { height: '100%', backgroundColor: '#d4af37' },

    empty: { textAlign: 'center', color: '#333', marginTop: 60, fontStyle: 'italic' },
});
