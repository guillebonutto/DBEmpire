import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator, StatusBar, Modal, FlatList, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function BreakEvenScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [products, setProducts] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [showProductModal, setShowProductModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Fixed Costs State
    const [rent, setRent] = useState('150000');
    const [utilities, setUtilities] = useState('60000'); // Light, water, gas
    const [salaries, setSalaries] = useState('200000');
    const [marketing, setMarketing] = useState('40000');
    const [others, setOthers] = useState('50000');

    // Simulation Override Variables
    const [simPrice, setSimPrice] = useState('');
    const [simCost, setSimCost] = useState('');

    useEffect(() => {
        loadFixedCosts();
        fetchProducts();
    }, []);

    const loadFixedCosts = async () => {
        try {
            const saved = await AsyncStorage.getItem('breakeven_fixed_costs');
            if (saved) {
                const data = JSON.parse(saved);
                if (data.rent) setRent(data.rent);
                if (data.utilities) setUtilities(data.utilities);
                if (data.salaries) setSalaries(data.salaries);
                if (data.marketing) setMarketing(data.marketing);
                if (data.others) setOthers(data.others);
            }
        } catch (e) {
            console.warn('Error loading fixed costs:', e);
        }
    };

    const saveFixedCosts = async (updated) => {
        try {
            const current = { rent, utilities, salaries, marketing, others, ...updated };
            await AsyncStorage.setItem('breakeven_fixed_costs', JSON.stringify(current));
        } catch (e) {
            console.warn('Error saving fixed costs:', e);
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, sale_price, cost_price')
                .eq('active', true)
                .order('name');
            if (error) throw error;
            setProducts(data || []);
        } catch (error) {
            Alert.alert('Error', 'No se pudieron cargar los productos: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleFixedCostChange = (key, val, setter) => {
        // Allow only numbers
        const clean = val.replace(/[^0-9]/g, '');
        setter(clean);
        saveFixedCosts({ [key]: clean });
    };

    // Calculations
    const totalFixedCosts = (parseFloat(rent) || 0) + 
                            (parseFloat(utilities) || 0) + 
                            (parseFloat(salaries) || 0) + 
                            (parseFloat(marketing) || 0) + 
                            (parseFloat(others) || 0);

    const activePrice = selectedProduct ? (parseFloat(simPrice) || selectedProduct.sale_price || 0) : 0;
    const activeCost = selectedProduct ? (parseFloat(simCost) || selectedProduct.cost_price || 0) : 0;
    const contributionMargin = activePrice - activeCost;
    const breakEvenUnits = contributionMargin > 0 ? Math.ceil(totalFixedCosts / contributionMargin) : 0;
    const breakEvenRevenue = breakEvenUnits * activePrice;

    const handleSelectProduct = (prod) => {
        setSelectedProduct(prod);
        setSimPrice((prod.sale_price || 0).toString());
        setSimCost((prod.cost_price || 0).toString());
        setShowProductModal(false);
    };

    const filteredProducts = products.filter(p => 
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleShare = async () => {
        if (!selectedProduct) return;
        const msg = `📊 *SIMULADOR PUNTO DE EQUILIBRIO - DBE* 📊\n\n` +
                    `🏢 *Costos Fijos Mensuales:* $${totalFixedCosts.toLocaleString('es-AR')}\n` +
                    `📦 *Producto:* ${selectedProduct.name}\n` +
                    `💵 *Precio de Venta Simulado:* $${activePrice.toLocaleString('es-AR')}\n` +
                    `📉 *Costo Variable Simulado:* $${activeCost.toLocaleString('es-AR')}\n` +
                    `📈 *Margen de Contribución:* $${contributionMargin.toLocaleString('es-AR')}\n\n` +
                    `🎯 *META DE VENTAS:* \n` +
                    `👉 Debes vender un mínimo de *${breakEvenUnits} unidades* al mes para cubrir tus costos fijos.\n` +
                    `💰 *Facturación Mínima requerida:* $${breakEvenRevenue.toLocaleString('es-AR')}\n\n` +
                    `¡Vamos por el Imperio! 👑`;
        try {
            await Share.share({ message: msg });
        } catch (e) {
            Alert.alert('Error', 'No se pudo compartir.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerTop}>
                    <TouchableOpacity onPress={() => navigation.goBack()}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>PUNTO DE EQUILIBRIO</Text>
                    <View style={{ width: 24 }} />
                </View>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scroll}>
                {/* 1. Explicación */}
                <View style={styles.helpBox}>
                    <MaterialCommunityIcons name="information" size={20} color="#d4af37" />
                    <Text style={styles.helpText}>
                        Fórmula Imperial del Canvas: {"\n"}
                        <Text style={{ fontWeight: 'bold', color: '#fff' }}>
                            Punto de Equilibrio = Costos Fijos ÷ Margen de Contribución
                        </Text> {"\n"}
                        Te permite calcular la cantidad mínima que debés vender para no perder dinero.
                    </Text>
                </View>

                {/* 2. Costos Fijos */}
                <Text style={styles.sectionTitle}>1. COSTOS FIJOS MENSUALES ($)</Text>
                <View style={styles.card}>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Alquiler / Espacio:</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={rent}
                            onChangeText={(val) => handleFixedCostChange('rent', val, setRent)}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Servicios (Luz/Agua/Internet):</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={utilities}
                            onChangeText={(val) => handleFixedCostChange('utilities', val, setUtilities)}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Sueldos / Mano de Obra Fija:</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={salaries}
                            onChangeText={(val) => handleFixedCostChange('salaries', val, setSalaries)}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Marketing y Publicidad:</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={marketing}
                            onChangeText={(val) => handleFixedCostChange('marketing', val, setMarketing)}
                        />
                    </View>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>Otros gastos fijos:</Text>
                        <TextInput
                            style={styles.input}
                            keyboardType="numeric"
                            value={others}
                            onChangeText={(val) => handleFixedCostChange('others', val, setOthers)}
                        />
                    </View>

                    <View style={styles.divider} />
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>COSTOS FIJOS TOTALES:</Text>
                        <Text style={styles.totalValue}>${totalFixedCosts.toLocaleString('es-AR')}</Text>
                    </View>
                </View>

                {/* 3. Selección de Producto */}
                <Text style={styles.sectionTitle}>2. ELEGIR UN PRODUCTO PARA SIMULAR</Text>
                <TouchableOpacity 
                    style={styles.selectorCard} 
                    onPress={() => setShowProductModal(true)}
                >
                    <MaterialCommunityIcons name="package-variant" size={24} color="#d4af37" />
                    <Text style={styles.selectorText}>
                        {selectedProduct ? selectedProduct.name : 'Toca para elegir un producto del catálogo...'}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={24} color="#666" />
                </TouchableOpacity>

                {selectedProduct && (
                    <>
                        {/* 4. Simulador Dinámico */}
                        <Text style={styles.sectionTitle}>3. SIMULAR MÁRGENES DE VENTA</Text>
                        <View style={styles.card}>
                            <View style={styles.inputRow}>
                                <Text style={styles.inputLabel}>Precio de Venta ($):</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: '#d4af37' }]}
                                    keyboardType="numeric"
                                    value={simPrice}
                                    onChangeText={setSimPrice}
                                />
                            </View>
                            <View style={styles.inputRow}>
                                <Text style={styles.inputLabel}>Costo Variable / Base ($):</Text>
                                <TextInput
                                    style={[styles.input, { borderColor: '#555' }]}
                                    keyboardType="numeric"
                                    value={simCost}
                                    onChangeText={setSimCost}
                                />
                            </View>

                            <View style={styles.divider} />
                            <View style={styles.totalRow}>
                                <Text style={styles.totalLabel}>Margen de Contribución Unitario:</Text>
                                <Text style={[styles.totalValue, { color: contributionMargin > 0 ? '#2ecc71' : '#e74c3c' }]}>
                                    ${contributionMargin.toLocaleString('es-AR')}
                                </Text>
                            </View>
                        </View>

                        {/* 5. Resultados del Punto de Equilibrio */}
                        <Text style={styles.sectionTitle}>4. META MÍNIMA DE VENTAS</Text>
                        <View style={[styles.card, { borderColor: '#d4af37', borderWidth: 1 }]}>
                            {contributionMargin <= 0 ? (
                                <View style={{ paddingVertical: 10, alignItems: 'center' }}>
                                    <MaterialCommunityIcons name="alert-circle" size={40} color="#e74c3c" />
                                    <Text style={{ color: '#e74c3c', fontWeight: 'bold', marginTop: 10, textAlign: 'center' }}>
                                        El margen de contribución debe ser positivo (Precio de venta mayor al costo) para cubrir costos fijos.
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={styles.resultBox}>
                                        <Text style={styles.resultValue}>{breakEvenUnits}</Text>
                                        <Text style={styles.resultLabel}>UNIDADES MÍNIMAS A VENDER</Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.inputRow}>
                                        <Text style={styles.inputLabel}>Facturación Mínima requerida:</Text>
                                        <Text style={[styles.totalValue, { fontSize: 16 }]}>
                                            ${breakEvenRevenue.toLocaleString('es-AR')}
                                        </Text>
                                    </View>
                                    <Text style={styles.resultExplanation}>
                                        * Para pagar tus costos fijos de <Text style={{ color: '#fff', fontWeight: 'bold' }}>${totalFixedCosts.toLocaleString('es-AR')}</Text> mensuales, debés vender al menos <Text style={{ color: '#d4af37', fontWeight: 'bold' }}>{breakEvenUnits} unidades</Text> de este producto.
                                    </Text>

                                    <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
                                        <LinearGradient colors={['#d4af37', '#8e6d13']} style={styles.shareGrad}>
                                            <MaterialCommunityIcons name="whatsapp" size={20} color="#000" />
                                            <Text style={styles.shareText}>COMPARTIR META CON EL EQUIPO</Text>
                                        </LinearGradient>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </>
                )}
            </ScrollView>

            {/* Product Selector Modal */}
            <Modal visible={showProductModal} animationType="slide" transparent>
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>SELECCIONAR PRODUCTO</Text>
                            <TouchableOpacity onPress={() => setShowProductModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar producto por nombre..."
                            placeholderTextColor="#555"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />

                        {loading ? (
                            <ActivityIndicator size="large" color="#d4af37" style={{ marginTop: 50 }} />
                        ) : (
                            <FlatList
                                data={filteredProducts}
                                keyExtractor={(item) => item.id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity 
                                        style={styles.productItem}
                                        onPress={() => handleSelectProduct(item)}
                                    >
                                        <View>
                                            <Text style={styles.productItemName}>{item.name}</Text>
                                            <Text style={styles.productItemPrice}>
                                                Precio: ${item.sale_price} | Costo: ${item.cost_price}
                                            </Text>
                                        </View>
                                        <MaterialCommunityIcons name="chevron-right" size={20} color="#d4af37" />
                                    </TouchableOpacity>
                                )}
                                ItemSeparatorComponent={() => <View style={styles.itemSeparator} />}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    scroll: { padding: 20 },
    sectionTitle: { color: '#d4af37', fontSize: 11, fontWeight: '900', letterSpacing: 1.5, marginBottom: 12, marginTop: 15 },
    
    helpBox: { flexDirection: 'row', backgroundColor: '#d4af3710', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#d4af3730', gap: 12, marginBottom: 15 },
    helpText: { color: '#aaa', fontSize: 12, flex: 1, lineHeight: 18 },

    card: { backgroundColor: '#0c0c0c', padding: 18, borderRadius: 16, borderStyle: 'solid', borderWidth: 1, borderColor: '#151515', gap: 12, marginBottom: 15 },
    inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    inputLabel: { color: '#888', fontSize: 13, fontWeight: 'bold' },
    input: { backgroundColor: '#151515', color: '#fff', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 100, textAlign: 'right', borderWidth: 1, borderColor: '#222', fontSize: 14 },
    
    divider: { height: 1, backgroundColor: '#222', marginVertical: 4 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    totalLabel: { color: '#fff', fontSize: 13, fontWeight: '900' },
    totalValue: { color: '#d4af37', fontSize: 18, fontWeight: '900' },

    selectorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0c0c0c', padding: 18, borderRadius: 16, borderStyle: 'solid', borderWidth: 1, borderColor: '#151515', gap: 12, marginBottom: 15 },
    selectorText: { color: '#ccc', fontSize: 13, flex: 1, fontWeight: '600' },

    resultBox: { alignItems: 'center', paddingVertical: 15 },
    resultValue: { color: '#d4af37', fontSize: 56, fontWeight: '900' },
    resultLabel: { color: '#888', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    resultExplanation: { color: '#777', fontSize: 12, lineHeight: 18, marginTop: 10, fontStyle: 'italic', textAlign: 'center' },

    shareBtn: { marginTop: 20, borderRadius: 12, overflow: 'hidden' },
    shareGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, gap: 10 },
    shareText: { color: '#000', fontWeight: '900', fontSize: 13, letterSpacing: 0.5 },

    // Modal
    modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalContent: { height: '80%', backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, borderWidth: 1, borderColor: '#d4af3730' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    modalTitle: { color: '#d4af37', fontSize: 14, fontWeight: '900', letterSpacing: 1.5 },
    searchInput: { backgroundColor: '#111', color: '#fff', borderRadius: 12, padding: 14, fontSize: 14, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    productItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
    productItemName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    productItemPrice: { color: '#555', fontSize: 11, marginTop: 4 },
    itemSeparator: { height: 1, backgroundColor: '#111' }
});
