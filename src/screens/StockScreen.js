import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Image, Modal, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function StockScreen({ navigation, route }) {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showHiddenStock, setShowHiddenStock] = useState(false);
    const [isFastMode, setIsFastMode] = useState(false);
    const [viewMode, setViewMode] = useState('stock'); // 'stock' or 'orders'
    const [orders, setOrders] = useState([]);

    // Scanner
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned && !isFastMode) return;

        let barcodeData = data;
        if (data.includes('linktr.ee/digital_boost_empire')) {
            const parts = data.split('barcode=');
            if (parts.length > 1) barcodeData = parts[1];
        }

        setScanned(true);

        const product = products.find(p => p.barcode === barcodeData);

        if (product) {
            if (isFastMode) {
                try {
                    const newStock = (product.current_stock || 0) + 1;
                    const { error } = await supabase
                        .from('products')
                        .update({ current_stock: newStock })
                        .eq('id', product.id);

                    if (error) throw error;

                    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, current_stock: newStock } : p));
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

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const validProducts = data.filter(p => {
                    if (p.active === false) return false;
                    if (showHiddenStock) return true;
                    return (p.current_stock || 0) > 0;
                });

                setProducts(validProducts);
                setFilteredProducts(validProducts);
            }
        } catch (error) {
            console.log('Error fetching products:', error.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('supplier_orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setOrders(data || []);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePayInstallment = async (item) => {
        const currentPaid = item.installments_paid || 0;
        const total = item.installments_total || 1;

        if (currentPaid >= total) return;

        const { error } = await supabase
            .from('supplier_orders')
            .update({ installments_paid: currentPaid + 1 })
            .eq('id', item.id);

        if (error) {
            Alert.alert('Error', 'No se pudo actualizar la cuota');
        } else {
            fetchOrders();
        }
    };

    const handleDeleteOrder = (id) => {
        Alert.alert('Eliminar', '¿Borrar este pedido del historial?', [
            { text: 'Cancelar' },
            {
                text: 'Borrar',
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('supplier_orders').delete().eq('id', id);
                    fetchOrders();
                }
            }
        ]);
    };

    const handleTrack = (trackingNumber) => {
        if (!trackingNumber) return;
        const url = `https://t.17track.net/en#nums=${trackingNumber}`;
        Linking.openURL(url);
    };

    const handleDelete = async (product) => {
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
    };

    useEffect(() => {
        if (searchQuery) {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.provider && p.provider.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.barcode && String(p.barcode).includes(searchQuery))
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts(products);
        }
    }, [searchQuery, products]);

    useFocusEffect(
        useCallback(() => {
            if (viewMode === 'stock') fetchProducts();
            else fetchOrders();
        }, [route.params?.refresh, showHiddenStock, viewMode])
    );

    const renderProductItem = ({ item }) => {
        const stock = parseInt(item.current_stock) || 0;
        let stockColor = '#2ecc71';
        if (stock <= 0) stockColor = '#e74c3c';
        else if (stock <= 5) stockColor = '#f1c40f';

        return (
            <TouchableOpacity
                style={styles.productCard}
                onPress={() => navigation.navigate('AddProduct', { product: item })}
                activeOpacity={0.7}
            >
                <LinearGradient colors={['#1a1a1a', '#0d0d0d']} style={styles.cardInner}>
                    <View style={styles.imageWrapper}>
                        {item.image_url ? (
                            <Image source={{ uri: item.image_url }} style={styles.productImage} />
                        ) : (
                            <View style={styles.placeholderImage}>
                                <MaterialCommunityIcons name="image-off-outline" size={24} color="#333" />
                            </View>
                        )}
                        <View style={[styles.stockGlow, { backgroundColor: stockColor + '20', borderColor: stockColor + '60' }]}>
                            <Text style={[styles.stockText, { color: stockColor }]}>{stock}</Text>
                        </View>
                    </View>

                    <View style={styles.productInfo}>
                        <View style={styles.infoTop}>
                            <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
                            <Text style={styles.salePrice}>${item.sale_price}</Text>
                        </View>

                        <View style={styles.infoBottom}>
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons name="factory" size={12} color="#555" />
                                <Text style={styles.metaText} numberOfLines={1}>{item.provider || 'Sin Proveedor'}</Text>
                            </View>
                            <View style={styles.metaRow}>
                                <MaterialCommunityIcons name="barcode" size={12} color="#555" />
                                <Text style={styles.metaText}>{item.barcode || 'S/C'}</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.quickAction} onPress={() => handleDelete(item)}>
                        <MaterialCommunityIcons name="delete-outline" size={20} color="#444" />
                    </TouchableOpacity>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderOrderItem = ({ item }) => (
        <View style={styles.orderCard}>
            <View style={styles.cardHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialCommunityIcons name="cube-send" size={24} color="#d4af37" style={{ marginRight: 10 }} />
                    <Text style={styles.providerName}>{item.provider_name}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteOrder(item.id)}>
                    <MaterialCommunityIcons name="trash-can-outline" size={20} color="#666" />
                </TouchableOpacity>
            </View>

            <Text style={styles.desc}>{item.items_description}</Text>
            {item.total_cost > 0 && <Text style={styles.cost}>Costo: ${item.total_cost}</Text>}

            {/* Installments Section */}
            {item.installments_total > 1 && (
                <View style={styles.installmentContainer}>
                    <View>
                        <Text style={styles.installmentText}>
                            Cuotas: <Text style={{ color: '#fff' }}>{item.installments_paid || 0}/{item.installments_total}</Text>
                        </Text>
                        <Text style={styles.installmentText}>
                            Restantes: <Text style={{ color: '#e74c3c' }}>{item.installments_total - (item.installments_paid || 0)}</Text>
                        </Text>
                    </View>
                    {(item.installments_paid || 0) < item.installments_total && (
                        <TouchableOpacity
                            style={styles.payBtn}
                            onPress={() => handlePayInstallment(item)}
                        >
                            <Text style={styles.payBtnText}>PAGAR CUOTA</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Tracking Section */}
            {item.tracking_number ? (
                <TouchableOpacity style={styles.trackRow} onPress={() => handleTrack(item.tracking_number)}>
                    <MaterialCommunityIcons name="radar" size={20} color="#3498db" />
                    <Text style={styles.trackText}>{item.tracking_number}</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#666" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            ) : null}

            <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
    );

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
                    .product-page { height: 100vh; display: flex; justify-content: center; align-items: center; page-break-after: always; padding: 40px; }
                    .product-card { width: 100%; max-width: 600px; background: #111; border: 2px solid #d4af37; border-radius: 20px; overflow: hidden; }
                    .img-box { width: 100%; height: 400px; background: #050505; }
                    .img-box img { width: 100%; height: 100%; object-fit: cover; }
                    .card-body { padding: 30px; text-align: center; }
                    .title { font-size: 32px; color: #d4af37; margin-bottom: 15px; }
                    .price { font-size: 48px; font-weight: 900; color: #fff; margin-top: 20px; }
                </style>
            </head>
            <body>
                <div class="cover">
                    <div class="cover-logo">DIGITAL BOOST<br>EMPIRE</div>
                    <div class="exclusive-badge">CATÁLOGO EXCLUSIVO</div>
                </div>
                ${products.map(p => `
                    <div class="product-page">
                        <div class="product-card">
                            <div class="img-box">
                                ${p.image_url ? `<img src="${p.image_url}" />` : '<div style="height:100%; display:flex; align-items:center; justify-content:center; color:#333;">NO IMAGE</div>'}
                            </div>
                            <div class="card-body">
                                <div class="title">${p.name.toUpperCase()}</div>
                                <div class="price">$${p.sale_price}</div>
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
            const labelItems = products.map(p => {
                if (!p.barcode) return '';
                const smartUrl = `${linktree}?barcode=${p.barcode}`;
                const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(smartUrl)}`;
                return `
                <div class="label-card">
                    <div class="product-name">${p.name.toUpperCase()}</div>
                    <div class="qr-box">
                        <img src="${qrApi}" />
                    </div>
                    <div class="product-price">$${p.sale_price}</div>
                    <div class="helper-text">Escanea para info / App DBE</div>
                </div>
                `;
            }).join('');

            const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: sans-serif; margin: 0; padding: 20px; }
                    .labels-container { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
                    .label-card { 
                        width: 180px; 
                        height: 250px; 
                        border: 1px solid #ddd; 
                        padding: 10px; 
                        text-align: center; 
                        display: flex; 
                        flex-direction: column; 
                        justify-content: space-between;
                        border-radius: 8px;
                        background: #fff;
                    }
                    .product-name { font-size: 14px; font-weight: bold; height: 40px; overflow: hidden; }
                    .product-price { font-size: 20px; font-weight: 900; color: #000; }
                    .qr-box { width: 120px; height: 120px; margin: 0 auto; }
                    .qr-box img { width: 100%; height: 100%; }
                    .helper-text { font-size: 8px; color: #666; margin-top: 5px; }
                </style>
            </head>
            <body>
                <h2 style="text-align:center;">Etiquetas Inteligentes Imperial</h2>
                <div class="labels-container">
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                        <TouchableOpacity onPress={() => setViewMode('stock')}>
                            <Text style={[styles.title, viewMode !== 'stock' && { color: '#333' }]}>INVENTARIO</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setViewMode('orders')}>
                            <Text style={[styles.title, viewMode !== 'orders' && { color: '#333' }]}>COMPRAS</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.headerActions}>
                    <TouchableOpacity
                        style={[styles.headerBtn, isFastMode && { borderColor: '#2ecc71', backgroundColor: '#2ecc7120' }]}
                        onPress={() => setIsFastMode(!isFastMode)}
                    >
                        <MaterialCommunityIcons name="lightning-bolt" size={22} color={isFastMode ? "#2ecc71" : "#666"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerBtn, showHiddenStock && styles.headerBtnActive]}
                        onPress={() => setShowHiddenStock(!showHiddenStock)}
                    >
                        <MaterialCommunityIcons name={showHiddenStock ? "eye" : "eye-off"} size={22} color={showHiddenStock ? "#d4af37" : "#666"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={() => navigation.navigate('BulkAdjustment')}
                    >
                        <MaterialCommunityIcons name="calculator" size={22} color="#d4af37" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={exportToPDF}
                    >
                        <MaterialCommunityIcons name="file-pdf-box" size={22} color="#d4af37" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerBtn}
                        onPress={generateQRLabels}
                    >
                        <MaterialCommunityIcons name="qrcode-scan" size={22} color="#d4af37" />
                    </TouchableOpacity>
                </View>
            </View>

            {viewMode === 'stock' && (
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

                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('AddProduct')}
                    >
                        <LinearGradient colors={['#d4af37', '#b8942e']} style={styles.addBtnGradient}>
                            <MaterialCommunityIcons name="plus" size={28} color="#000" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {viewMode === 'orders' && (
                <View style={styles.searchSection}>
                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation.navigate('NewSupplierOrder')}
                    >
                        <LinearGradient colors={['#d4af37', '#b8942e']} style={styles.addBtnGradient}>
                            <MaterialCommunityIcons name="plus" size={28} color="#000" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            <FlatList
                data={viewMode === 'stock' ? filteredProducts : orders}
                keyExtractor={(item) => item.id}
                renderItem={viewMode === 'stock' ? renderProductItem : renderOrderItem}
                contentContainerStyle={styles.listContent}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={viewMode === 'stock' ? fetchProducts : fetchOrders} tintColor="#d4af37" />}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{viewMode === 'stock' ? (searchQuery ? 'No encontrado.' : 'Bóveda vacía.') : 'No hay pedidos.'}</Text>
                        {!searchQuery && viewMode === 'stock' && <Text style={styles.emptySubtext}>Añade activos para comenzar.</Text>}
                    </View>
                }
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 25, paddingTop: 15, backgroundColor: '#000' },
    headerLabel: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    title: { fontSize: 24, fontWeight: '900', color: '#d4af37', letterSpacing: 1 },
    headerActions: { flexDirection: 'row', gap: 10 },
    headerBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#222', justifyContent: 'center', alignItems: 'center' },
    headerBtnActive: { borderColor: '#d4af37', backgroundColor: '#d4af3710' },

    searchSection: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 20, gap: 10, alignItems: 'center' },
    searchBar: { flex: 1, height: 50, backgroundColor: '#0a0a0a', borderRadius: 15, borderWidth: 1, borderColor: '#222', flexDirection: 'row', alignItems: 'center' },
    searchInput: { flex: 1, color: '#fff', fontSize: 14, paddingHorizontal: 10 },
    scanBtn: { width: 50, height: '100%', justifyContent: 'center', alignItems: 'center', borderLeftWidth: 1, borderLeftColor: '#222' },
    addButton: { width: 50, height: 50, borderRadius: 15, overflow: 'hidden' },
    addBtnGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    listContent: { paddingHorizontal: 20, paddingBottom: 100 },
    productCard: { marginBottom: 12, borderRadius: 20, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
    cardInner: { flexDirection: 'row', padding: 12, alignItems: 'center' },
    imageWrapper: { width: 70, height: 70, borderRadius: 15, backgroundColor: '#111', overflow: 'hidden', position: 'relative' },
    productImage: { width: '100%', height: '100%', objectFit: 'cover' },
    placeholderImage: { width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    stockGlow: { position: 'absolute', bottom: 0, right: 0, paddingHorizontal: 6, paddingVertical: 2, borderTopLeftRadius: 10, borderWidth: 1 },
    stockText: { fontSize: 10, fontWeight: '900' },

    productInfo: { flex: 1, marginLeft: 15 },
    infoTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
    productName: { color: '#fff', fontSize: 15, fontWeight: 'bold', flex: 1, marginRight: 10 },
    salePrice: { color: '#2ecc71', fontSize: 16, fontWeight: '900' },
    infoBottom: { gap: 4 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: '#555', fontSize: 11, fontWeight: '600', flex: 1 },
    quickAction: { padding: 8 },

    emptyContainer: { alignItems: 'center', marginTop: 100 },
    emptyText: { fontSize: 18, color: '#444', fontWeight: '900', letterSpacing: 1 },
    emptySubtext: { fontSize: 12, color: '#222', marginTop: 5, fontWeight: '600' },

    // Order Styles
    orderCard: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10, alignItems: 'center' },
    providerName: { color: '#fff', fontWeight: 'bold', fontSize: 18 },
    desc: { color: '#ccc', marginBottom: 10, fontSize: 14 },
    cost: { color: '#fff', fontWeight: 'bold', marginBottom: 10 },
    installmentContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2c3e50', padding: 10, borderRadius: 8, marginBottom: 10 },
    installmentText: { color: '#bdc3c7', fontSize: 12, fontWeight: 'bold' },
    payBtn: { backgroundColor: '#27ae60', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 5 },
    payBtnText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
    trackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 15, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#333' },
    trackText: { color: '#3498db', marginLeft: 10, fontWeight: '600', letterSpacing: 1 },
    date: { color: '#666', fontSize: 12 }
});
