import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Modal, ActivityIndicator, StatusBar, ScrollView, Alert, Platform, Share } from 'react-native';
import { supabase } from '../services/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import { useProductStore } from '../store/useProductStore';
import { GeminiService } from '../services/geminiService';

export default function CombosScreen({ navigation }) {
    const { products } = useProductStore();
    const [activeTab, setActiveTab] = useState('list'); // 'list' | 'simulator'
    const [combos, setCombos] = useState([]);
    const [loading, setLoading] = useState(false);

    // Simulator State
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [customCost, setCustomCost] = useState('');
    const [customSalePrice, setCustomSalePrice] = useState('');
    const [selectedStrategy, setSelectedStrategy] = useState('decoy'); // 'decoy' | 'compromise' | 'tiered'
    const [simulatedCombo, setSimulatedCombo] = useState(null);
    const [simLoading, setSimLoading] = useState(false);
    const [productSearch, setProductSearch] = useState('');
    const [showProductPicker, setShowProductPicker] = useState(false);

    // Initial default combos (saved once)
    const DEFAULT_COMBOS = [
        {
            title: 'Efecto Señuelo: Bolsas de Lavadora',
            strategy: 'decoy',
            description: 'Diseñado para empujar al cliente a la opción de mayor volumen (3 unidades) haciendo que el incremento de precio parezca irrelevante.',
            options: [
                { label: 'Opción A (Económica)', detail: '1 Bolsa lavadora de zapatillas', price: 10000 },
                { label: 'Opción B (El Señuelo)', detail: '2 Bolsas lavadora de zapatillas', price: 18000 },
                { label: 'Opción C (El Objetivo)', detail: '3 Bolsas lavadora de zapatillas', price: 20000 }
            ],
            explanation: 'La Opción B (Señuelo) está asimétricamente dominada por la Opción C. El cliente siente que por solo $2.000 adicionales se lleva una tercera bolsa entera, lo que hace que decida de forma natural gastar el doble de su presupuesto inicial.',
            isDefault: true
        },
        {
            title: 'Efecto Compromiso: Seguridad RFID',
            strategy: 'compromise',
            description: 'Estructura de tres escalones donde el cliente tiende a evitar los extremos y se refugia en la opción intermedia.',
            options: [
                { label: 'Opción A (Básico)', detail: '1 Tarjeta RFID suelta', price: 4000 },
                { label: 'Opción B (Compromiso)', detail: '2 Tarjetas RFID + 1 Funda de Aluminio', price: 8500 },
                { label: 'Opción C (Premium)', detail: '5 Tarjetas RFID + 3 Fundas de Aluminio', price: 18000 }
            ],
            explanation: 'Los clientes no quieren la opción más barata (por miedo a baja calidad) ni la más cara (por considerarla excesiva). La opción intermedia ofrece una compra segura y balanceada que eleva el ticket promedio de $4.000 a $8.500.',
            isDefault: true
        },
        {
            title: 'Combos Escalonados: Cuidado & Organización',
            strategy: 'tiered',
            description: 'Escalera de valor ascendente utilizando artículos de bajo costo de adquisición como anclas de valor.',
            options: [
                { label: 'Escalón 1: Cuidado Esencial', detail: '1 Bolsa lavadora + 1 Soporte magnético', price: 15000 },
                { label: 'Escalón 2: Hogar Organizado (Recomendado)', detail: '2 Bolsas lavadoras + 2 Soportes magnéticos + 1 Tarjeta RFID gratis', price: 26000 },
                { label: 'Escalón 3: Clean & Safety Completo', detail: '4 Bolsas lavadoras + 3 Soportes magnéticos + 2 Tarjetas RFID + Envío gratis', price: 44000 }
            ],
            explanation: 'Los soportes magnéticos (costo real de adquisición $0) y las tarjetas RFID funcionan como regalos de altísimo valor percibido para justificar los saltos de escalón, maximizando el margen de ganancia real.',
            isDefault: true
        }
    ];

    useEffect(() => {
        loadCombos();
    }, []);

    const seedDefaultCombos = async () => {
        try {
            const seedData = DEFAULT_COMBOS.map(c => ({
                title: c.title,
                type: 'psychological_combo',
                description: JSON.stringify({
                    strategy: c.strategy,
                    description: c.description,
                    options: c.options,
                    explanation: c.explanation,
                    isDefault: true
                }),
                active: true,
                value: 0,
                min_qty: 1
            }));

            const { data, error } = await supabase
                .from('promotions')
                .insert(seedData)
                .select();

            if (error) throw error;
            
            if (data) {
                const parsedCombos = data.map(p => {
                    const parsedDesc = JSON.parse(p.description);
                    return {
                        id: p.id,
                        title: p.title,
                        strategy: parsedDesc.strategy,
                        description: parsedDesc.description,
                        options: parsedDesc.options,
                        explanation: parsedDesc.explanation,
                        isDefault: parsedDesc.isDefault || false
                    };
                });
                setCombos(parsedCombos);
            }
        } catch (e) {
            console.error('Error seeding default combos:', e);
        }
    };

    const loadCombos = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('promotions')
                .select('*')
                .eq('type', 'psychological_combo');

            if (error) throw error;

            if (data && data.length > 0) {
                const parsedCombos = data.map(p => {
                    try {
                        const parsedDesc = JSON.parse(p.description);
                        return {
                            id: p.id,
                            title: p.title,
                            strategy: parsedDesc.strategy,
                            description: parsedDesc.description,
                            options: parsedDesc.options,
                            explanation: parsedDesc.explanation,
                            isDefault: parsedDesc.isDefault || false
                        };
                    } catch (e) {
                        return null;
                    }
                }).filter(Boolean);
                
                const hasDefaults = parsedCombos.some(c => c.isDefault);
                if (!hasDefaults) {
                    await seedDefaultCombos();
                } else {
                    setCombos(parsedCombos);
                }
            } else {
                await seedDefaultCombos();
            }
        } catch (e) {
            console.error('Error loading combos:', e);
            Alert.alert('Error', 'No se pudieron cargar los combos de Supabase.');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectProduct = (product) => {
        setSelectedProduct(product);
        setCustomCost(product.cost_price?.toString() || '0');
        setCustomSalePrice(product.sale_price?.toString() || '0');
        setShowProductPicker(false);
        setSimulatedCombo(null);
    };

    const handleSimulate = async () => {
        if (!selectedProduct) {
            Alert.alert('Atención', 'Por favor selecciona un producto base.');
            return;
        }

        const cost = parseFloat(customCost) || 0;
        const unitPrice = parseFloat(customSalePrice) || 0;

        if (unitPrice <= 0) {
            Alert.alert('Atención', 'El precio unitario de venta debe ser mayor a 0.');
            return;
        }

        setSimLoading(true);
        try {
            let simulated = null;
            
            if (selectedStrategy === 'decoy') {
                const priceA = unitPrice;
                const priceB = Math.round((unitPrice * 1.8) / 100) * 100;
                const priceC = Math.round((unitPrice * 2.0) / 100) * 100;

                simulated = {
                    title: `Combo Señuelo: ${selectedProduct.name}`,
                    strategy: 'decoy',
                    description: `Estructura de precios psicológica para potenciar las ventas de ${selectedProduct.name} en packs de 3 unidades.`,
                    options: [
                        { label: 'Opción A (Económica)', detail: `1 Unidad de ${selectedProduct.name}`, price: priceA },
                        { label: 'Opción B (El Señuelo)', detail: `2 Unidades de ${selectedProduct.name}`, price: priceB },
                        { label: 'Opción C (El Objetivo)', detail: `3 Unidades de ${selectedProduct.name}`, price: priceC }
                    ],
                    explanation: `El cliente compara la opción de 2 unidades ($${priceB.toLocaleString('es-AR')}) con la de 3 unidades ($${priceC.toLocaleString('es-AR')}) y percibe que la tercera unidad cuesta casi nada ($${(priceC - priceB).toLocaleString('es-AR')}), impulsándolo a elegir la opción más alta. El margen del combo completo es del ${cost > 0 ? (((priceC - (cost * 3)) / (cost * 3)) * 100).toFixed(0) : 100}%.`
                };
            } else if (selectedStrategy === 'compromise') {
                const priceA = unitPrice;
                const priceB = Math.round((unitPrice * 2.1) / 100) * 100;
                const priceC = Math.round((unitPrice * 4.2) / 100) * 100;

                simulated = {
                    title: `Combo Compromiso: ${selectedProduct.name}`,
                    strategy: 'compromise',
                    description: `Diseño de tres niveles para empujar al cliente hacia el nivel medio (Opción B) como la opción más sensata.`,
                    options: [
                        { label: 'Opción A (Básico)', detail: `1 Unidad de ${selectedProduct.name}`, price: priceA },
                        { label: 'Opción B (Compromiso)', detail: `2 Unidades de ${selectedProduct.name} + Accesorio de regalo`, price: priceB },
                        { label: 'Opción C (Premium)', detail: `4 Unidades de ${selectedProduct.name} + Accesorios VIP + Envío`, price: priceC }
                    ],
                    explanation: `El cliente promedio evita los extremos: descarta la Opción A por considerarla insuficiente y la Opción C por ser costosa, terminando por comprar la Opción B de $${priceB.toLocaleString('es-AR')}. Esto eleva tu ticket promedio un 110% sobre la venta individual.`
                };
            } else {
                const priceA = unitPrice;
                const priceB = Math.round((unitPrice * 2.4) / 100) * 100;
                const priceC = Math.round((unitPrice * 4.0) / 100) * 100;

                simulated = {
                    title: `Combo Escalonado: Especial ${selectedProduct.name}`,
                    strategy: 'tiered',
                    description: `Escalera de valor de tres niveles con regalos anclados para incentivar compras de mayor volumen.`,
                    options: [
                        { label: 'Escalón 1: Esencial', detail: `1 Unidad de ${selectedProduct.name}`, price: priceA },
                        { label: 'Escalón 2: Recomendado', detail: `2 Unidades de ${selectedProduct.name} + Regalo Sorpresa`, price: priceB },
                        { label: 'Escalón 3: Cuidado Full', detail: `3 Unidades de ${selectedProduct.name} + 2 Regalos + Envío Gratis`, price: priceC }
                    ],
                    explanation: `Ofrece alternativas de escala claras para que clientes de distintos presupuestos se auto-segmenten, logrando enganchar a los compradores VIP en el nivel superior de $${priceC.toLocaleString('es-AR')}.`
                };
            }

            try {
                const prompt = `Actúa como especialista en pricing psicológico. 
Mejora el título, la descripción de las 3 opciones y la explicación comercial de este combo basado en la estrategia de ${selectedStrategy === 'decoy' ? 'Efecto Señuelo' : selectedStrategy === 'compromise' ? 'Efecto Compromiso' : 'Combos Escalonados'}.
Producto: "${selectedProduct.name}".
Precio unitario original de venta: $${unitPrice}.
Precio sugerido Opción A: $${simulated.options[0].price}.
Precio sugerido Opción B: $${simulated.options[1].price}.
Precio sugerido Opción C: $${simulated.options[2].price}.

Devuelve estrictamente un objeto JSON con las siguientes claves:
"title": (Título llamativo e inspirador para el vendedor),
"description": (Breve resumen del combo),
"optionA_detail": (Detalle comercial persuasivo de la opción A),
"optionB_detail": (Detalle comercial persuasivo de la opción B),
"optionC_detail": (Detalle comercial persuasivo de la opción C),
"explanation": (Análisis psicológico de por qué venderá y margen comercial).`;

                const aiResponse = await GeminiService.handleGeneralRequest(prompt);
                const cleanJson = aiResponse.substring(aiResponse.indexOf('{'), aiResponse.lastIndexOf('}') + 1);
                const parsed = JSON.parse(cleanJson);
                
                if (parsed.title) simulated.title = parsed.title;
                if (parsed.description) simulated.description = parsed.description;
                if (parsed.optionA_detail) simulated.options[0].detail = parsed.optionA_detail;
                if (parsed.optionB_detail) simulated.options[1].detail = parsed.optionB_detail;
                if (parsed.optionC_detail) simulated.options[2].detail = parsed.optionC_detail;
                if (parsed.explanation) simulated.explanation = parsed.explanation;
            } catch (aiErr) {
                console.log('Gemini pricing refinement skipped, using local fallback calculations:', aiErr.message);
            }

            setSimulatedCombo(simulated);
        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'No se pudo simular la combinación.');
        } finally {
            setSimLoading(false);
        }
    };

    const handleSaveSimulated = async () => {
        if (!simulatedCombo) return;

        try {
            const newPromo = {
                title: simulatedCombo.title,
                type: 'psychological_combo',
                description: JSON.stringify({
                    strategy: simulatedCombo.strategy,
                    description: simulatedCombo.description,
                    options: simulatedCombo.options,
                    explanation: simulatedCombo.explanation,
                    isDefault: false
                }),
                active: true,
                value: 0,
                min_qty: 1
            };

            const { data, error } = await supabase
                .from('promotions')
                .insert([newPromo])
                .select()
                .single();

            if (error) throw error;

            if (data) {
                const parsedDesc = JSON.parse(data.description);
                const savedCombo = {
                    id: data.id,
                    title: data.title,
                    strategy: parsedDesc.strategy,
                    description: parsedDesc.description,
                    options: parsedDesc.options,
                    explanation: parsedDesc.explanation,
                    isDefault: false
                };
                setCombos(prev => [...prev, savedCombo]);
                Alert.alert('¡Éxito!', 'El combo ha sido guardado permanentemente en Supabase.');
                setActiveTab('list');
                setSelectedProduct(null);
                setSimulatedCombo(null);
            }
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'No se pudo guardar el combo en Supabase.');
        }
    };

    const handleDeleteCombo = async (id) => {
        Alert.alert(
            'Eliminar Combo',
            '¿Estás seguro de que deseas eliminar este combo guardado?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'SÍ, ELIMINAR',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const { error } = await supabase
                                .from('promotions')
                                .delete()
                                .eq('id', id);

                            if (error) throw error;
                            
                            setCombos(prev => prev.filter(c => c.id !== id));
                        } catch (e) {
                            console.error(e);
                            Alert.alert('Error', 'No se pudo eliminar el combo.');
                        }
                    }
                }
            ]
        );
    };

    const handleShareCombo = async (combo) => {
        const text = `🔥 *OFERTA EXCLUSIVA - DIGITAL BOOST EMPIRE* 🔥\n\n${combo.title}\n_${combo.description}_\n\n` +
            combo.options.map(o => `👉 *${o.label}:* ${o.detail} ➔ *$${o.price.toLocaleString('es-AR')}*`).join('\n') +
            `\n\n📢 ¡Elegí la opción que mejor te convenga y escribinos para reservar la tuya! 📦🚀`;

        try {
            await Share.share({
                title: combo.title,
                message: text
            });
        } catch (e) {
            console.error(e);
        }
    };

    const renderComboCard = ({ item }) => {
        const stratColor = item.strategy === 'decoy' ? '#e74c3c' : item.strategy === 'compromise' ? '#3498db' : '#2ecc71';
        const stratLabel = item.strategy === 'decoy' ? 'SEÑUELO' : item.strategy === 'compromise' ? 'COMPROMISO' : 'ESCALONADO';

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <View style={[styles.strategyBadge, { borderColor: stratColor + '40', backgroundColor: stratColor + '15' }]}>
                        <Text style={[styles.strategyBadgeText, { color: stratColor }]}>{stratLabel}</Text>
                    </View>
                </View>

                <Text style={styles.cardDesc}>{item.description}</Text>

                {/* Tier/Options list */}
                <View style={styles.optionsList}>
                    {item.options.map((opt, idx) => (
                        <View key={idx} style={styles.optionRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.optionLabel}>{opt.label}</Text>
                                <Text style={styles.optionDetail}>{opt.detail}</Text>
                            </View>
                            <Text style={styles.optionPrice}>${opt.price.toLocaleString('es-AR')}</Text>
                        </View>
                    ))}
                </View>

                {/* Psychology breakdown */}
                <View style={styles.explanationBox}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <MaterialCommunityIcons name="brain" size={14} color="#d4af37" />
                        <Text style={{ fontSize: 9, fontWeight: '900', color: '#d4af37', letterSpacing: 1 }}>ARQUITECTURA PSICOLÓGICA</Text>
                    </View>
                    <Text style={styles.explanationText}>{item.explanation}</Text>
                </View>

                <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.shareBtn} onPress={() => handleShareCombo(item)}>
                        <MaterialCommunityIcons name="share-variant" size={16} color="#000" />
                        <Text style={styles.shareBtnText}>Compartir Oferta</Text>
                    </TouchableOpacity>
                    
                    {!item.isDefault && (
                        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeleteCombo(item.id)}>
                            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ff4757" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#121212']} style={styles.background} />

            {/* Header */}
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>COMBOS DE VALOR</Text>
                    <View style={{ width: 40 }} />
                </View>
            </LinearGradient>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'list' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('list')}
                >
                    <MaterialCommunityIcons name="format-list-bulleted" size={18} color={activeTab === 'list' ? '#000' : '#888'} />
                    <Text style={[styles.tabBtnText, activeTab === 'list' && styles.tabBtnTextActive]}>Mis Combos</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                    style={[styles.tabBtn, activeTab === 'simulator' && styles.tabBtnActive]}
                    onPress={() => setActiveTab('simulator')}
                >
                    <MaterialCommunityIcons name="calculator-variant" size={18} color={activeTab === 'simulator' ? '#000' : '#888'} />
                    <Text style={[styles.tabBtnText, activeTab === 'simulator' && styles.tabBtnTextActive]}>Simulador</Text>
                </TouchableOpacity>
            </View>

            {activeTab === 'list' ? (
                <FlatList
                    data={combos}
                    keyExtractor={item => item.id}
                    renderItem={renderComboCard}
                    contentContainerStyle={styles.listContainer}
                    refreshing={loading}
                    onRefresh={loadCombos}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <MaterialCommunityIcons name="package-variant" size={48} color="#333" />
                            <Text style={styles.emptyText}>No hay combos guardados.</Text>
                        </View>
                    }
                />
            ) : (
                <ScrollView contentContainerStyle={styles.simContainer} showsVerticalScrollIndicator={false}>
                    <Text style={styles.simTitle}>Simular Estrategia de Combo</Text>
                    <Text style={styles.simSubtitle}>Elegí un producto base de tu inventario y el algoritmo de Empire calculará los precios y escalonamientos ideales.</Text>

                    {/* Product Picker */}
                    <Text style={styles.label}>PRODUCTO BASE:</Text>
                    <TouchableOpacity style={styles.pickerTrigger} onPress={() => setShowProductPicker(true)}>
                        <Text style={[styles.pickerTriggerText, selectedProduct && { color: '#fff' }]}>
                            {selectedProduct ? selectedProduct.name : 'Toca para elegir producto...'}
                        </Text>
                        <MaterialCommunityIcons name="chevron-down" size={20} color="#888" />
                    </TouchableOpacity>

                    {selectedProduct && (
                        <View style={styles.pricesRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>COSTO COMPRA ($):</Text>
                                <TextInput
                                    style={styles.simInput}
                                    value={customCost}
                                    onChangeText={setCustomCost}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.label}>PRECIO UNITARIO ($):</Text>
                                <TextInput
                                    style={styles.simInput}
                                    value={customSalePrice}
                                    onChangeText={setCustomSalePrice}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    )}

                    {/* Strategy Selector */}
                    <Text style={styles.label}>ESTRATEGIA PSICOLÓGICA:</Text>
                    <View style={styles.strategySelector}>
                        {[
                            { key: 'decoy', label: 'Decoy (Señuelo)', icon: 'target' },
                            { key: 'compromise', label: 'Compromiso', icon: 'scale-balance' },
                            { key: 'tiered', label: 'Escalonados', icon: 'stairs' }
                        ].map(strat => (
                            <TouchableOpacity
                                key={strat.key}
                                style={[styles.stratBtn, selectedStrategy === strat.key && styles.stratBtnActive]}
                                onPress={() => { setSelectedStrategy(strat.key); setSimulatedCombo(null); }}
                            >
                                <MaterialCommunityIcons name={strat.icon} size={20} color={selectedStrategy === strat.key ? '#000' : '#888'} />
                                <Text style={[styles.stratBtnText, selectedStrategy === strat.key && styles.stratBtnTextActive]}>{strat.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <TouchableOpacity style={styles.simulateBtn} onPress={handleSimulate}>
                        {simLoading ? (
                            <ActivityIndicator color="black" />
                        ) : (
                            <>
                                <MaterialCommunityIcons name="wizard-hat" size={20} color="black" />
                                <Text style={styles.simulateBtnText}>Simular Estructura Psicológica</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Simulated Results Card */}
                    {simulatedCombo && (
                        <View style={[styles.card, { marginTop: 25, borderColor: '#d4af37' }]}>
                            <View style={styles.cardHeader}>
                                <Text style={styles.cardTitle}>{simulatedCombo.title}</Text>
                                <Text style={styles.newBadge}>NUEVO PRE-PREPARADO</Text>
                            </View>
                            
                            <Text style={styles.cardDesc}>{simulatedCombo.description}</Text>

                            <View style={styles.optionsList}>
                                {simulatedCombo.options.map((opt, idx) => (
                                    <View key={idx} style={styles.optionRow}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.optionLabel}>{opt.label}</Text>
                                            <Text style={styles.optionDetail}>{opt.detail}</Text>
                                        </View>
                                        <Text style={styles.optionPrice}>${opt.price.toLocaleString('es-AR')}</Text>
                                    </View>
                                ))}
                            </View>

                            <View style={styles.explanationBox}>
                                <Text style={styles.explanationText}>{simulatedCombo.explanation}</Text>
                            </View>

                            <TouchableOpacity style={styles.saveComboBtn} onPress={handleSaveSimulated}>
                                <MaterialCommunityIcons name="content-save" size={18} color="black" />
                                <Text style={styles.saveComboBtnText}>Guardar en Supabase</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            )}

            {/* PRODUCT PICKER MODAL */}
            <Modal visible={showProductPicker} animationType="slide" transparent>
                <View style={styles.pickerOverlay}>
                    <View style={styles.pickerContent}>
                        <View style={styles.pickerHeader}>
                            <Text style={styles.pickerTitle}>Seleccionar Producto Base</Text>
                            <TouchableOpacity onPress={() => setShowProductPicker(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchWrapper}>
                            <MaterialCommunityIcons name="magnify" size={20} color="#666" />
                            <TextInput
                                style={styles.pickerSearchInput}
                                placeholder="Filtrar por nombre..."
                                placeholderTextColor="#555"
                                value={productSearch}
                                onChangeText={setProductSearch}
                            />
                        </View>

                        <FlatList
                            data={products.filter(p => !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase()))}
                            keyExtractor={item => item.id}
                            renderItem={({ item }) => (
                                <TouchableOpacity style={styles.pickerItem} onPress={() => handleSelectProduct(item)}>
                                    <Text style={styles.pickerItemName} numberOfLines={2}>{item.name}</Text>
                                    <Text style={styles.pickerItemPrice}>Venta: ${item.sale_price?.toLocaleString('es-AR') || 'S/D'}</Text>
                                </TouchableOpacity>
                            )}
                            ItemSeparatorComponent={() => <View style={styles.pickerDivider} />}
                            ListEmptyComponent={
                                <Text style={{ color: '#555', textAlign: 'center', marginTop: 30, fontStyle: 'italic' }}>
                                    No se encontraron productos.
                                </Text>
                            }
                        />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    background: { ...StyleSheet.absoluteFillObject },

    header: { paddingTop: 45, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    backBtn: { padding: 5 },

    // Tabs
    tabsContainer: { flexDirection: 'row', padding: 15, gap: 10 },
    tabBtn: { flex: 1, backgroundColor: '#0c0c0c', paddingVertical: 12, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: '#181818' },
    tabBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    tabBtnText: { color: '#888', fontSize: 13, fontWeight: 'bold' },
    tabBtnTextActive: { color: '#000' },

    listContainer: { paddingHorizontal: 20, paddingBottom: 50 },
    emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 100 },
    emptyText: { color: '#555', marginTop: 15, fontStyle: 'italic' },

    card: { backgroundColor: '#080808', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#181818' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 10 },
    cardTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold', flex: 1 },
    strategyBadge: { borderHeight: 1, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    strategyBadgeText: { fontSize: 8, fontWeight: '900', letterSpacing: 0.5 },
    cardDesc: { color: '#777', fontSize: 12, lineHeight: 18, marginBottom: 15 },

    optionsList: { backgroundColor: '#040404', borderRadius: 10, padding: 12, marginBottom: 15, borderWidth: 1, borderColor: '#121212' },
    optionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#121212' },
    optionLabel: { color: '#d4af37', fontSize: 11, fontWeight: '900', letterSpacing: 0.5, marginBottom: 2 },
    optionDetail: { color: '#aaa', fontSize: 12 },
    optionPrice: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

    explanationBox: { backgroundColor: '#111', borderRadius: 10, padding: 12, marginBottom: 15 },
    explanationText: { color: '#ccc', fontSize: 11, lineHeight: 18, fontStyle: 'italic' },

    cardActions: { flexDirection: 'row', gap: 10, justifyContent: 'space-between', alignItems: 'center' },
    shareBtn: { backgroundColor: '#d4af37', flex: 1, paddingVertical: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    shareBtnText: { color: '#000', fontSize: 12, fontWeight: 'bold' },
    deleteBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#ff475715', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ff475730' },

    // Simulator
    simContainer: { padding: 25, paddingBottom: 60 },
    simTitle: { color: '#fff', fontSize: 20, fontWeight: '900', marginBottom: 8, letterSpacing: 0.5 },
    simSubtitle: { color: '#666', fontSize: 12, lineHeight: 18, marginBottom: 25 },
    
    label: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 8, marginTop: 15 },
    pickerTrigger: { backgroundColor: '#080808', padding: 18, borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderWidth: 1, borderColor: '#181818' },
    pickerTriggerText: { color: '#555', fontSize: 14, fontWeight: 'bold' },
    
    pricesRow: { flexDirection: 'row', gap: 15, marginTop: 5 },
    simInput: { backgroundColor: '#080808', padding: 18, borderRadius: 12, color: '#fff', fontSize: 15, borderWidth: 1, borderColor: '#181818' },

    strategySelector: { flexDirection: 'row', gap: 8, marginTop: 5 },
    stratBtn: { flex: 1, backgroundColor: '#0c0c0c', paddingVertical: 12, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#181818' },
    stratBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    stratBtnText: { color: '#666', fontSize: 9, fontWeight: 'bold' },
    stratBtnTextActive: { color: '#000' },

    simulateBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 25 },
    simulateBtnText: { color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 0.5 },

    newBadge: { backgroundColor: '#d4af3720', color: '#d4af37', fontSize: 8, fontWeight: '900', letterSpacing: 1, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5, overflow: 'hidden' },
    saveComboBtn: { backgroundColor: '#d4af37', padding: 15, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    saveComboBtnText: { color: '#000', fontSize: 13, fontWeight: 'bold' },

    // Picker Modal
    pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    pickerContent: { backgroundColor: '#080808', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 25, height: '80%', borderWidth: 1, borderColor: '#181818' },
    pickerHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    pickerTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    pickerItem: { paddingVertical: 15 },
    pickerItemName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    pickerItemPrice: { color: '#888', fontSize: 12, marginTop: 4 },
    pickerDivider: { height: 1, backgroundColor: '#151515' },
    pickerSearchInput: { flex: 1, color: '#fff', paddingVertical: 12, marginLeft: 10, fontSize: 14 },
    searchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#040404', paddingHorizontal: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#151515' }
});
