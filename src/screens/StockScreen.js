import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Modal, Linking, Share, Clipboard, ActivityIndicator, ScrollView, InteractionManager, Platform } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { logoBase64 } from '../assets/logoBase64';
import { GeminiService } from '../services/geminiService';
import { CRMService } from '../services/crmService';
import { SecurityService } from '../services/securityService';
import { useProductStore } from '../store/useProductStore';
import { useAuthStore } from '../store/useAuthStore';
import { ImageMapping } from '../assets/image_mapping';

// 1. Move Item Renderer OUTSIDE and Memoize it to prevent re-setup during navigation
const ProductCard = React.memo(({ item, userRole, navigation, handleDelete, handleFindBuyers, handleGenerateMarketing, stockColor, totalStock }) => {
    return (
        <TouchableOpacity
            style={styles.productCard}
            onPress={async () => {
                const currentRole = userRole || await AsyncStorage.getItem('user_role');
                if (currentRole === 'admin' || currentRole === 'leader' || currentRole === 'seller') {
                    navigation.navigate('AddProduct', { product: item });
                } else {
                    Platform.OS === 'web' 
                        ? alert('No tienes permisos de LÍDER para editar este activo.')
                        : Alert.alert('Sin Permisos', 'Solo los Líderes pueden editar productos del inventario.');
                }
            }}
            activeOpacity={0.7}
        >
            <View style={styles.cardInner}>
                <View style={styles.imageWrapper}>
                    {item.image_url || ImageMapping[item.id] ? (
                        <Image 
                            source={ImageMapping[item.id] || { uri: item.image_url }} 
                            style={styles.productImage}
                            contentFit="cover"
                            cachePolicy="disk"
                        />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <MaterialCommunityIcons name="image-off-outline" size={24} color="#333" />
                        </View>
                    )}
                    {(userRole === 'admin' || userRole === 'leader' || userRole === 'seller') && (
                        <TouchableOpacity
                            style={styles.deleteBadge}
                            onPress={() => handleDelete(item)}
                        >
                            <MaterialCommunityIcons name="delete-outline" size={14} color="#ff3b3b" />
                        </TouchableOpacity>
                    )}
                    <View style={[styles.stockGlow, { backgroundColor: stockColor + '30', borderColor: stockColor }]}>
                        <Text style={[styles.stockText, { color: stockColor }]}>{totalStock}</Text>
                    </View>
                </View>

                <View style={styles.productInfo}>
                    <View style={styles.infoTop}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={styles.salePrice}>${item.sale_price}</Text>
                                {item.sale_price_cordoba && parseFloat(item.sale_price_cordoba) !== parseFloat(item.sale_price) && (
                                    <View style={{ backgroundColor: '#d4af3720', paddingHorizontal: 4, borderRadius: 4 }}>
                                        <Text style={{ color: '#d4af37', fontSize: 10, fontWeight: 'bold' }}>CBA: ${item.sale_price_cordoba}</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>

                    <View style={styles.locationStockRow}>
                        <View style={styles.locationItem}>
                            <MaterialCommunityIcons name="home-map-marker" size={14} color="#555" />
                            <Text style={styles.locationLabel}>Jujuy: </Text>
                            <Text style={[styles.locationQty, (parseInt(item.stock_local) || 0) <= 0 && { color: '#ff3b3b' }]}>
                                {item.stock_local || 0}
                            </Text>
                        </View>
                        <View style={styles.locationDivider} />
                        <View style={styles.locationItem}>
                            <MaterialCommunityIcons name="map-marker-distance" size={14} color="#555" />
                            <Text style={styles.locationLabel}>Cba: </Text>
                            <Text style={[styles.locationQty, (parseInt(item.stock_cordoba) || 0) > 0 ? { color: '#d4af37' } : { color: '#444' }]}>
                                {item.stock_cordoba || 0}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.infoBottom}>
                        <View style={styles.metaRow}>
                            <MaterialCommunityIcons name="factory" size={12} color="#333" />
                            <Text style={styles.metaText} numberOfLines={1}>{item.provider || 'Sin Proveedor'}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.actionButtonsContainer}>
                    <TouchableOpacity style={styles.neonIconBtn} onPress={() => handleFindBuyers(item)}>
                        <MaterialCommunityIcons name="tools" size={24} color="#d4af37" />
                </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
});

export default function StockScreen({ navigation, route }) {
    const { products: storeProducts, loadingProducts: loading, fetchProducts } = useProductStore();
    const { userRole, setUserRole } = useAuthStore();
    const [refreshing, setRefreshing] = useState(false);
    const [screenReady, setScreenReady] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showHiddenStock, setShowHiddenStock] = useState(false);
    const [isFastMode, setIsFastMode] = useState(false);
    
    // Filters
    const [showFilters, setShowFilters] = useState(false);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterLowStock, setFilterLowStock] = useState(false);
    const [filterProvider, setFilterProvider] = useState('');
    const [providersList, setProvidersList] = useState([]);

    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();

    const doFetchProducts = async (forceDb = false) => {
        if (forceDb) {
            setRefreshing(true);
            await fetchProducts(true);
            setRefreshing(false);
        } else {
            fetchProducts();
        }
    };

    useFocusEffect(
        useCallback(() => {
            requestPermission();
            setScreenReady(true);
            
            // DEFER background sync until interactions (navigation) are finished
            // This ensures "fluidez constante" when switching tabs.
            InteractionManager.runAfterInteractions(() => {
                doFetchProducts(false); 
            });
        }, [])
    );

    // Marketing Assistant State
    const [marketingModalVisible, setMarketingModalVisible] = useState(false);
    const [selectedProductForMarketing, setSelectedProductForMarketing] = useState(null);
    const [marketingCopy, setMarketingCopy] = useState('');
    const [loadingMarketing, setLoadingMarketing] = useState(false);

    // Smart Match State
    const [buyersModalVisible, setBuyersModalVisible] = useState(false);
    const [potentialBuyers, setPotentialBuyers] = useState([]);
    const [loadingBuyers, setLoadingBuyers] = useState(false);
    const [selectedProductForMatch, setSelectedProductForMatch] = useState(null);

    // Tools Modal State
    const [toolsModalVisible, setToolsModalVisible] = useState(false);

    // Ally Mode (from Coach redirect)
    const [allyModalVisible, setAllyModalVisible] = useState(false);
    const [allyAnalysis, setAllyAnalysis] = useState('');
    const [allyContent, setAllyContent] = useState('');
    const [loadingAlly, setLoadingAlly] = useState(false);

    // Handle navigation params
    useFocusEffect(
        useCallback(() => {
            // 1. Ally Prompt (from Coach)
            const prompt = route?.params?.allyPrompt;
            if (prompt) {
                setAllyAnalysis(prompt);
                setAllyContent('');
                setAllyModalVisible(true);
                // Clear param
                navigation.setParams({ allyPrompt: undefined });
            }

            // 2. Direct Marketing Request (from Suppliers or other screens)
            const marketingId = route?.params?.marketingProductId;
            if (marketingId) {
                // Ensure products are loaded
                if (storeProducts && storeProducts.length > 0) {
                    const product = storeProducts.find(p => p.id === marketingId);
                    if (product) {
                        handleGenerateMarketing(product);
                    }
                    navigation.setParams({ marketingProductId: undefined });
                }
            }
        }, [route?.params?.allyPrompt, route?.params?.marketingProductId, storeProducts])
    );

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned && !isFastMode) return;

        let barcodeData = data;
        if (data.includes('linktr.ee/digital_boost_empire')) {
            const parts = data.split('barcode=');
            if (parts.length > 1) barcodeData = parts[1];
        }

        setScanned(true);

        const product = storeProducts.find(p => p.barcode === barcodeData);

        if (product) {
            if (isFastMode) {
                try {
                    const newStock = (product.current_stock || 0) + 1;
                    const { error } = await supabase
                        .from('products')
                        .update({ current_stock: newStock })
                        .eq('id', product.id);

                    if (error) throw error;
                    
                    fetchProducts(true);
                    Alert.alert("✅ Stock +1", `${product.name}: ${newStock}`, [{ text: "Seguir", onPress: () => setScanned(false) }], { cancelable: true });
                } catch (err) {
                    Alert.alert("Error", "No se pudo actualizar el stock");
                    setScanned(false);
                }
            } else {
                setIsScanning(false);
                setSearchQuery(data);
            }
        } else {
            Alert.alert("No encontrado", `No se encontró producto con código: ${data}`);
            setIsScanning(false);
        }
    };

    const handleGenerateMarketing = async (product) => {
        setSelectedProductForMarketing(product);
        setMarketingModalVisible(true);
        setLoadingMarketing(true);
        setMarketingCopy('');
        try {
            const copy = await GeminiService.generateProductMarketing(product.name, product.sale_price);
            setMarketingCopy(copy);
        } catch (error) {
            console.error(error);
            const msg = error.message || 'No se pudo generar el texto publicitario.';
            if (Platform.OS === 'web') alert(`Error IA: ${msg}`);
            else Alert.alert('Error IA', msg);
            setMarketingModalVisible(false);
        } finally {
            setLoadingMarketing(false);
        }
    };

    const handleShareMarketing = async () => {
        try {
            await Share.share({
                message: marketingCopy,
            });
        } catch (error) {
            console.log(error);
        }
    };

    const handleCopyMarketing = () => {
        Clipboard.setString(marketingCopy);
        Alert.alert('Copiado', 'Texto copiado al portapapeles.');
    };

    const handleFindBuyers = async (product) => {
        setSelectedProductForMatch(product);
        setBuyersModalVisible(true);
        setLoadingBuyers(true);
        try {
            const matches = await CRMService.findInterestedClients(product);
            setPotentialBuyers(matches);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron buscar compradores.');
        } finally {
            setLoadingBuyers(false);
        }
    };

    const handleContactBuyer = async (client, product) => {
        try {
            // Generate customized pitch
            const prompt = `
            Genera un mensaje de WhatsApp CÓRTO y casual para ${client.name}.
            
            Contexto:
            - Soy su vendedor de confianza.
            - Hace un tiempo compró: "${client.lastPurchasedItem}".
            - Acaba de entrar: "${product.name}" a $${product.sale_price}.
            
            Objetivo:
            - Contarle que entró esto porque creo que le va a gustar (basado en lo que compró antes).
            - Sin ser pesado. Ofrecer reservárselo.
            
            Solo devuelve el texto del mensaje.
            `;

            const message = await GeminiService.handleGeneralRequest(prompt);
            const url = `whatsapp://send?phone=${client.phone}&text=${encodeURIComponent(message)}`;
            Linking.openURL(url);
        } catch (e) {
            Alert.alert('Error', 'No se pudo abrir WhatsApp');
        }
    };

    const handleDelete = useCallback(async (product) => {
        Alert.alert(
            'Eliminar Producto',
            `¿Estás seguro de que quieres eliminar "${product.name}"?`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error: deleteError } = await supabase
                                .from('products')
                                .delete()
                                .eq('id', product.id);

                            if (deleteError) {
                                if (deleteError.message.includes('foreign key') || deleteError.code === '23503') {
                                    const { error: archiveError } = await supabase
                                        .from('products')
                                        .update({ active: false })
                                        .eq('id', product.id);

                                    if (archiveError) throw archiveError;
                                    Alert.alert('Producto Archivado', 'Se ha archivado por tener historial de ventas.');
                                } else {
                                    throw deleteError;
                                }
                            } else {
                                await SecurityService.logActivity('DELETE_PRODUCT', `Eliminó producto: ${product.name}`, { productId: product.id });
                                Alert.alert('✅ Eliminado', 'Producto eliminado correctamente');
                            }
                            fetchProducts();
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo eliminar el producto');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    }, [fetchProducts]);

    const filteredProductsList = React.useMemo(() => {
        if (!searchQuery) return storeProducts;
        const lowQuery = searchQuery.toLowerCase();
        return storeProducts.filter(p =>
            p.name.toLowerCase().includes(lowQuery) ||
            (p.provider && p.provider.toLowerCase().includes(lowQuery)) ||
            (p.barcode && String(p.barcode).includes(searchQuery))
        );
    }, [searchQuery, storeProducts]);

    useFocusEffect(
        useCallback(() => {
            if (screenReady) {
                fetchProducts(true); // Keep data fresh silently
            }
        }, [showHiddenStock, screenReady, fetchProducts])
    );

    // Dummy Skeleton for instant feedback
    const renderSkeleton = () => (
        <View style={styles.listContent}>
            {[1, 2, 3, 4].map(i => (
                <View key={i} style={[styles.productCard, { height: 90, backgroundColor: '#0a0a0a', opacity: 0.5 }]} />
            ))}
        </View>
    );

    const renderProductItem = useCallback(({ item }) => {
        const stockLocal = parseInt(item.stock_local) || 0;
        const stockCordoba = parseInt(item.stock_cordoba) || 0;
        const totalStock = stockLocal + stockCordoba;

        let stockColor = '#00ff88'; // Neon Green
        if (totalStock <= 0) stockColor = '#ff3b3b'; // Neon Red
        else if (totalStock <= 5) stockColor = '#ffaa00'; // Neon Orange

        return (
            <ProductCard 
                item={item} 
                userRole={userRole} 
                navigation={navigation} 
                handleDelete={handleDelete}
                handleFindBuyers={handleFindBuyers}
                handleGenerateMarketing={handleGenerateMarketing}
                stockColor={stockColor}
                totalStock={totalStock}
            />
        );
    }, [userRole, navigation, handleDelete, handleFindBuyers, handleGenerateMarketing]);

    const exportToPDF = async () => {
        setLoading(true);
        try {
            const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <style>
                    html, body { margin: 0; padding: 0; background: #000; color: #fff; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; }
                    .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #0f0f0f 0%, #1a0a00 50%, #000 100%); page-break-after: always; text-align: center; }
                    .cover-logo { font-size: 80px; font-weight: 900; color: #d4af37; letter-spacing: 10px; margin-bottom: 20px; }
                    .exclusive-badge { background: #d4af37; color: #000; padding: 10px 30px; border-radius: 50px; font-weight: 700; letter-spacing: 5px; }
                    
                    /* Centrado perfecto en la página */
                    .product-page { 
                        height: 100vh; 
                        width: 100vw;
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        page-break-after: always; 
                        box-sizing: border-box;
                        background: #000;
                    }
                    
                    .product-card { 
                        width: 85%; 
                        max-width: 520px; 
                        background: #111; 
                        border: 2px solid #d4af37; 
                        border-radius: 24px; 
                        overflow: hidden; 
                        box-shadow: 0 20px 40px rgba(0,0,0,0.8);
                    }
                    
                    .img-box { width: 100%; aspect-ratio: 1/1; background: #050505; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                    .img-box img { width: 100%; height: 100%; object-fit: cover; }
                    
                    .card-body { padding: 30px; text-align: center; }
                    .title { font-size: 28px; font-weight: 900; color: #d4af37; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px; }
                    .desc { font-size: 16px; color: #aaa; line-height: 1.5; margin-bottom: 25px; }
                    
                    /* Precio a la derecha */
                    .price-box { 
                        text-align: right; 
                        border-top: 1px solid #333; 
                        padding-top: 15px; 
                        margin-top: 10px;
                    }
                    .price { font-size: 42px; font-weight: 900; color: #fff; }
                </style>
            </head>
            <body>
                <div class="cover">
                    <div class="cover-logo">DIGITAL BOOST<br>EMPIRE</div>
                    <div class="exclusive-badge">CATÁLOGO EXCLUSIVO</div>
                </div>
                ${storeProducts.map(p => `
                    <div class="product-page">
                        <div class="product-card">
                            <div class="img-box">
                                ${p.image_url 
                                    ? `<img src="${p.image_url}" />` 
                                    : '<div style="color:#333; font-weight:900; font-size:20px;">DIGITAL BOOST</div>'
                                }
                            </div>
                            <div class="card-body">
                                <div class="title">${p.name}</div>
                                <div class="desc">${p.description || "Calidad Garantizada. Producto exclusivo de Digital Boost Empire."}</div>
                                <div class="price-box">
                                    <div class="price">$${p.sale_price}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </body>
            </html>`;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri);
        } catch (error) {
            Alert.alert('Error', 'No se pudo generar el PDF');
        } finally {
            setLoading(false);
        }
    };

    const generateQRLabels = async () => {
        setLoading(true);
        try {
            const linktree = "https://linktr.ee/digital_boost_empire";
            const whatsapp = "+54 9 3884 19-7137";

            const labelItems = storeProducts.map(p => {
                if (!p.barcode) return '';
                const smartUrl = `${linktree}?barcode=${p.barcode}`;
                const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(smartUrl)}&ecc=H`;
                const displayName = p.name.length > 20 ? p.name.substring(0, 19) + '…' : p.name;
                const displayPrice = p.sale_price ? `$${p.sale_price}` : '';
                return `
                <div class="label-wrapper">
                    <div class="wa-top">${whatsapp}</div>
                    <div class="label-card">
                        <div class="qr-container">
                            <img src="${qrApi}" class="qr-code" />
                            <div class="qr-logo-overlay">
                                <img src="${logoBase64}" 
                                     style="width:100%; height:100%; object-fit:contain; border-radius:4px;" 
                                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                                <div class="logo-fallback" style="display:none; width:100%; height:100%; align-items:center; justify-content:center; color:#d4af37; font-weight:900; font-size:10px;">DBE</div>
                            </div>
                        </div>
                    </div>
                    <div class="product-name">${displayName}</div>
                    ${displayPrice ? `<div class="product-price">${displayPrice}</div>` : ''}
                </div>
                `;
            }).join('');

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    @page { margin: 0; }
                    body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; margin: 0; padding: 10px; background: #fff; }
                    .labels-grid { 
                        display: grid; 
                        grid-template-columns: repeat(auto-fill, 140px); 
                        gap: 0; 
                        justify-content: center; 
                    }
                    .label-wrapper {
                        width: 140px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        padding: 10px 0;
                    }
                    .product-name {
                        font-size: 8.5px;
                        font-weight: 700;
                        color: #000;
                        text-align: center;
                        margin-top: 4px;
                        max-width: 130px;
                        word-break: break-word;
                        line-height: 1.2;
                    }
                    .product-price {
                        font-size: 10px;
                        font-weight: 900;
                        color: #000;
                        text-align: center;
                        margin-top: 2px;
                        letter-spacing: 0.5px;
                    }
                    .wa-top {
                        font-size: 8px;
                        font-weight: 900;
                        color: #000;
                        margin-bottom: 2px;
                        letter-spacing: 0.5px;
                    }
                    .label-card { 
                        width: 110px; 
                        height: 110px;
                        padding: 5px; 
                        text-align: center; 
                        border: 1px dashed #000;
                        background: #fff;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                    }
                    .qr-container {
                        position: relative;
                        width: 100px;
                        height: 100px;
                    }
                    .qr-code {
                        width: 100%;
                        height: 100%;
                    }
                    .qr-logo-overlay {
                        position: absolute;
                        top: 50%;
                        left: 50%;
                        transform: translate(-50%, -50%);
                        width: 32px;
                        height: 32px;
                        background: #fff;
                        border-radius: 6px;
                        padding: 2px;
                        box-shadow: 0 0 2px rgba(0,0,0,0.5);
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                </style>
            </head>
            <body>
                <div class="labels-grid">
                    ${labelItems}
                </div>
            </body>
            </html>`;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron generar las etiquetas');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerLabel}>LOGÍSTICA DEL IMPERIO</Text>
                    <Text style={styles.title}>INVENTARIO</Text>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => setToolsModalVisible(true)}
                    >
                        <MaterialCommunityIcons name="dots-vertical" size={26} color="#d4af37" />
                    </TouchableOpacity>
                </View>
            </View>

            <View style={styles.searchSection}>
                <View style={styles.searchBar}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#555" style={{ marginLeft: 15 }} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Buscar activo..."
                        placeholderTextColor="#444"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <TouchableOpacity
                        style={styles.scanBtn}
                        onPress={async () => {
                            if (permission && !permission.granted) {
                                const result = await requestPermission();
                                if (!result.granted) {
                                    Alert.alert("Permiso requerido", "Habilita la cámara.");
                                    return;
                                }
                            }
                            setScanned(false);
                            setIsScanning(true);
                        }}
                    >
                        <MaterialCommunityIcons name="barcode-scan" size={20} color="#d4af37" />
                    </TouchableOpacity>
                </View>

                {(userRole === 'admin' || userRole === 'leader' || userRole === 'seller') && (
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('AddProduct')}
                    >
                        <LinearGradient colors={['#d4af37', '#b8942e']} style={styles.addBtnGradient}>
                            <MaterialCommunityIcons name="plus" size={28} color="#000" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>

            {!screenReady ? (
                renderSkeleton()
            ) : storeProducts.length === 0 && loading ? (
                <View style={styles.emptyContainer}>
                    <ActivityIndicator color="#d4af37" size="large" />
                </View>
            ) : (
                <FlatList
                    data={filteredProductsList}
                    keyExtractor={(item) => item.id}
                    renderItem={renderProductItem}
                    initialNumToRender={1}
                    maxToRenderPerBatch={2}
                    windowSize={3}
                    removeClippedSubviews={true}
                    contentContainerStyle={styles.listContent}
                    alwaysBounceVertical={false}
                    refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => doFetchProducts(true)} tintColor="#d4af37" />
                }    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>{searchQuery ? 'No encontrado.' : 'Bóveda vacía.'}</Text>
                            {!searchQuery && <Text style={styles.emptySubtext}>Añade activos para comenzar.</Text>}
                        </View>
                    }
                />
            )}

            <Modal visible={isScanning} animationType="slide">
                <View style={{ flex: 1, backgroundColor: 'black' }}>
                    <CameraView
                        style={{ flex: 1 }}
                        facing="back"
                        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
                        }}
                    />
                    <TouchableOpacity
                        style={{ position: 'absolute', top: 50, right: 20, padding: 10, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 }}
                        onPress={() => setIsScanning(false)}
                    >
                        <MaterialCommunityIcons name="close" size={30} color="white" />
                    </TouchableOpacity>
                    <View style={{ position: 'absolute', bottom: 50, alignSelf: 'center' }}>
                        <Text style={{ color: 'white', fontSize: 18, fontWeight: 'bold' }}>Apunta al código de barras</Text>
                    </View>
                </View>
            </Modal>

            {/* Tools Menu Modal */}
            <Modal
                visible={toolsModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setToolsModalVisible(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setToolsModalVisible(false)}
                >
                    <View style={styles.toolsMenuContent}>
                        <Text style={styles.toolsMenuTitle}>HERRAMIENTAS DE INVENTARIO</Text>

                        <View style={styles.toolsGrid}>
                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); navigation.navigate('ManualStockAdjustment'); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#d4af3720' }]}>
                                    <MaterialCommunityIcons name="package-variant" size={24} color="#d4af37" />
                                </View>
                                <Text style={styles.toolLabel}>Ajuste Manual</Text>
                            </TouchableOpacity>

                            {(userRole === 'admin' || userRole === 'leader' || userRole === 'seller') && (
                                <TouchableOpacity
                                    style={styles.toolItem}
                                    onPress={() => { setToolsModalVisible(false); navigation.navigate('BulkAdjustment'); }}
                                >
                                    <View style={[styles.toolIconBox, { backgroundColor: '#3498db20' }]}>
                                        <MaterialCommunityIcons name="calculator" size={24} color="#3498db" />
                                    </View>
                                    <Text style={styles.toolLabel}>Precios %</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); exportToPDF(); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#e74c3c20' }]}>
                                    <MaterialCommunityIcons name="file-pdf-box" size={24} color="#e74c3c" />
                                </View>
                                <Text style={styles.toolLabel}>Exportar PDF</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); generateQRLabels(); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#2ecc7120' }]}>
                                    <MaterialCommunityIcons name="qrcode-scan" size={24} color="#2ecc71" />
                                </View>
                                <Text style={styles.toolLabel}>Etiquetas QR</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); navigation.navigate('ShippingRates'); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#16a08520' }]}>
                                    <MaterialCommunityIcons name="currency-usd" size={24} color="#16a085" />
                                </View>
                                <Text style={styles.toolLabel}>Tarifas</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); navigation.navigate('Promotions'); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#e91e6320' }]}>
                                    <MaterialCommunityIcons name="sale" size={24} color="#e91e63" />
                                </View>
                                <Text style={styles.toolLabel}>Promociones</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); navigation.navigate('Analytics'); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#9b59b620' }]}>
                                    <MaterialCommunityIcons name="google-analytics" size={24} color="#9b59b6" />
                                </View>
                                <Text style={styles.toolLabel}>Analíticas</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); navigation.navigate('Orders'); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#3498db20' }]}>
                                    <MaterialCommunityIcons name="clipboard-list-outline" size={24} color="#3498db" />
                                </View>
                                <Text style={styles.toolLabel}>Pedidos</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.toolItem}
                                onPress={() => { setToolsModalVisible(false); navigation.navigate('SupplierOrders'); }}
                            >
                                <View style={[styles.toolIconBox, { backgroundColor: '#f1c40f20' }]}>
                                    <MaterialCommunityIcons name="cube-send" size={24} color="#f1c40f" />
                                </View>
                                <Text style={styles.toolLabel}>Compras</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.toolsDivider} />

                        <TouchableOpacity
                            style={styles.toolToggleItem}
                            onPress={() => setIsFastMode(!isFastMode)}
                        >
                            <MaterialCommunityIcons
                                name={isFastMode ? "lightning-bolt" : "lightning-bolt-outline"}
                                size={22}
                                color={isFastMode ? "#2ecc71" : "#666"}
                            />
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={[styles.toolToggleLabel, isFastMode && { color: '#2ecc71' }]}>Modo Rápido (Scan +1)</Text>
                            </View>
                            <MaterialCommunityIcons
                                name={isFastMode ? "toggle-switch" : "toggle-switch-off"}
                                size={32}
                                color={isFastMode ? "#2ecc71" : "#333"}
                            />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.toolToggleItem}
                            onPress={() => setShowHiddenStock(!showHiddenStock)}
                        >
                            <MaterialCommunityIcons
                                name={showHiddenStock ? "eye" : "eye-off"}
                                size={22}
                                color={showHiddenStock ? "#d4af37" : "#666"}
                            />
                            <View style={{ flex: 1, marginLeft: 15 }}>
                                <Text style={[styles.toolToggleLabel, showHiddenStock && { color: '#d4af37' }]}>Ver Productos sin Stock</Text>
                            </View>
                            <MaterialCommunityIcons
                                name={showHiddenStock ? "toggle-switch" : "toggle-switch-off"}
                                size={32}
                                color={showHiddenStock ? "#d4af37" : "#333"}
                            />
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            <Modal
                visible={marketingModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setMarketingModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.marketingModalContent}>
                        <View style={styles.marketingHeader}>
                            <MaterialCommunityIcons name="robot" size={32} color="#d4af37" />
                            <View style={{ marginLeft: 15, flex: 1 }}>
                                <Text style={styles.marketingTitle}>AI MARKETING ASSISTANT</Text>
                                <Text style={styles.marketingSubtitle}>{selectedProductForMarketing?.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setMarketingModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.marketingBody}>
                            {loadingMarketing ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="large" color="#d4af37" />
                                    <Text style={styles.loadingText}>Generando copy irresistible...</Text>
                                </View>
                            ) : (
                                <ScrollView style={styles.copyContainer} showsVerticalScrollIndicator={false}>
                                    <Text style={styles.copyText}>{marketingCopy}</Text>
                                </ScrollView>
                            )}
                        </View>

                        {!loadingMarketing && (
                            <View style={styles.marketingFooter}>
                                <TouchableOpacity style={styles.copyBtn} onPress={handleCopyMarketing}>
                                    <MaterialCommunityIcons name="content-copy" size={20} color="#fff" />
                                    <Text style={styles.actionBtnText}>COPIAR</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.shareBtn} onPress={handleShareMarketing}>
                                    <MaterialCommunityIcons name="whatsapp" size={24} color="#000" />
                                    <Text style={[styles.actionBtnText, { color: '#000' }]}>COMPARTIR ESTADO</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>

            {/* Smart Buyers Modal */}
            <Modal
                visible={buyersModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setBuyersModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.marketingModalContent}>
                        <View style={styles.marketingHeader}>
                            <MaterialCommunityIcons name="target-account" size={32} color="#3498db" />
                            <View style={{ marginLeft: 15, flex: 1 }}>
                                <Text style={[styles.marketingTitle, { color: '#3498db' }]}>RADAR DE COMPRADORES</Text>
                                <Text style={styles.marketingSubtitle}>{selectedProductForMatch?.name}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setBuyersModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.marketingBody}>
                            {loadingBuyers ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="large" color="#3498db" />
                                    <Text style={[styles.loadingText, { color: '#3498db' }]}>Escaneando base de datos...</Text>
                                </View>
                            ) : (
                                <FlatList
                                    data={potentialBuyers}
                                    keyExtractor={item => item.id}
                                    ListEmptyComponent={
                                        <Text style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>
                                            No se encontraron coincidencias obvias.
                                        </Text>
                                    }
                                    renderItem={({ item }) => (
                                        <View style={{
                                            flexDirection: 'row', alignItems: 'center',
                                            backgroundColor: '#0a0a0a', padding: 15, borderRadius: 12, marginBottom: 10,
                                            borderWidth: 1, borderColor: '#222'
                                        }}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={{ color: '#fff', fontWeight: 'bold' }}>{item.name}</Text>
                                                <Text style={{ color: '#666', fontSize: 11 }}>{item.reason} ({item.lastPurchasedItem})</Text>
                                            </View>
                                            <TouchableOpacity
                                                style={{ backgroundColor: '#2ecc71', padding: 8, borderRadius: 8 }}
                                                onPress={() => handleContactBuyer(item, selectedProductForMatch)}
                                            >
                                                <MaterialCommunityIcons name="whatsapp" size={20} color="#000" />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                />
                            )}
                        </View>
                    </View>
                </View>
            </Modal>

            {/* 🤖 Ally Modal — Content ideas for stagnant stock */}
            <Modal
                visible={allyModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setAllyModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.marketingModalContent, { borderColor: '#9b59b620' }]}>
                        <View style={styles.marketingHeader}>
                            <MaterialCommunityIcons name="robot-excited" size={32} color="#9b59b6" />
                            <View style={{ marginLeft: 15, flex: 1 }}>
                                <Text style={[styles.marketingTitle, { color: '#9b59b6' }]}>ALIADO DE CONTENIDO</Text>
                                <Text style={styles.marketingSubtitle}>Stock dormido detectado por el Coach</Text>
                            </View>
                            <TouchableOpacity onPress={() => setAllyModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.marketingBody}>
                            {/* Analysis summary */}
                            <View style={{ backgroundColor: '#9b59b610', borderRadius: 10, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#9b59b630' }}>
                                <Text style={{ color: '#9b59b6', fontSize: 10, fontWeight: '900', marginBottom: 6, letterSpacing: 1 }}>ANÁLISIS DEL COACH</Text>
                                <Text style={{ color: '#ccc', fontSize: 12, lineHeight: 18 }}>{allyAnalysis}</Text>
                            </View>

                            {loadingAlly ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="large" color="#9b59b6" />
                                    <Text style={[styles.loadingText, { color: '#9b59b6' }]}>Generando ideas de contenido...</Text>
                                </View>
                            ) : allyContent ? (
                                <ScrollView style={{ maxHeight: 300 }}>
                                    <Text style={{ color: '#fff', fontSize: 13, lineHeight: 22 }}>{allyContent}</Text>
                                </ScrollView>
                            ) : (
                                <TouchableOpacity
                                    style={[styles.shareBtn, { backgroundColor: '#9b59b6', flex: 0, width: '100%', minHeight: 55 }]}
                                    onPress={async () => {
                                        setLoadingAlly(true);
                                        setAllyContent('');
                                        try {
                                            if (!allyAnalysis) throw new Error('No hay contexto para generar ideas. Regresa al Dashboard y usa el Coach.');
                                            const content = await GeminiService.handleGeneralRequest(allyAnalysis);
                                            setAllyContent(content);
                                        } catch (error) {
                                            console.error(error);
                                            setAllyContent(`Error de generación: ${error.message || 'Intenta nuevamente.'}`);
                                        } finally {
                                            setLoadingAlly(false);
                                        }
                                    }}
                                >
                                    <MaterialCommunityIcons name="creation" size={20} color="#fff" />
                                    <Text style={[styles.actionBtnText, { color: '#fff' }]}>GENERAR IDEAS DE CONTENIDO</Text>
                                </TouchableOpacity>
                            )}

                            {allyContent && (
                                <View style={{ gap: 10, marginTop: 15 }}>
                                    <TouchableOpacity
                                        style={[styles.shareBtn, { backgroundColor: '#25D366', flex: 0, width: '100%', minHeight: 55 }]}
                                        onPress={async () => {
                                            await Share.share({ title: 'Plan de Contenido', message: allyContent });
                                        }}
                                    >
                                        <MaterialCommunityIcons name="share-variant" size={20} color="#000" />
                                        <Text style={[styles.actionBtnText, { color: '#000' }]}>ENVIAR PLAN COMPLETO</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.shareBtn, { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', flex: 0, width: '100%', minHeight: 55 }]}
                                        onPress={() => {
                                            Clipboard.setString(allyContent);
                                            Alert.alert('✅ ¡Copiado!', 'El contenido se copió al portapapeles. Ya puedes pegarlo donde quieras.');
                                        }}
                                    >
                                        <MaterialCommunityIcons name="content-copy" size={20} color="#fff" />
                                        <Text style={[styles.actionBtnText, { color: '#fff' }]}>COPIAR TODO EL TEXTO</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 15, backgroundColor: '#000' },
    headerLabel: { color: '#222', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    title: { fontSize: 24, fontWeight: '900', color: '#d4af37', letterSpacing: 1, textShadowColor: 'rgba(212, 175, 55, 0.4)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    headerActions: { flexDirection: 'row', gap: 10 },
    headerBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#050505', borderWidth: 1, borderColor: '#111', justifyContent: 'center', alignItems: 'center' },
    headerBtnActive: { borderColor: '#d4af37', backgroundColor: '#d4af3710' },

    searchSection: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, gap: 10, alignItems: 'center' },
    searchBar: { flex: 1, height: 50, backgroundColor: '#0a0a0a', borderRadius: 15, borderWidth: 1, borderColor: '#222', flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 10 },
    scanBtn: { width: 50, height: '100%', justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#222' },
    addButton: { width: 50, height: 50, borderRadius: 15, overflow: 'hidden' },
    addBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    listContent: { paddingHorizontal: 20, paddingBottom: 0 },
    productCard: { marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: '#111', overflow: 'hidden', backgroundColor: '#050505' },
    cardInner: { flexDirection: 'row', padding: 12, alignItems: 'center' },
    imageWrapper: { width: 70, height: 70, borderRadius: 15, backgroundColor: '#080808', overflow: 'hidden', position: 'relative' },
    productImage: { width: '100%', height: '100%', objectFit: 'cover' },
    placeholderImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    stockGlow: { position: 'absolute', bottom: 0, right: 0, paddingHorizontal: 6, paddingVertical: 2, borderTopLeftRadius: 10, borderWidth: 1 },
    stockText: { fontSize: 10, fontWeight: '900' },

    productInfo: { flex: 1, marginLeft: 15 },
    infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    productName: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 10 },
    salePrice: { color: '#00ff88', fontSize: 16, fontWeight: '900' },
    metaText: { color: '#333', fontSize: 11, fontWeight: '600', flex: 1 },

    locationStockRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
    locationItem: { flexDirection: 'row', alignItems: 'center' },
    locationLabel: { color: '#666', fontSize: 11, marginLeft: 4 },
    locationQty: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    locationDivider: { width: 1, height: 10, backgroundColor: '#333' },

    quickAction: { padding: 8 },
    deleteBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: '#000000a0',
        padding: 5,
        borderBottomRightRadius: 10,
        zIndex: 10,
    },

    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, color: '#444', fontWeight: '900', letterSpacing: 1 },
    emptySubtext: { fontSize: 12, color: '#222', marginTop: 5, fontWeight: '600' },

    actionButtonsContainer: { position: 'absolute', right: 12, bottom: 8, zIndex: 5, flexDirection: 'row', gap: 5 },
    neonIconBtn: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#080808', borderWidth: 1, borderColor: '#111', justifyContent: 'center', alignItems: 'center' },

    // Marketing Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', padding: 20 },
    marketingModalContent: { backgroundColor: '#050505', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#111', maxHeight: '80%' },
    marketingHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    marketingTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    marketingSubtitle: { color: '#444', fontSize: 13, fontWeight: '600', marginTop: 2 },
    marketingBody: { marginVertical: 10, minHeight: 150 },
    loadingBox: { height: 150, justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#d4af37', marginTop: 15, fontWeight: 'bold' },
    copyContainer: { backgroundColor: '#000', padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#111' },
    copyText: { color: '#888', fontSize: 15, lineHeight: 22, fontWeight: '600' },
    marketingFooter: { flexDirection: 'row', gap: 10, marginTop: 20 },
    copyBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', padding: 15, borderRadius: 12, gap: 8 },
    shareBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d4af37', padding: 15, borderRadius: 12, gap: 10 },
    actionBtnText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

    // Tools Menu Styles
    toolsMenuContent: {
        backgroundColor: '#111',
        borderRadius: 25,
        padding: 25,
        borderWidth: 1,
        borderColor: '#333',
        width: '90%'
    },
    toolsMenuTitle: {
        color: '#666',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 2,
        textAlign: 'center',
        marginBottom: 20
    },
    toolsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 15
    },
    toolItem: {
        width: '47%',
        backgroundColor: '#0a0a0a',
        padding: 15,
        borderRadius: 15,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222'
    },
    toolIconBox: {
        width: 50,
        height: 50,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10
    },
    toolLabel: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold'
    },
    toolsDivider: {
        height: 1,
        backgroundColor: '#222',
        marginVertical: 20
    },
    toolToggleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        padding: 12,
        borderRadius: 15,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1a1a1a'
    },
    toolToggleLabel: {
        color: '#888',
        fontSize: 13,
        fontWeight: 'bold'
    }
});
