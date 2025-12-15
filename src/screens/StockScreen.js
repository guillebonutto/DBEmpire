import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Alert, StatusBar, TextInput, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function StockScreen({ navigation, route }) {
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showHiddenStock, setShowHiddenStock] = useState(false); // New state for toggling

    // Scanner
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);


    // Function to fetch products
    const fetchProducts = async () => {
        setLoading(true);
        // ... (rest is same, no need to replace all)
        try {
            // 1. Try to fetch from Supabase
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                // Determine which products to show
                const validProducts = data.filter(p => {
                    // Always hide archived/deleted (active === false)
                    if (p.active === false) return false;

                    // If showHiddenStock is TRUE, show everything active
                    if (showHiddenStock) return true;

                    // If showHiddenStock is FALSE, hide items with stock <= 0
                    return (p.current_stock || 0) > 0;
                });

                setProducts(validProducts);
                setFilteredProducts(validProducts);
            } else {
                setProducts([]);
                setFilteredProducts([]);
            }
        } catch (error) {
            console.log('Error fetching products:', error.message);
        } finally {
            setLoading(false);
        }
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
                                // If product has sales history, archive it
                                if (deleteError.message.includes('foreign key constraint') ||
                                    deleteError.code === '23503') {
                                    const { error: archiveError } = await supabase
                                        .from('products')
                                        .update({ active: false })
                                        .eq('id', product.id);

                                    if (archiveError) {
                                        throw archiveError;
                                    }

                                    Alert.alert(
                                        'Producto Archivado',
                                        'Este producto tiene ventas registradas y se ha archivado para mantener el historial.',
                                        [{ text: 'Entendido' }]
                                    );
                                } else {
                                    throw deleteError;
                                }
                            } else {
                                Alert.alert('✅ Eliminado', 'Producto eliminado correctamente');
                            }

                            fetchProducts(); // Refresh list
                        } catch (err) {
                            console.log('Error deleting product:', err);
                            Alert.alert('Error', 'No se pudo eliminar el producto');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Filter logic
    useEffect(() => {
        if (searchQuery) {
            const filtered = products.filter(p =>
                p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.provider && p.provider.toLowerCase().includes(searchQuery.toLowerCase()))
            );
            setFilteredProducts(filtered);
        } else {
            setFilteredProducts(products);
        }
    }, [searchQuery, products]);

    // Fetch when screen comes into focus or toggle changes
    useFocusEffect(
        useCallback(() => {
            fetchProducts();
        }, [route.params?.refresh, showHiddenStock])
    );

    const renderProductItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('AddProduct', { product: item })} // Edit mode
        >
            <View style={styles.cardContent}>
                {/* Image */}
                <View style={styles.imageContainer}>
                    {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.productImage} />
                    ) : (
                        <View style={styles.placeholderImage}>
                            <Text style={styles.placeholderText}>No img</Text>
                        </View>
                    )}
                </View>

                {/* Details */}
                <View style={styles.detailsContainer}>
                    <View style={styles.contentRow}>
                        {/* Info Column (Left) */}
                        <View style={styles.infoColumn}>
                            <Text style={styles.productName}>{item.name}</Text>
                            <View style={styles.detailsRow}>
                                <Text style={[styles.stockBadge, (parseInt(item.current_stock) || 0) <= 0 ? styles.lowStock : styles.goodStock]}>
                                    Stock: {item.current_stock}
                                </Text>
                                <Text style={styles.subtext}>Costo: ${item.cost_price} | Margen: {item.profit_margin_percent}%</Text>
                            </View>
                        </View>

                        {/* Price Column (Right) */}
                        <View style={styles.priceColumn}>
                            <Text style={styles.priceTag}>${item.sale_price}</Text>
                            <TouchableOpacity
                                onPress={() => handleDelete(item)}
                                style={styles.deleteIcon}
                            >
                                <MaterialCommunityIcons name="delete" size={20} color="#e74c3c" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    const exportToPDF = async () => {
        setLoading(true);
        try {

            const htmlContent = `
            <!DOCTYPE html>
            <html lang="es">
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    

                    html, body {
                        margin: 0;
                        padding: 0;
                        height: 100%;
                        width: 100%;
                        background: #000;
                        color: #fff;
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }

                    /* PORTADA ÉPICA */
                    .cover {
                        height: 100vh;
                        width: 100vw;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        background: linear-gradient(135deg, #0f0f0f 0%, #1a0a00 50%, #000 100%);
                        text-align: center;
                        position: relative;
                        overflow: hidden;
                        page-break-after: always;
                    }
                    .cover::before {
                        content: '';
                        position: absolute;
                        top: 0; left: 0; right: 0; bottom: 0;
                        background: radial-gradient(circle at center, rgba(212,175,55,0.15) 0%, transparent 70%);
                        pointer-events: none;
                    }
                    .cover-logo {
                        font-size: 80px;
                        font-weight: 900;
                        color: #d4af37;
                        letter-spacing: 15px;
                        text-shadow: 0 0 40px rgba(212,175,55,0.6), 0 10px 20px rgba(0,0,0,0.8);
                        margin-bottom: 20px;
                    }
                    .cover-subtitle {
                        font-size: 28px;
                        color: #aaa;
                        letter-spacing: 12px;
                        text-transform: uppercase;
                        font-weight: 300;
                        margin-bottom: 60px;
                    }
                    .exclusive-badge {
                        background: linear-gradient(90deg, #d4af37, #ffd700);
                        color: #000;
                        padding: 12px 40px;
                        font-size: 20px;
                        font-weight: 700;
                        letter-spacing: 6px;
                        text-transform: uppercase;
                        border-radius: 50px;
                        box-shadow: 0 0 30px rgba(212,175,55,0.5);
                    }

                    /* PÁGINA DE PRODUCTO */
                    .product-page {
                        height: 100vh;
                        width: 100vw;
                        display: flex;
                        flex-direction: column;
                        justify-content: center;
                        align-items: center;
                        padding: 40px;
                        box-sizing: border-box;
                        page-break-after: always;
                        position: relative;
                    }
                    .product-card {
                        width: 100%;
                        max-width: 700px;
                        background: rgba(15,15,15,0.9);
                        border: 2px solid #d4af37;
                        border-radius: 20px;
                        overflow: hidden;
                        box-shadow: 0 20px 60px rgba(212,175,55,0.2), 0 0 40px rgba(0,0,0,0.8);
                    }
                    .image-container {
                        width: 100%;
                        height: 450px;
                        background: #111;
                        overflow: hidden;
                        position: relative;
                    }
                    .prod-img {
                        width: 100%;
                        height: 100%;
                        object-fit: cover;
                        transition: transform 0.5s;
                    }
                    .no-img {
                        height: 100%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 36px;
                        color: #444;
                        letter-spacing: 5px;
                        background: #0a0a0a;
                    }
                    .overlay-badge {
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        background: rgba(212,175,55,0.9);
                        color: #000;
                        padding: 10px 20px;
                        font-weight: 700;
                        border-radius: 30px;
                        font-size: 14px;
                        letter-spacing: 2px;
                    }

                    .card-body {
                        padding: 40px;
                        text-align: center;
                    }
                    .prod-title {
                        font-size: 42px;
                        color: #d4af37;
                        margin-bottom: 20px;
                        letter-spacing: 3px;
                    }
                    .prod-desc {
                        font-size: 18px;
                        color: #ccc;
                        line-height: 1.6;
                        margin-bottom: 30px;
                        max-width: 600px;
                        margin-left: auto;
                        margin-right: auto;
                    }
                    .highlight {
                        color: #d4af37;
                        font-weight: 700;
                    }
                    .price-box {
                        margin: 30px 0;
                    }
                    .old-price {
                        font-size: 24px;
                        color: #666;
                        text-decoration: line-through;
                        margin-right: 15px;
                    }
                    .price {
                        font-size: 60px;
                        font-weight: 900;
                        color: #d4af37;
                        letter-spacing: -2px;
                        text-shadow: 0 0 20px rgba(212,175,55,0.4);
                    }
                    .cta {
                        font-size: 22px;
                        color: #fff;
                        margin-top: 20px;
                        font-weight: 600;
                        letter-spacing: 2px;
                    }
                </style>
            </head>
            <body>

                <!-- PORTADA -->
                <div class="cover">
                    <div class="cover-logo">DIGITAL BOOST<br>EMPIRE</div>
                    <div class="cover-subtitle">Catálogo Exclusivo</div>
                    <div class="exclusive-badge">ACCESO LIMITADO</div>
                </div>

                <!-- PRODUCTOS -->
                ${products.map(p => {
                const hasDiscount = p.original_price && p.original_price > p.sale_price;
                const discountPercent = hasDiscount
                    ? Math.round(((p.original_price - p.sale_price) / p.original_price) * 100)
                    : 0;

                return `
                    <div class="product-page">
                        <div class="product-card">
                            <div class="image-container">
                                ${p.image_url
                        ? `<img src="${p.image_url}" class="prod-img" alt="${p.name}" />`
                        : `<div class="no-img">DIGITAL BOOST EMPIRE</div>`
                    }
                                ${discountPercent > 0 ? `<div class="overlay-badge">-${discountPercent}% OFF</div>` : ''}
                            </div>
                            <div class="card-body">
                                <div class="prod-title">${p.name.toUpperCase()}</div>
                                <div class="prod-desc">
                                    ${p.description
                        ? p.description
                        : '<span class="highlight">Producto premium</span> de edición limitada. Máxima calidad garantizada. Ideal para quienes buscan <span class="highlight">resultados reales</span> y <span class="highlight">exclusividad absoluta</span>.'
                    }
                                </div>
                                <div class="price-box">
                                    ${hasDiscount ? `<span class="old-price">$${p.original_price}</span>` : ''}
                                    <div class="price">$${p.sale_price}</div>
                                </div>
                                <div class="cta">DISPONIBILIDAD LIMITADA • COMPRA AHORA</div>
                            </div>
                        </div>
                    </div>
                    `;
            }).join('')}

            </body>
            </html>
        `;

            const { uri } = await Print.printToFileAsync({
                html: htmlContent,
                width: 595,
                height: 842,
                margins: { top: 0, bottom: 0, left: 0, right: 0 }
            });

            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf' });
        } catch (error) {
            Alert.alert('Error', 'No se pudo generar el PDF: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>INVENTARIO ({products.length})</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: showHiddenStock ? '#d4af37' : '#333', paddingHorizontal: 15 }]}
                        onPress={() => setShowHiddenStock(!showHiddenStock)}
                    >
                        <MaterialCommunityIcons name={showHiddenStock ? "eye" : "eye-off"} size={24} color={showHiddenStock ? "#d4af37" : "#666"} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.addButton, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#d4af37', paddingHorizontal: 15 }]}
                        onPress={exportToPDF}
                    >
                        <MaterialCommunityIcons name="file-pdf-box" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Search Bar */}
            <View style={styles.searchContainer}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput
                        style={[styles.searchInput, { flex: 1 }]}
                        placeholder="Buscar producto..."
                        placeholderTextColor="#888"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    <TouchableOpacity
                        style={{ backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, borderRadius: 8, borderWidth: 1, borderColor: '#333' }}
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
                        <MaterialCommunityIcons name="barcode-scan" size={24} color="#d4af37" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={{ backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, borderRadius: 8 }}
                        onPress={() => navigation.navigate('AddProduct')}
                    >
                        <MaterialCommunityIcons name="plus" size={24} color="black" />
                    </TouchableOpacity>
                </View>
            </View>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item) => item.id ? item.id.toString() : Math.random().toString()}
                renderItem={renderProductItem}
                contentContainerStyle={styles.listContent}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchProducts} tintColor="#d4af37" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyText}>{searchQuery ? 'No encontrado.' : 'Bóveda vacía.'}</Text>
                        {!searchQuery && <Text style={styles.emptySubtext}>Añade activos para comenzar.</Text>}
                    </View>
                }
            />
            <View style={{ height: 20 }} />
        </SafeAreaView>
    );
}

// ... styles ...


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#1a1a1a',
        borderBottomWidth: 1,
        borderBottomColor: '#333',
    },
    title: { fontSize: 18, fontWeight: '900', color: '#d4af37', letterSpacing: 1 },
    addButton: {
        backgroundColor: '#d4af37',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 8,
    },
    addButtonText: { color: 'black', fontWeight: 'bold' },

    searchContainer: { padding: 15, backgroundColor: '#111' },
    searchInput: {
        backgroundColor: '#222',
        color: '#fff',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#333'
    },

    listContent: { padding: 15 },
    card: {
        backgroundColor: '#1e1e1e',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    cardContent: { flexDirection: 'row', alignItems: 'center' },
    imageContainer: { marginRight: 15 },
    productImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333' },
    placeholderImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
    placeholderText: { color: '#666', fontSize: 10 },

    detailsContainer: { flex: 1 },
    contentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    infoColumn: { flex: 1, marginRight: 10 },
    productName: { fontSize: 16, fontWeight: 'bold', color: '#fff', marginBottom: 4 },
    priceColumn: { alignItems: 'flex-end', gap: 4 },
    deleteIcon: { padding: 4 },
    priceTag: { fontSize: 18, fontWeight: 'bold', color: '#2ecc71' },
    detailsRow: { flexDirection: 'column', gap: 2 },
    stockBadge: { fontWeight: '600', fontSize: 13 },
    lowStock: { color: '#e74c3c' },
    goodStock: { color: '#888' },
    subtext: { color: '#666', fontSize: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 50 },
    emptyText: { fontSize: 18, color: '#666', fontWeight: 'bold' },
    emptySubtext: { fontSize: 14, color: '#444', fontStyle: 'italic', marginTop: 5 }
});
