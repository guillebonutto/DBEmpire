import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Share, Image, ActivityIndicator, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';

export default function CatalogScreen({ navigation }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('active', true)
                .order('name');
            if (data) setProducts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        let catalogText = "👑 *DIGITAL BOOST EMPIRE - Catálogo Virtual* 👑\n\n";
        products.forEach(p => {
            catalogText += `🔹 *${p.name}*\n💰 Precio: $${p.sale_price}\n${p.description ? p.description + '\n' : ''}\n`;
        });
        catalogText += "\n🚀 ¡Haz tu pedido ahora!";

        try {
            await Share.share({
                message: catalogText,
                title: 'Mi Catálogo Digital'
            });
        } catch (error) {
            alert(error.message);
        }
    };

    const handleShareProduct = async (item) => {
        const text = `👑 *DIGITAL BOOST EMPIRE* 👑\n\n` +
            `🔹 *${item.name.toUpperCase()}*\n` +
            `💰 *Precio: $${item.sale_price}*\n\n` +
            `${item.description ? item.description + '\n\n' : ''}` +
            `🚀 ¡Pide el tuyo ahora antes de que se agote!`;

        try {
            await Share.share({
                message: text,
                title: item.name
            });
        } catch (error) {
            alert(error.message);
        }
    };

    const renderItem = React.useCallback(({ item }) => (
        <View style={styles.card}>
            <View>
                {item.image_url ? (
                    <Image source={{ uri: item.image_url }} style={styles.image} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <MaterialCommunityIcons name="image-off" size={30} color="#444" />
                    </View>
                )}
                <TouchableOpacity
                    style={styles.shareItemBtn}
                    onPress={() => handleShareProduct(item)}
                >
                    <MaterialCommunityIcons name="whatsapp" size={18} color="#000" />
                </TouchableOpacity>
            </View>
            <View style={styles.info}>
                <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.price}>${item.sale_price}</Text>
                <Text style={styles.stock}>En stock: {item.current_stock}</Text>
            </View>
        </View>
    ), []);

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="chevron-left" size={30} color="#666" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>CATÁLOGO</Text>
                    <TouchableOpacity onPress={handleShare}>
                        <MaterialCommunityIcons name="share-variant" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>

                {loading ? (
                    <ActivityIndicator color="#d4af37" size="large" style={{ marginTop: 50 }} />
                ) : (
                    <FlatList
                        data={products}
                        renderItem={renderItem}
                        keyExtractor={item => item.id}
                        contentContainerStyle={styles.list}
                        numColumns={2}
                        initialNumToRender={10}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                        removeClippedSubviews={true}
                    />
                )}

                <TouchableOpacity style={styles.floatBtn} onPress={handleShare}>
                    <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.floatGradient}>
                        <MaterialCommunityIcons name="whatsapp" size={24} color="#000" />
                        <Text style={styles.floatText}>COMPARTIR CATÁLOGO</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    safe: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '900', color: '#d4af37', letterSpacing: 2 },
    list: { paddingHorizontal: 10, paddingBottom: 100, paddingTop: 10 },
    card: { flex: 1, backgroundColor: '#111', margin: 8, borderRadius: 15, overflow: 'hidden', borderWidth: 1, borderColor: '#222' },
    image: { width: '100%', height: 120, resizeMode: 'cover' },
    imagePlaceholder: { width: '100%', height: 120, backgroundColor: '#1a1a1a', justifyContent: 'center', alignItems: 'center' },
    info: { padding: 12 },
    name: { fontSize: 14, fontWeight: '700', color: '#fff' },
    price: { fontSize: 16, fontWeight: '900', color: '#d4af37', marginTop: 4 },
    stock: { fontSize: 10, color: '#666', marginTop: 2 },
    floatBtn: { position: 'absolute', bottom: 30, alignSelf: 'center', borderRadius: 30, elevation: 10, overflow: 'hidden' },
    floatGradient: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 15, gap: 10 },
    floatText: { color: '#000', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },

    shareItemBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#d4af37',
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 5,
        shadowColor: '#000',
        shadowOpacity: 0.3,
        shadowRadius: 3
    }
});
