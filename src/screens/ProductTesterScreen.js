import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, ScrollView, Modal, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useProductTesterStore } from '../store/useProductTesterStore';

export default function ProductTesterScreen({ navigation }) {
    const { 
        testProducts, 
        streetResults,
        fetchTestProducts, 
        fetchStreetResults,
        addTestProduct, 
        submitStreetTestResult,
        updateMetric, 
        updateStatus, 
        deleteTestProduct, 
        isLoading 
    } = useProductTesterStore();
    
    // Form state
    const [modalVisible, setModalVisible] = useState(false);
    const [name, setName] = useState('');
    const [source, setSource] = useState('AliExpress');
    const [costUsd, setCostUsd] = useState('');
    const [shippingUsd, setShippingUsd] = useState('0');
    const [dollarRate, setDollarRate] = useState('1100');
    const [localShipping, setLocalShipping] = useState('2500');
    const [riskBuffer, setRiskBuffer] = useState('15'); // 15% 
    const [suggestedPrice, setSuggestedPrice] = useState('');
    const [cityTarget, setCityTarget] = useState('Jujuy');
    const [validationType, setValidationType] = useState('hybrid'); // street, digital, hybrid

    // Street Test Modal State
    const [streetModalVisible, setStreetModalVisible] = useState(false);
    const [activeTestProductId, setActiveTestProductId] = useState(null);
    const [streetLocation, setStreetLocation] = useState('');
    const [streetPeopleApproached, setStreetPeopleApproached] = useState('');
    const [streetConversations, setStreetConversations] = useState('');
    const [streetIntent, setStreetIntent] = useState('');
    const [streetSales, setStreetSales] = useState('');
    const [warmSales, setWarmSales] = useState('');
    const [streetObjections, setStreetObjections] = useState('');
    const [testingHours, setTestingHours] = useState('1');
    const [testCostExtra, setTestCostExtra] = useState('');

    useEffect(() => {
        fetchTestProducts();
        fetchStreetResults();
    }, []);

    const calculateCost = () => {
        const cost = parseFloat(costUsd) || 0;
        const shipUsd = parseFloat(shippingUsd) || 0;
        const rate = parseFloat(dollarRate) || 1100;
        const localShipArgs = parseFloat(localShipping) || 0;
        const riskPct = (parseFloat(riskBuffer) || 0) / 100;
        const importTax = 0.5;

        const baseArs = (cost + shipUsd) * rate;
        const FinalTaxed = baseArs * (1 + importTax);
        const finalCostParams = FinalTaxed * (1 + riskPct) + localShipArgs;
        
        return finalCostParams;
    };

    const currentFinalCost = calculateCost();
    const currentMargin = (parseFloat(suggestedPrice) || 0) - currentFinalCost;

    const handleSave = async () => {
        if (!name || !costUsd || !suggestedPrice) {
            Alert.alert('Error', 'Completá nombre, costo USD y precio sugerido');
            return;
        }

        const newProduct = {
            name,
            source_platform: source,
            cost_usd: parseFloat(costUsd),
            shipping_usd: parseFloat(shippingUsd) || 0,
            dollar_rate: parseFloat(dollarRate),
            final_cost_ars: currentFinalCost,
            suggested_price_ars: parseFloat(suggestedPrice),
            margin: currentMargin,
            city_target: cityTarget,
            status: 'testing',
            local_shipping_ars: parseFloat(localShipping) || 0,
            risk_buffer_percent: parseFloat(riskBuffer) || 0,
            validation_type: validationType
        };

        try {
            await addTestProduct(newProduct);
            setModalVisible(false);
            resetForm();
        } catch (e) {
            Alert.alert('Error', 'No se pudo guardar');
        }
    };

    const handleSaveStreetTest = async () => {
        try {
            const { submitStreetTestResult } = useProductTesterStore.getState();
            const hourlyRate = 5000; // Valor de la hora del emprendedor
            const totalTestCostArs = (parseFloat(testingHours) || 1) * hourlyRate + (parseFloat(testCostExtra) || 0);

            await submitStreetTestResult({
                test_product_id: activeTestProductId,
                location: streetLocation,
                people_approached: parseInt(streetPeopleApproached) || 0,
                conversations: parseInt(streetConversations) || 0,
                real_intent: parseInt(streetIntent) || 0,
                sales: parseInt(streetSales) || 0, // Cold sales
                sales_warm: parseInt(warmSales) || 0, // Warm sales
                testing_hours: parseFloat(testingHours) || 1,
                test_cost_ars: totalTestCostArs,
                objections: streetObjections.split(',').map(o => o.trim()).filter(Boolean)
            });
            Alert.alert('🔥 Street Memory', '¡Resultados de calle inyectados directo al cerebro de la IA!');
            setStreetModalVisible(false);
            
            // Auto sumamos el Real Intent detectado en calle al total del producto directamente
            if (parseInt(streetIntent) > 0) {
                handleUpdateMetric(activeTestProductId, 'real_intent_score', parseInt(streetIntent));
            }
        } catch (e) {
            Alert.alert('Error', 'No se pudo reportar a la matrix callejera');
        }
    };

    const resetForm = () => {
        setName('');
        setCostUsd('');
        setShippingUsd('0');
        setSuggestedPrice('');
    };

    const handleUpdateMetric = (id, field, increment) => {
        updateMetric(id, field, increment);
    };

    const renderTestProduct = ({ item }) => {
        const isTesting = item.status === 'testing';
        const renderStatusColor = () => {
            if (item.status === 'validated') return '#2ecc71';
            if (item.status === 'discarded') return '#e74c3c';
            return '#f39c12';
        };

        return (
            <View style={[styles.card, isTesting && styles.cardActive]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.cardTitle}>{item.name}</Text>
                        <Text style={styles.cardSubtitle}>
                            📍 {item.city_target} • 📱 {item.validation_type?.toUpperCase() || 'HYBRID'}
                        </Text>
                    </View>
                    <View style={styles.scoreBadge}>
                        <Text style={styles.scoreText}>🥇 {(
                            ((item.real_intent_score || 0) * 0.6) + 
                            ((item.messages || 0) * 0.2) + 
                            ((item.clicks || 0) * 0.1) + 
                            ((item.views || 0) * 0.1)
                        ).toFixed(1)} Pts</Text>
                    </View>
                </View>

                <View style={styles.financialRow}>
                    <View style={styles.finBox}>
                        <Text style={styles.finLabel}>Costo Final (ARS)</Text>
                        <Text style={styles.finValue}>${Math.round(item.final_cost_ars)}</Text>
                    </View>
                    <View style={styles.finBox}>
                        <Text style={styles.finLabel}>Sugerido (ARS)</Text>
                        <Text style={styles.finValue}>${Math.round(item.suggested_price_ars)}</Text>
                    </View>
                    <View style={styles.finBox}>
                        <Text style={styles.finLabel}>Margen Bruto</Text>
                        <Text style={[styles.finValue, { color: item.margin > 0 ? '#2ecc71' : '#e74c3c' }]}>${Math.round(item.margin)}</Text>
                    </View>
                </View>

                <Text style={styles.sectionDivider}>Métricas de Interés</Text>
                <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricVal}>{item.views || 0}</Text>
                        <Text style={styles.metricLabel}>Vistas</Text>
                        {isTesting && <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'views', 50)} style={styles.btnTiny}><Text style={styles.btnTinyText}>+50</Text></TouchableOpacity>}
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricVal}>{item.clicks || 0}</Text>
                        <Text style={styles.metricLabel}>Clicks</Text>
                        {isTesting && <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'clicks', 5)} style={styles.btnTiny}><Text style={styles.btnTinyText}>+5</Text></TouchableOpacity>}
                    </View>
                    <View style={styles.metricItem}>
                        <Text style={styles.metricVal}>{item.messages || 0}</Text>
                        <Text style={styles.metricLabel}>Mensajes</Text>
                        {isTesting && <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'messages', 1)} style={styles.btnTiny}><Text style={styles.btnTinyText}>+1</Text></TouchableOpacity>}
                    </View>
                </View>

                {/* REAL INTENT SCORE - THE TRUE VALIDATION */}
                <Text style={styles.sectionDivider}>Intent de Compra Real (Valor)</Text>
                <View style={styles.intentMatrix}>
                    <View style={styles.intentScoreBoard}>
                        <MaterialCommunityIcons name="fire" size={24} color="#e74c3c" />
                        <Text style={styles.intentTotal}>{item.real_intent_score || 0}</Text>
                    </View>
                    <View style={styles.intentActions}>
                        <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'real_intent_score', 1)} style={styles.btnIntent1}>
                            <Text style={styles.btnIntentText}>Preguntó (+1)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'real_intent_score', 2)} style={styles.btnIntent2}>
                            <Text style={styles.btnIntentText}>Llega? (+2)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'real_intent_score', 3)} style={styles.btnIntent3}>
                            <Text style={styles.btnIntentText}>Reserva (+3)</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleUpdateMetric(item.id, 'real_intent_score', 5)} style={styles.btnIntent5}>
                            <Text style={styles.btnIntentText}>PAGÓ 🔥 (+5)</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {isTesting && (
                    <TouchableOpacity 
                        style={{ backgroundColor: '#9b59b620', borderColor: '#9b59b6', borderWidth: 1, padding: 12, borderRadius: 10, marginTop: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                        onPress={() => {
                            setActiveTestProductId(item.id);
                            setStreetLocation(item.city_target);
                            setStreetPeopleApproached('');
                            setStreetConversations('');
                            setStreetIntent('');
                            setStreetSales('');
                            setWarmSales('');
                            setTestingHours('1');
                            setTestCostExtra('');
                            setStreetObjections('');
                            setStreetModalVisible(true);
                        }}
                    >
                        <MaterialCommunityIcons name="walk" size={20} color="#9b59b6" />
                        <Text style={{ color: '#9b59b6', fontWeight: 'bold' }}>REGISTRAR MEMORIA CALLEJERA</Text>
                    </TouchableOpacity>
                )}

                {isTesting && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => updateStatus(item.id, 'discarded')} style={[styles.actionBtn, styles.btnReject]}>
                            <MaterialCommunityIcons name="close" size={20} color="#fff" />
                            <Text style={styles.actionBtnText}>DESCARTAR</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => updateStatus(item.id, 'validated')} style={[styles.actionBtn, styles.btnAccept]}>
                            <MaterialCommunityIcons name="check" size={20} color="#000" />
                            <Text style={[styles.actionBtnText, { color: '#000' }]}>VALIDAR</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {!isTesting && (
                    <TouchableOpacity onPress={() => deleteTestProduct(item.id)} style={styles.deleteLinkContainer}>
                        <Text style={styles.deleteLinkText}>Eliminar registro</Text>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>🕵️ Product Testing Engine</Text>
            </View>

            <TouchableOpacity style={styles.addMainBtn} onPress={() => setModalVisible(true)}>
                <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.addBtnGradient}>
                    <MaterialCommunityIcons name="plus-box-multiple" size={20} color="#111" />
                    <Text style={styles.addBtnText}>NUEVO PRODUCTO A TESTEAR</Text>
                </LinearGradient>
            </TouchableOpacity>

            <FlatList
                data={testProducts}
                keyExtractor={item => item.id.toString()}
                renderItem={renderTestProduct}
                contentContainerStyle={{ padding: 15, paddingBottom: 20 }}
                ListEmptyComponent={<Text style={styles.emptyText}>No hay productos en validación actualmente.</Text>}
                ListFooterComponent={() => (
                    <View style={{ marginTop: 20 }}>
                        <Text style={[styles.headerTitle, { fontSize: 18, marginBottom: 15 }]}>📜 Historial de Evidencia Callejera</Text>
                        {streetResults.map((log, idx) => (
                            <View key={idx} style={{ backgroundColor: '#111', padding: 12, borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#9b59b6', marginBottom: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>{log.test_products?.name || 'Producto Desconocido'}</Text>
                                    <View style={{ backgroundColor: '#9b59b620', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                        <Text style={{ color: '#9b59b6', fontSize: 9, fontWeight: 'bold' }}>{log.location}</Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                                    <Text style={{ color: '#888', fontSize: 10 }}>Ventas: <Text style={{ color: '#3498db' }}>{log.sales}</Text></Text>
                                    <Text style={{ color: '#888', fontSize: 10 }}>Warm: <Text style={{ color: '#e67e22' }}>{log.sales_warm}</Text></Text>
                                    <Text style={{ color: '#888', fontSize: 10 }}>Cierre: <Text style={{ color: '#2ecc71' }}>{((log.sales / (log.conversations || 1)) * 100).toFixed(0)}%</Text></Text>
                                </View>
                                {log.objections && log.objections.length > 0 && (
                                    <Text style={{ color: '#666', fontSize: 9, marginTop: 4, fontStyle: 'italic' }}>Objeciones: {(log.objections || []).join(', ')}</Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            />

            {/* MODAL NUEVO TEST */}
            <Modal visible={modalVisible} animationType="slide" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Configurar Test</Text>
                            <TouchableOpacity onPress={() => setModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Nombre / Título de Prueba</Text>
                            <TextInput style={styles.input} placeholder="Ej: Humidificador Volcán" placeholderTextColor="#666" value={name} onChangeText={setName} />
                            
                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Plataforma</Text>
                                    <TextInput style={styles.input} value={source} onChangeText={setSource} />
                                </View>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Tipo de Testing</Text>
                                    <View style={styles.btnRow}>
                                        <TouchableOpacity onPress={() => setValidationType('street')} style={[styles.cityBtn, validationType === 'street' && styles.cityActive]}>
                                            <MaterialCommunityIcons name="walk" size={14} color="#fff" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setValidationType('digital')} style={[styles.cityBtn, validationType === 'digital' && styles.cityActive]}>
                                            <MaterialCommunityIcons name="web" size={14} color="#fff" />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setValidationType('hybrid')} style={[styles.cityBtn, validationType === 'hybrid' && styles.cityActive]}>
                                            <MaterialCommunityIcons name="handshake" size={14} color="#fff" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Ciudad Objetivo</Text>
                                    <View style={styles.btnRow}>
                                        <TouchableOpacity onPress={() => setCityTarget('Jujuy')} style={[styles.cityBtn, cityTarget === 'Jujuy' && styles.cityActive]}>
                                            <Text style={styles.cityText}>Jujuy</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => setCityTarget('Córdoba')} style={[styles.cityBtn, cityTarget === 'Córdoba' && styles.cityActive]}>
                                            <Text style={styles.cityText}>Cba</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.sectionDivider}>Estructura de Costos Reales</Text>
                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Costo (USD)</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="3.50" placeholderTextColor="#666" value={costUsd} onChangeText={setCostUsd} />
                                </View>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Dólar Cotiz</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" value={dollarRate} onChangeText={setDollarRate} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Envío Interno (ARS)</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="2500" placeholderTextColor="#666" value={localShipping} onChangeText={setLocalShipping} />
                                </View>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Colchón Riesgo (%)</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" value={riskBuffer} onChangeText={setRiskBuffer} />
                                </View>
                            </View>

                            <View style={styles.previewBox}>
                                <Text style={styles.previewLabel}>Fórmula Nivel Dios (Costo, Aduana 50%, Riesgo {riskBuffer}%, Envío Arg ${localShipping})</Text>
                                <Text style={styles.previewValue}>Costo Final Real: ${Math.round(currentFinalCost)} ARS</Text>
                            </View>

                            <Text style={styles.label}>Precio de Venta Sugerido (Validación)</Text>
                            <TextInput style={styles.inputHighlight} keyboardType="numeric" placeholder="¿A cuánto lo vas a vender?" placeholderTextColor="#888" value={suggestedPrice} onChangeText={setSuggestedPrice} />

                            <View style={styles.previewBox}>
                                <Text style={styles.previewLabel}>Ganancia Neta por Venta</Text>
                                <Text style={[styles.previewValue, { color: currentMargin > 0 ? '#2ecc71' : '#e74c3c', fontSize: 24 }]}>
                                    MARGEN: ${Math.round(currentMargin)}
                                </Text>
                            </View>

                            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                                <Text style={styles.saveBtnText}>LANZAR PRODUCTO A TESTEO</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* MODAL STREET TEST (Feedback Calle) */}
            <Modal visible={streetModalVisible} animationType="fade" transparent={true}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: '#9b59b6' }]}>Reporte Callejero 🔥</Text>
                            <TouchableOpacity onPress={() => setStreetModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#888" />
                            </TouchableOpacity>
                        </View>
                        
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.label}>Ubicación / Contexto</Text>
                            <TextInput style={styles.input} placeholder="Terminal, Plaza, Peatonal..." placeholderTextColor="#666" value={streetLocation} onChangeText={setStreetLocation} />
                            
                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Personas que abordaste</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="20" placeholderTextColor="#666" value={streetPeopleApproached} onChangeText={setStreetPeopleApproached} />
                                </View>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Conversaciones Reales</Text>
                                    <TextInput style={styles.input} keyboardType="numeric" placeholder="8" placeholderTextColor="#666" value={streetConversations} onChangeText={setStreetConversations} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Intención Real (Seña/Fricción)</Text>
                                    <TextInput style={styles.inputHighlight} keyboardType="numeric" placeholder="2" placeholderTextColor="#888" value={streetIntent} onChangeText={setStreetIntent} />
                                </View>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Ventas Frío (Instantánea)</Text>
                                    <TextInput style={[styles.inputHighlight, { borderColor: '#3498db', color: '#3498db' }]} keyboardType="numeric" placeholder="1" placeholderTextColor="#888" value={streetSales} onChangeText={setStreetSales} />
                                </View>
                            </View>

                            <View style={styles.row}>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Ventas Warm (Retorno/Redes)</Text>
                                    <TextInput style={[styles.inputHighlight, { borderColor: '#e67e22', color: '#e67e22' }]} keyboardType="numeric" placeholder="1" placeholderTextColor="#888" value={warmSales} onChangeText={setWarmSales} />
                                </View>
                                <View style={styles.halfCol}>
                                    <Text style={styles.label}>Gastos Test (Boleto/Promo ARS)</Text>
                                    <TextInput style={[styles.inputHighlight, { borderColor: '#e74c3c', color: '#e74c3c' }]} keyboardType="numeric" placeholder="2000" placeholderTextColor="#888" value={testCostExtra} onChangeText={setTestCostExtra} />
                                </View>
                            </View>

                            <Text style={styles.label}>Horas Trabajadas (Para Velocidad de Venta)</Text>
                            <TextInput style={styles.input} keyboardType="numeric" placeholder="1.5" placeholderTextColor="#666" value={testingHours} onChangeText={setTestingHours} />

                            <Text style={styles.label}>Objeciones en vivo (separalas con coma)</Text>
                            <TextInput 
                                style={[styles.input, { height: 80 }]} 
                                multiline 
                                placeholder="Me pareció caro, no confío, tengo poco espacio" 
                                placeholderTextColor="#666" 
                                value={streetObjections} 
                                onChangeText={setStreetObjections} 
                            />

                            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: '#9b59b6' }]} onPress={handleSaveStreetTest}>
                                <Text style={[styles.saveBtnText, { color: '#fff' }]}>GUARDAR MEMORIA DE IA</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#333' },
    backBtn: { padding: 5, marginRight: 10 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#fff' },
    
    addMainBtn: { margin: 15 },
    addBtnGradient: { padding: 15, borderRadius: 12, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    addBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 },

    card: { backgroundColor: '#111', borderRadius: 15, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    cardActive: { borderColor: '#d4af3770', shadowColor: '#d4af37', shadowRadius: 10, shadowOpacity: 0.1, elevation: 5 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
    cardSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
    scoreBadge: { backgroundColor: '#d4af3730', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: '#d4af37' },
    scoreText: { color: '#d4af37', fontWeight: '900', fontSize: 14 },

    financialRow: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#1a1a1a', padding: 10, borderRadius: 10, marginTop: 15 },
    finBox: { alignItems: 'center' },
    finLabel: { fontSize: 10, color: '#888' },
    finValue: { fontSize: 14, color: '#fff', fontWeight: 'bold', marginTop: 3 },

    sectionDivider: { color: '#666', fontSize: 12, fontWeight: 'bold', marginTop: 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 },
    
    metricsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
    metricItem: { alignItems: 'center', backgroundColor: '#0a0a0a', padding: 10, borderRadius: 10, width: '30%', borderWidth: 1, borderColor: '#222' },
    metricVal: { fontSize: 20, fontWeight: 'bold', color: '#d4af37' },
    metricLabel: { fontSize: 10, color: '#888' },
    btnTiny: { backgroundColor: '#222', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 5, marginTop: 8 },
    btnTinyText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    intentMatrix: { flexDirection: 'row', gap: 15, backgroundColor: '#1a1010', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#3a1a1a', alignItems: 'center' },
    intentScoreBoard: { alignItems: 'center', justifyContent: 'center', width: 60 },
    intentTotal: { color: '#e74c3c', fontSize: 26, fontWeight: '900', marginTop: 5 },
    intentActions: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    btnIntent1: { backgroundColor: '#333', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    btnIntent2: { backgroundColor: '#f39c1250', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    btnIntent3: { backgroundColor: '#e67e22', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
    btnIntent5: { backgroundColor: '#e74c3c', paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, width: '100%', alignItems: 'center', marginTop: 5 },
    btnIntentText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
    actionBtn: { flex: 1, padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    btnReject: { backgroundColor: '#e74c3c30', borderWidth: 1, borderColor: '#e74c3c' },
    btnAccept: { backgroundColor: '#d4af37' },
    actionBtnText: { fontWeight: 'bold', fontSize: 14, color: '#fff' },

    deleteLinkContainer: { marginTop: 15, alignItems: 'center' },
    deleteLinkText: { color: '#555', fontSize: 12, textDecorationLine: 'underline' },

    emptyText: { color: '#666', textAlign: 'center', marginTop: 40 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalCard: { backgroundColor: '#111', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '90%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 20, color: '#fff', fontWeight: 'bold' },
    label: { color: '#aaa', fontSize: 12, marginBottom: 8, marginTop: 15 },
    input: { backgroundColor: '#222', color: '#fff', padding: 15, borderRadius: 10, fontSize: 16 },
    inputHighlight: { backgroundColor: '#222', color: '#d4af37', padding: 15, borderRadius: 10, fontSize: 18, fontWeight: 'bold', borderWidth: 1, borderColor: '#d4af3750' },
    row: { flexDirection: 'row', gap: 10 },
    halfCol: { flex: 1 },
    btnRow: { flexDirection: 'row', gap: 5 },
    cityBtn: { flex: 1, padding: 12, backgroundColor: '#222', borderRadius: 10, alignItems: 'center' },
    cityActive: { backgroundColor: '#d4af37' },
    cityText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    
    previewBox: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 10, marginTop: 15, borderWidth: 1, borderColor: '#333' },
    previewLabel: { color: '#888', fontSize: 12, marginBottom: 5 },
    previewValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

    saveBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 40 },
    saveBtnText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});
