import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Switch } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * SECCIÓN: IDENTIDAD DEL PRODUCTO
 * Nombre, código, imagen (compacta)
 */
export const IdentitySection = ({ formData, handleChange, image, onPickImage, onScanBarcode, onGenerateBarcodeFromName, onPrintBarcode, onPrintBarcodeGrid }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>IDENTIDAD</Text>

        {/* Imagen compacta - sin redundancia */}
        <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
            <TouchableOpacity style={styles.imagePicker} onPress={onPickImage}>
                {image ? (
                    <Image source={{ uri: image }} style={styles.imagePreview} />
                ) : (
                    <View style={styles.imagePlaceholder}>
                        <MaterialCommunityIcons name="camera-plus" size={32} color="#666" />
                        <Text style={styles.imagePlaceholderText}>IMAGEN</Text>
                    </View>
                )}
            </TouchableOpacity>

            <View style={{ flex: 1, gap: 10 }}>
                <Text style={styles.label}>Nombre del Producto</Text>
                <TextInput
                    style={styles.input}
                    value={formData.name}
                    onChangeText={(text) => handleChange('name', text)}
                    placeholder="Ej. Funda Silicona iPhone 13"
                    placeholderTextColor="#444"
                />
            </View>
        </View>

        <Text style={styles.label}>Código de Barras (Opcional)</Text>
        <View style={{ flexDirection: 'row', gap: 10 }}>
            <TextInput
                style={[styles.input, { flex: 1 }]}
                value={formData.barcode}
                onChangeText={(text) => handleChange('barcode', text)}
                placeholder="Escanea o genera un código"
                placeholderTextColor="#444"
            />
            {onGenerateBarcodeFromName && (
                <TouchableOpacity
                    style={[styles.scanIconBtn, { marginRight: 2 }]}
                    onPress={onGenerateBarcodeFromName}
                >
                    <MaterialCommunityIcons name="auto-fix" size={20} color="#d4af37" />
                </TouchableOpacity>
            )}
            <TouchableOpacity
                style={styles.scanIconBtn}
                onPress={onScanBarcode}
            >
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#d4af37" />
            </TouchableOpacity>
        </View>

        {formData.barcode ? (
            <View style={styles.barcodePreviewContainer}>
                {/^\d{7,8}$/.test(formData.barcode.trim()) ? (
                    <Image 
                        key={formData.barcode.trim()}
                        source={{ uri: `https://bwipjs-api.metafloor.com/?bcid=ean8&text=${encodeURIComponent(formData.barcode.trim())}&scale=2&height=12&includetext=true&textsize=10` }} 
                        style={styles.barcodeImage} 
                        resizeMode="contain" 
                    />
                ) : (
                    <View style={{ height: 40, justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ color: '#e74c3c', fontSize: 11, fontWeight: 'bold' }}>
                            Código EAN-8 requiere 7 u 8 números
                        </Text>
                    </View>
                )}
                {onPrintBarcode && (
                    <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
                        <TouchableOpacity style={[styles.printBarcodeBtn, { paddingHorizontal: 4 }]} onPress={onPrintBarcode}>
                            <MaterialCommunityIcons name="printer" size={14} color="#000" />
                            <Text style={[styles.printBarcodeText, { fontSize: 10 }]} numberOfLines={1}>1x Código</Text>
                        </TouchableOpacity>
                        {onPrintBarcodeGrid && (
                            <TouchableOpacity style={[styles.printBarcodeBtn, { paddingHorizontal: 4, backgroundColor: '#b8860b' }]} onPress={onPrintBarcodeGrid}>
                                <MaterialCommunityIcons name="grid" size={14} color="#000" />
                                <Text style={[styles.printBarcodeText, { fontSize: 10 }]} numberOfLines={1}>4x Códigos</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        ) : null}
    </View>
);

/**
 * SECCIÓN: PRECIO (lo más importante)
 * Costo, Margen, Precios por ciudad + Indicador de rentabilidad
 */
export const PriceSection = ({ productId, formData, handleChange, pendingPurchases, onShowPPPModal, queueItem }) => {
    const costPrice = parseFloat(formData.cost_price) || 0;

    // Calcular margen e indicador por ciudad (INDEPENDIENTES)
    const jujuyPrice = parseFloat(formData.sale_price) || 0;
    const cordobaPrice = parseFloat(formData.sale_price_cordoba) || 0;

    const jujuyProfit = jujuyPrice - costPrice;
    const jujuyPercent = costPrice > 0 ? ((jujuyProfit / costPrice) * 100).toFixed(0) : 0;

    const cordobaProfit = cordobaPrice - costPrice;
    const cordobaPercent = costPrice > 0 ? ((cordobaProfit / costPrice) * 100).toFixed(0) : 0;

    // Calculator States
    const [showCalculator, setShowCalculator] = useState(false);
    const [activeConfigTab, setActiveConfigTab] = useState('labor'); // 'labor' | 'jujuy' | 'cordoba' | 'transport' | 'packaging'
    const [laborType, setLaborType] = useState('convenio');
    const [timeSpentMinutes, setTimeSpentMinutes] = useState('10');
    const [convenioSalary, setConvenioSalary] = useState('900000');
    const [cbtSalary, setCbtSalary] = useState('950000');
    const [desiredSalary, setDesiredSalary] = useState('1200000');
    const [productiveHours, setProductiveHours] = useState('140');
    const [cargasPatronales, setCargasPatronales] = useState(true);
    const [monthlyHours, setMonthlyHours] = useState('160');
    const [customLaborCost, setCustomLaborCost] = useState('0');
    const [suggestedMargin, setSuggestedMargin] = useState('50');
    const [originalCost, setOriginalCost] = useState('0');
    // Servicios por provincia
    const [electricityJujuy, setElectricityJujuy] = useState('5000');
    const [internetJujuy, setInternetJujuy] = useState('3000');
    const [unitsMonthlyJujuy, setUnitsMonthlyJujuy] = useState('50');
    const [electricityCordoba, setElectricityCordoba] = useState('5000');
    const [internetCordoba, setInternetCordoba] = useState('3000');
    const [unitsMonthlyCordoba, setUnitsMonthlyCordoba] = useState('50');
    // Transporte y packaging
    const [transportCordoba, setTransportCordoba] = useState('0');
    const [packagingCost, setPackagingCost] = useState('0');
    const [packagingList, setPackagingList] = useState([]);

    useEffect(() => {
        const loadConfig = async () => {
            try {
                const key = `price_calc_params_${productId || 'new'}`;
                let data = await AsyncStorage.getItem(key);
                if (!data) {
                    data = await AsyncStorage.getItem('global_calc_params');
                }
                if (data) {
                    const config = JSON.parse(data);
                    if (config.laborType) {
                        setLaborType(config.laborType === 'canasta' ? 'valor_hora' : config.laborType);
                    }
                    if (config.timeSpentMinutes) setTimeSpentMinutes(config.timeSpentMinutes);
                    if (config.convenioSalary) setConvenioSalary(config.convenioSalary);
                    if (config.cbtSalary) setCbtSalary(config.cbtSalary);
                    if (config.desiredSalary) setDesiredSalary(config.desiredSalary);
                    if (config.productiveHours) setProductiveHours(config.productiveHours);
                    if (config.cargasPatronales !== undefined) setCargasPatronales(config.cargasPatronales);
                    if (config.monthlyHours) setMonthlyHours(config.monthlyHours);
                    if (config.customLaborCost) setCustomLaborCost(config.customLaborCost);
                    if (config.suggestedMargin) setSuggestedMargin(config.suggestedMargin);
                    if (config.electricityJujuy) setElectricityJujuy(config.electricityJujuy);
                    if (config.internetJujuy) setInternetJujuy(config.internetJujuy);
                    if (config.unitsMonthlyJujuy) setUnitsMonthlyJujuy(config.unitsMonthlyJujuy);
                    if (config.electricityCordoba) setElectricityCordoba(config.electricityCordoba);
                    if (config.internetCordoba) setInternetCordoba(config.internetCordoba);
                    if (config.unitsMonthlyCordoba) setUnitsMonthlyCordoba(config.unitsMonthlyCordoba);
                    if (config.transportCordoba) setTransportCordoba(config.transportCordoba);
                }
                
                // Load or initialize original physical purchase cost
                const savedOriginal = await AsyncStorage.getItem(`original_cost_${productId || 'new'}`);
                if (savedOriginal) {
                    setOriginalCost(savedOriginal);
                } else {
                    setOriginalCost(formData.cost_price || '0');
                }

                // Packaging: always read from global key
                const pkgCost = await AsyncStorage.getItem('packaging_total_cost');
                const pkgList = await AsyncStorage.getItem('packaging_products_list');
                if (pkgCost) setPackagingCost(pkgCost);
                if (pkgList) setPackagingList(JSON.parse(pkgList));
            } catch (e) {
                console.warn('Error loading calculator config:', e);
            }
        };
        loadConfig();
    }, [productId]);

    const saveConfig = async (updatedFields) => {
        try {
            const key = `price_calc_params_${productId || 'new'}`;
            const currentConfig = {
                laborType,
                timeSpentMinutes,
                convenioSalary,
                cbtSalary,
                desiredSalary,
                productiveHours,
                cargasPatronales,
                monthlyHours,
                customLaborCost,
                suggestedMargin,
                electricityJujuy,
                internetJujuy,
                unitsMonthlyJujuy,
                electricityCordoba,
                internetCordoba,
                unitsMonthlyCordoba,
                transportCordoba,
                ...updatedFields
            };
            await AsyncStorage.setItem(key, JSON.stringify(currentConfig));
            await AsyncStorage.setItem('global_calc_params', JSON.stringify(currentConfig));
        } catch (e) {
            console.warn('Error saving calculator config:', e);
        }
    };

    const handleUpdateField = (field, value, setter) => {
        setter(value);
        saveConfig({ [field]: value });
    };

    const handleUpdateOriginalCost = async (val) => {
        const clean = val.replace(/[^0-9.]/g, '');
        setOriginalCost(clean);
        await AsyncStorage.setItem(`original_cost_${productId || 'new'}`, clean);
    };

    const calculateSuggestedPrice = () => {
        // Cost is the physical purchase cost (originalCost)
        const cost = parseFloat(originalCost) || parseFloat(formData.cost_price) || 0;
        const pkg = parseFloat(packagingCost) || 0;

        let labor = 0;
        const hrs = parseFloat(monthlyHours) || 160;
        const mins = parseFloat(timeSpentMinutes) || 0;

        if (laborType === 'convenio') {
            const baseSal = parseFloat(convenioSalary) || 900000;
            const totalSal = cargasPatronales ? baseSal * 1.3 : baseSal;
            const hourlyRate = totalSal / hrs;
            labor = hourlyRate * (mins / 60);
        } else if (laborType === 'canasta') {
            const cbt = parseFloat(cbtSalary) || 950000;
            const hourlyRate = cbt / hrs;
            labor = hourlyRate * (mins / 60);
        } else if (laborType === 'valor_hora') {
            const desired = parseFloat(desiredSalary) || 1200000;
            const prodHrs = parseFloat(productiveHours) || 140;
            const hourlyRate = desired / prodHrs;
            labor = hourlyRate * (mins / 60);
        } else if (laborType === 'fijo') {
            labor = parseFloat(customLaborCost) || 0;
        }

        // Servicios propios por ubicación (Jujuy usa sus servicios, Córdoba los suyos)
        const unitsJ = parseFloat(unitsMonthlyJujuy) || 1;
        const unitsC = parseFloat(unitsMonthlyCordoba) || 1;
        const serviciosJujuy = ((parseFloat(electricityJujuy) || 0) + (parseFloat(internetJujuy) || 0)) / unitsJ;
        const serviciosCordoba = ((parseFloat(electricityCordoba) || 0) + (parseFloat(internetCordoba) || 0)) / unitsC;
        const transport = parseFloat(transportCordoba) || 0;

        const margin = parseFloat(suggestedMargin) || 50;

        // Costo base fijo (igual para ambas ubicaciones)
        const baseFija = cost + labor + pkg;

        // Gastos operativos por ubicación
        const gastosOpJujuy = serviciosJujuy;
        const gastosOpCordoba = serviciosCordoba + transport;

        // Comisión se aplica SOBRE los gastos operativos
        // Dueño cobra 60% sobre sus gastos operativos de Jujuy
        // Socio cobra 40% sobre sus gastos operativos de Córdoba
        const comisionDueno = gastosOpJujuy * 0.60;
        const comisionSocio = gastosOpCordoba * 0.40;

        const subtotalJujuy = baseFija + gastosOpJujuy + comisionDueno;
        const subtotalCordoba = baseFija + gastosOpCordoba + comisionSocio;

        return {
            laborCost: labor,
            serviciosJujuy,
            serviciosCordoba,
            comisionDueno,
            comisionSocio,
            packagingCost: pkg,
            transportCost: transport,
            subtotalJujuy,
            subtotalCordoba,
            suggestedPriceJujuy: Math.round(subtotalJujuy * (1 + margin / 100)),
            suggestedPriceCordoba: Math.round(subtotalCordoba * (1 + margin / 100)),
        };
    };

    const calculated = calculateSuggestedPrice();

    const handleApplyPrice = (target) => {
        if (target === 'jujuy') {
            handleChange('sale_price', calculated.suggestedPriceJujuy.toString());
            handleChange('profit_margin_percent', suggestedMargin);
        } else if (target === 'cordoba') {
            handleChange('sale_price_cordoba', calculated.suggestedPriceCordoba.toString());
        }
    };

    // CBT comparison calculations
    const cbt = parseFloat(cbtSalary) || 950000;
    const hrs = parseFloat(monthlyHours) || 160;
    const mins = parseFloat(timeSpentMinutes) || 0;

    let userMonthlyEquiv = 0;
    let userUnitCost = 0;

    if (laborType === 'valor_hora') {
        const desired = parseFloat(desiredSalary) || 1200000;
        const prodHrs = parseFloat(productiveHours) || 140;
        userMonthlyEquiv = desired;
        userUnitCost = (desired / prodHrs) * (mins / 60);
    } else if (laborType === 'fijo') {
        userUnitCost = parseFloat(customLaborCost) || 0;
        userMonthlyEquiv = mins > 0 ? (userUnitCost / (mins / 60)) * hrs : 0;
    } else if (laborType === 'convenio') {
        const baseSal = parseFloat(convenioSalary) || 900000;
        const totalSal = cargasPatronales ? baseSal * 1.3 : baseSal;
        userMonthlyEquiv = totalSal;
        userUnitCost = (userMonthlyEquiv / hrs) * (mins / 60);
    }

    const cbtUnitCost = (cbt / hrs) * (mins / 60);
    const diffPercent = cbt > 0 ? ((userMonthlyEquiv - cbt) / cbt) * 100 : 0;
    const isAbove = userMonthlyEquiv >= cbt;

    // Función para obtener color de rentabilidad
    const getRentabilidadColor = (percent) => {
        if (percent >= 100) return '#2ecc71'; // ALTA
        if (percent >= 50) return '#f39c12';  // MEDIA
        if (percent > 0) return '#e67e22';    // BAJA
        return '#e74c3c';                      // CRÍTICA
    };

    const getLabel = (percent) => {
        if (percent >= 100) return 'ALTA';
        if (percent >= 50) return 'MEDIA';
        if (percent > 0) return 'BAJA';
        return 'CRÍTICA';
    };

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>PRECIO</Text>

            {/* Costo único */}
            <View style={{ marginBottom: 12 }}>
                <Text style={styles.inputLabel}>Costo</Text>
                <View style={{ position: 'relative' }}>
                    <TextInput
                        style={styles.input}
                        value={formData.cost_price}
                        onChangeText={(text) => handleChange('cost_price', text)}
                        keyboardType="numeric"
                        placeholder="$0"
                        placeholderTextColor="#555"
                    />
                    {pendingPurchases && pendingPurchases.length > 0 && (
                        <TouchableOpacity
                            style={styles.pppBadge}
                            onPress={onShowPPPModal}
                        >
                            <MaterialCommunityIcons name="calculator-variant" size={12} color="#d4af37" />
                            <Text style={styles.pppBadgeText}>PPP ({pendingPurchases.length})</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Precios por ciudad CON márgenes INDEPENDIENTES */}
            <View style={styles.twoColumn}>
                <View style={styles.column}>
                    <Text style={styles.inputLabel}>🟦 Jujuy</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.sale_price}
                        onChangeText={(text) => handleChange('sale_price', text)}
                        keyboardType="numeric"
                        placeholder="$0"
                        placeholderTextColor="#555"
                    />
                    {jujuyPrice > 0 && costPrice > 0 && (
                        <View style={[styles.rentabilityBadgeInline, { backgroundColor: getRentabilidadColor(jujuyPercent) + '20' }]}>
                            <Text style={[styles.rentabilityBadgeTextSmall, { color: getRentabilidadColor(jujuyPercent) }]}>
                                {getLabel(jujuyPercent)}
                            </Text>
                        </View>
                    )}
                </View>
                <View style={styles.column}>
                    <Text style={styles.inputLabel}>🟠 Córdoba</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.sale_price_cordoba}
                        onChangeText={(text) => handleChange('sale_price_cordoba', text)}
                        keyboardType="numeric"
                        placeholder="$0"
                        placeholderTextColor="#555"
                    />
                    {cordobaPrice > 0 && costPrice > 0 && (
                        <View style={[styles.rentabilityBadgeInline, { backgroundColor: getRentabilidadColor(cordobaPercent) + '20' }]}>
                            <Text style={[styles.rentabilityBadgeTextSmall, { color: getRentabilidadColor(cordobaPercent) }]}>
                                {getLabel(cordobaPercent)}
                            </Text>
                        </View>
                    )}
                </View>
            </View>

            {/* SECTOR PRECIO SUGERIDO */}
            <View style={styles.suggestedCard}>
                <View style={styles.suggestedHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="lightbulb-on" size={18} color="#d4af37" />
                        <Text style={styles.suggestedHeaderTitle}>Precio Sugerido</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.suggestedConfigBtn, showCalculator && styles.suggestedConfigBtnActive]}
                        onPress={() => setShowCalculator(!showCalculator)}
                    >
                        <MaterialCommunityIcons name="cog" size={14} color={showCalculator ? '#d4af37' : '#888'} />
                    </TouchableOpacity>
                </View>

                {/* Dual city price display */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                    <View style={{ flex: 1, backgroundColor: '#0a1628', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#1e3a5f' }}>
                        <Text style={{ fontSize: 10, color: '#7fb3d3', fontWeight: '600', marginBottom: 2 }}>🟦 JUJUY</Text>
                        <Text style={{ fontSize: 20, color: '#fff', fontWeight: '800' }}>
                            ${calculated.suggestedPriceJujuy.toLocaleString('es-AR')}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Base: ${calculated.subtotalJujuy.toFixed(0)}</Text>
                    </View>
                    <View style={{ flex: 1, backgroundColor: '#1a0f00', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#5a3010' }}>
                        <Text style={{ fontSize: 10, color: '#e8924f', fontWeight: '600', marginBottom: 2 }}>🟠 CÓRDOBA</Text>
                        <Text style={{ fontSize: 20, color: '#fff', fontWeight: '800' }}>
                            ${calculated.suggestedPriceCordoba.toLocaleString('es-AR')}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#555', marginTop: 2 }}>Base: ${calculated.subtotalCordoba.toFixed(0)}</Text>
                    </View>
                </View>
                <Text style={{ fontSize: 10, color: '#666', textAlign: 'center', marginBottom: 10 }}>
                    Margen: {suggestedMargin}% sobre costo base
                </Text>

                {/* Desglose de costos */}
                <View style={styles.suggestedBreakdown}>
                    {/* Base fija (igual para ambos) */}
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Costo Producto:</Text>
                        <Text style={styles.breakdownValue}>${(parseFloat(originalCost) || costPrice || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={styles.breakdownLabel}>Mano de Obra:</Text>
                        <Text style={styles.breakdownValue}>${calculated.laborCost.toFixed(2)}</Text>
                    </View>
                    {calculated.packagingCost > 0 && (
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#2ecc71' }]}>📦 Packaging:</Text>
                            <Text style={[styles.breakdownValue, { color: '#2ecc71' }]}>${calculated.packagingCost.toFixed(2)}</Text>
                        </View>
                    )}

                    {/* Gastos operativos y comisión JUJUY */}
                    <View style={[styles.breakdownRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: '#1e3a5f22', paddingTop: 6 }]}>
                        <Text style={[styles.breakdownLabel, { color: '#7fb3d3' }]}>🟦 Servicios Jujuy:</Text>
                        <Text style={[styles.breakdownValue, { color: '#7fb3d3' }]}>${calculated.serviciosJujuy.toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#7fb3d3', fontStyle: 'italic' }]}>   ↳ Tu comisión (60%):</Text>
                        <Text style={[styles.breakdownValue, { color: '#7fb3d3' }]}>${calculated.comisionDueno.toFixed(2)}</Text>
                    </View>

                    {/* Gastos operativos y comisión CÓRDOBA */}
                    <View style={[styles.breakdownRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: '#5a301022', paddingTop: 6 }]}>
                        <Text style={[styles.breakdownLabel, { color: '#e8924f' }]}>🟠 Servicios Córdoba:</Text>
                        <Text style={[styles.breakdownValue, { color: '#e8924f' }]}>${calculated.serviciosCordoba.toFixed(2)}</Text>
                    </View>
                    {calculated.transportCost > 0 && (
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#e8924f' }]}>🚚 Transporte CBA:</Text>
                            <Text style={[styles.breakdownValue, { color: '#e8924f' }]}>${calculated.transportCost.toFixed(2)}</Text>
                        </View>
                    )}
                    <View style={styles.breakdownRow}>
                        <Text style={[styles.breakdownLabel, { color: '#e8924f', fontStyle: 'italic' }]}>   ↳ Comisión socio (40%):</Text>
                        <Text style={[styles.breakdownValue, { color: '#e8924f' }]}>${calculated.comisionSocio.toFixed(2)}</Text>
                    </View>
                </View>

                {/* Acciones */}
                <View style={styles.suggestedActions}>
                    <TouchableOpacity style={[styles.suggestedBtn, styles.suggestedBtnPrimary]} onPress={() => handleApplyPrice('jujuy')}>
                        <Text style={styles.suggestedBtnPrimaryText}>Aplicar Jujuy</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.suggestedBtn, styles.suggestedBtnSecondary]} onPress={() => handleApplyPrice('cordoba')}>
                        <Text style={styles.suggestedBtnSecondaryText}>Aplicar Córdoba</Text>
                    </TouchableOpacity>
                </View>

                {/* Panel de Configuración Colapsable */}
                {showCalculator && (
                    <View style={styles.configPanel}>
                        {/* CBT Compare Panel */}
                        <View style={[styles.cbtComparePanel, { borderColor: isAbove ? '#2ecc7133' : '#e74c3c33', backgroundColor: isAbove ? '#2ecc7108' : '#e74c3c08' }]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <MaterialCommunityIcons name="shield-check" size={16} color={isAbove ? '#2ecc71' : '#e74c3c'} />
                                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>CONTROL DE CANASTA BÁSICA</Text>
                                </View>
                                <View style={[styles.cbtBadge, { backgroundColor: isAbove ? '#2ecc7120' : '#e74c3c20' }]}>
                                    <Text style={{ fontSize: 9, color: isAbove ? '#2ecc71' : '#e74c3c', fontWeight: '900' }}>
                                        {isAbove ? 'CUBIERTO' : 'ALERTA'}
                                    </Text>
                                </View>
                            </View>

                            <Text style={{ fontSize: 11, color: '#ccc', lineHeight: 16 }}>
                                Tu mano de obra equivale a un sueldo de <Text style={{ color: '#fff', fontWeight: 'bold' }}>${Math.round(userMonthlyEquiv).toLocaleString('es-AR')}/mes</Text>.
                                {isAbove ? ' Está ' : ' Está '}
                                <Text style={{ color: isAbove ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                                    {diffPercent >= 0 ? `+${diffPercent.toFixed(0)}%` : `${diffPercent.toFixed(0)}%`}
                                </Text> {isAbove ? 'por encima' : 'por debajo'} del piso de Canasta Básica (${cbt.toLocaleString('es-AR')}).
                            </Text>

                            {laborType === 'fijo' && (
                                <Text style={{ fontSize: 9, color: '#777', marginTop: 4, fontStyle: 'italic' }}>
                                    * Prorrateado: tu tarifa de ${userUnitCost.toFixed(0)}/unidad vs Canasta Básica unitaria de ${cbtUnitCost.toFixed(0)} por los {mins} min de preparación.
                                </Text>
                            )}
                        </View>

                        <Text style={styles.configTitle}>Ajustes del Calculador</Text>

                        {/* Tab selector */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                            {[
                                { key: 'labor', label: '⚙️ M. de Obra' },
                                { key: 'jujuy', label: '🟦 Jujuy' },
                                { key: 'cordoba', label: '🟠 Córdoba' },
                                { key: 'transport', label: '🚚 Transporte' },
                                { key: 'packaging', label: '📦 Packaging' },
                            ].map(tab => (
                                <TouchableOpacity
                                    key={tab.key}
                                    onPress={() => setActiveConfigTab(activeConfigTab === tab.key ? null : tab.key)}
                                    style={{
                                        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
                                        backgroundColor: activeConfigTab === tab.key ? '#d4af37' : '#1e1e1e',
                                        borderWidth: 1, borderColor: activeConfigTab === tab.key ? '#d4af37' : '#333'
                                    }}
                                >
                                    <Text style={{ fontSize: 11, color: activeConfigTab === tab.key ? '#000' : '#888', fontWeight: '600' }}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* ⚙️ MANO DE OBRA */}
                        {activeConfigTab === 'labor' && (
                            <View style={{ gap: 10 }}>
                                <View style={[styles.configFieldRow, { backgroundColor: '#111', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#333', marginBottom: 4 }]}>
                                    <Text style={[styles.configLabel, { color: '#fff', fontWeight: 'bold' }]}>💰 Costo de Compra (Físico):</Text>
                                    <TextInput style={[styles.configInput, { borderColor: '#d4af3733' }]} value={originalCost} onChangeText={handleUpdateOriginalCost} keyboardType="numeric" />
                                </View>

                                <Text style={styles.configLabel}>Base de Mano de Obra:</Text>
                                <View style={[styles.selectorRow, { flexWrap: 'wrap' }]}>
                                    {[['convenio', 'Convenio'], ['valor_hora', 'Valor Hora'], ['fijo', 'Costo Fijo']].map(([key, label]) => (
                                        <TouchableOpacity key={key}
                                            style={[styles.selectorBtn, { minWidth: '30%' }, laborType === key && styles.selectorBtnActive]}
                                            onPress={() => handleUpdateField('laborType', key, setLaborType)}>
                                            <Text style={[styles.selectorBtnText, laborType === key && styles.selectorBtnTextActive]}>{label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                {laborType === 'convenio' && (<>
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>Sueldo Comercio ($/mes):</Text>
                                        <TextInput style={styles.configInput} value={convenioSalary} onChangeText={(val) => handleUpdateField('convenioSalary', val, setConvenioSalary)} keyboardType="numeric" />
                                    </View>
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>¿Cargas Patronales (+30%)?</Text>
                                        <Switch value={cargasPatronales} onValueChange={(val) => handleUpdateField('cargasPatronales', val, setCargasPatronales)} trackColor={{ false: '#333', true: '#d4af37' }} thumbColor={cargasPatronales ? '#fff' : '#666'} />
                                    </View>
                                </>)}
                                {laborType === 'valor_hora' && (<>
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>Ingreso Deseado ($/mes):</Text>
                                        <TextInput style={styles.configInput} value={desiredSalary} onChangeText={(val) => handleUpdateField('desiredSalary', val, setDesiredSalary)} keyboardType="numeric" />
                                    </View>
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>Horas Productivas/mes:</Text>
                                        <TextInput style={styles.configInput} value={productiveHours} onChangeText={(val) => handleUpdateField('productiveHours', val, setProductiveHours)} keyboardType="numeric" />
                                    </View>
                                </>)}
                                {laborType === 'fijo' && (
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>Mano de Obra ($/unidad):</Text>
                                        <TextInput style={styles.configInput} value={customLaborCost} onChangeText={(val) => handleUpdateField('customLaborCost', val, setCustomLaborCost)} keyboardType="numeric" />
                                    </View>
                                )}
                                {laborType !== 'fijo' && (<>
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>Tiempo dedicado (min/unidad):</Text>
                                        <TextInput style={styles.configInput} value={timeSpentMinutes} onChangeText={(val) => handleUpdateField('timeSpentMinutes', val, setTimeSpentMinutes)} keyboardType="numeric" />
                                    </View>
                                    <View style={styles.configFieldRow}>
                                        <Text style={styles.configLabel}>Horas laborales/mes:</Text>
                                        <TextInput style={styles.configInput} value={monthlyHours} onChangeText={(val) => handleUpdateField('monthlyHours', val, setMonthlyHours)} keyboardType="numeric" />
                                    </View>
                                </>)}
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>Margen de Ganancia (%):</Text>
                                    <TextInput style={styles.configInput} value={suggestedMargin} onChangeText={(val) => handleUpdateField('suggestedMargin', val, setSuggestedMargin)} keyboardType="numeric" />
                                </View>

                                {/* Campo fijo destacado para configurar Canasta Básica de Referencia */}
                                <View style={[styles.configFieldRow, { borderTopWidth: 1, borderTopColor: '#222', paddingTop: 10, marginTop: 4 }]}>
                                    <Text style={[styles.configLabel, { color: '#d4af37' }]}>🧺 Canasta Básica Ref. ($/mes):</Text>
                                    <TextInput style={[styles.configInput, { borderColor: '#d4af3733' }]} value={cbtSalary} onChangeText={(val) => handleUpdateField('cbtSalary', val, setCbtSalary)} keyboardType="numeric" />
                                </View>
                            </View>
                        )}

                        {/* 🟦 SERVICIOS JUJUY */}
                        {activeConfigTab === 'jujuy' && (
                            <View style={{ gap: 10 }}>
                                <Text style={{ fontSize: 11, color: '#7fb3d3', marginBottom: 4 }}>
                                    Los gastos se prorratean dividiendo por las unidades estimadas/mes.
                                </Text>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>💡 Electricidad Jujuy ($/mes):</Text>
                                    <TextInput style={styles.configInput} value={electricityJujuy} onChangeText={(val) => handleUpdateField('electricityJujuy', val, setElectricityJujuy)} keyboardType="numeric" />
                                </View>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>🌐 Internet Jujuy ($/mes):</Text>
                                    <TextInput style={styles.configInput} value={internetJujuy} onChangeText={(val) => handleUpdateField('internetJujuy', val, setInternetJujuy)} keyboardType="numeric" />
                                </View>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>📦 Unidades vendidas/mes (est.):</Text>
                                    <TextInput style={styles.configInput} value={unitsMonthlyJujuy} onChangeText={(val) => handleUpdateField('unitsMonthlyJujuy', val, setUnitsMonthlyJujuy)} keyboardType="numeric" />
                                </View>
                                <View style={{ backgroundColor: '#0a1628', borderRadius: 8, padding: 8 }}>
                                    <Text style={{ fontSize: 12, color: '#7fb3d3' }}>
                                        Servicios/unidad: ${(((parseFloat(electricityJujuy) || 0) + (parseFloat(internetJujuy) || 0)) / (parseFloat(unitsMonthlyJujuy) || 1)).toFixed(2)}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* 🟠 SERVICIOS CÓRDOBA */}
                        {activeConfigTab === 'cordoba' && (
                            <View style={{ gap: 10 }}>
                                <Text style={{ fontSize: 11, color: '#e8924f', marginBottom: 4 }}>
                                    Los gastos se prorratean dividiendo por las unidades estimadas/mes.
                                </Text>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>💡 Electricidad Córdoba ($/mes):</Text>
                                    <TextInput style={styles.configInput} value={electricityCordoba} onChangeText={(val) => handleUpdateField('electricityCordoba', val, setElectricityCordoba)} keyboardType="numeric" />
                                </View>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>🌐 Internet Córdoba ($/mes):</Text>
                                    <TextInput style={styles.configInput} value={internetCordoba} onChangeText={(val) => handleUpdateField('internetCordoba', val, setInternetCordoba)} keyboardType="numeric" />
                                </View>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>📦 Unidades vendidas/mes (est.):</Text>
                                    <TextInput style={styles.configInput} value={unitsMonthlyCordoba} onChangeText={(val) => handleUpdateField('unitsMonthlyCordoba', val, setUnitsMonthlyCordoba)} keyboardType="numeric" />
                                </View>
                                <View style={{ backgroundColor: '#1a0f00', borderRadius: 8, padding: 8 }}>
                                    <Text style={{ fontSize: 12, color: '#e8924f' }}>
                                        Servicios/unidad: ${(((parseFloat(electricityCordoba) || 0) + (parseFloat(internetCordoba) || 0)) / (parseFloat(unitsMonthlyCordoba) || 1)).toFixed(2)}
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* 🚚 TRANSPORTE A CÓRDOBA */}
                        {activeConfigTab === 'transport' && (
                            <View style={{ gap: 10 }}>
                                <Text style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                                    Este costo se suma solo al precio de Córdoba.
                                </Text>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>🚚 Costo de Envío ($/unidad):</Text>
                                    <TextInput style={styles.configInput} value={transportCordoba} onChangeText={(val) => handleUpdateField('transportCordoba', val, setTransportCordoba)} keyboardType="numeric" />
                                </View>
                                <View style={{ backgroundColor: '#1a0f00', borderRadius: 8, padding: 8 }}>
                                    <Text style={{ fontSize: 12, color: '#e8924f' }}>
                                        Con transporte, Córdoba tiene ${(parseFloat(transportCordoba) || 0).toFixed(2)} adicionales por unidad.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* 📦 PACKAGING */}
                        {activeConfigTab === 'packaging' && (
                            <View style={{ gap: 10 }}>
                                <Text style={{ fontSize: 11, color: '#999' }}>
                                    El packaging se calcula automáticamente desde los productos marcados como "Insumo de Packaging".
                                </Text>
                                <View style={{ backgroundColor: '#0f2010', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#2ecc71' }}>
                                    <Text style={{ fontSize: 13, color: '#2ecc71', fontWeight: '700', marginBottom: 6 }}>
                                        📦 Total packaging: ${(parseFloat(packagingCost) || 0).toFixed(2)} / unidad
                                    </Text>
                                    {packagingList.length > 0 ? (
                                        packagingList.map((name, i) => (
                                            <Text key={i} style={{ fontSize: 11, color: '#7bc99a', marginTop: 2 }}>• {name}</Text>
                                        ))
                                    ) : (
                                        <Text style={{ fontSize: 11, color: '#555', fontStyle: 'italic' }}>
                                            Ningún producto marcado como packaging aún.{'\n'}
                                            Andá a un producto de stickers/bolsas y activá el toggle en la sección Operativo.
                                        </Text>
                                    )}
                                </View>
                            </View>
                        )}

                        <Text style={styles.configHelper}>
                            * Los cambios se guardan automáticamente.
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
};



/**
 * SECCIÓN: STOCK (claro y compacto)
 */
export const StockSection = ({ formData, handleChange }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>INVENTARIO</Text>

        <View style={styles.twoColumn}>
            <View style={styles.column}>
                <Text style={styles.inputLabel}>Jujuy</Text>
                <TextInput
                    style={styles.input}
                    value={formData.stock_local}
                    onChangeText={(text) => handleChange('stock_local', text)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#555"
                />
            </View>
            <View style={styles.column}>
                <Text style={styles.inputLabel}>Córdoba</Text>
                <TextInput
                    style={styles.input}
                    value={formData.stock_cordoba}
                    onChangeText={(text) => handleChange('stock_cordoba', text)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor="#555"
                />
            </View>
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.inputLabel}>¿Registrar Gasto automático?</Text>
                <Text style={{ fontSize: 10, color: '#666', marginTop: -2 }}>
                    Crea un Gasto y Pedido de compra. Desactivar si ya cargaste esta compra en el panel de Compras.
                </Text>
            </View>
            <TouchableOpacity 
                style={[styles.toggleSwitch, formData.register_expense && styles.toggleSwitchActive]} 
                onPress={() => handleChange('register_expense', !formData.register_expense)}
            >
                <View style={[styles.toggleCircle, formData.register_expense && styles.toggleCircleActive]} />
            </TouchableOpacity>
        </View>

        <Text style={styles.smallNote}><Text>💡 </Text><Text>El stock por variante se suma automáticamente a estos totales.</Text></Text>
    </View>
);

/**
 * SECCIÓN: OPERATIVO (Proveedor + Kit/Combo)
 * Gestiona relaciones de negocio y composición del producto
 */
export const OperativeSection = ({
    formData,
    handleChange,
    suppliersList,
    isBundle,
    onToggleBundle,
    isIndividual,
    onToggleIndividual,
    isPackaging,
    onTogglePackaging,
    bundleItems,
    onShowBundlePicker,
    onShowSupplierModal
}) => {
    const currentSupplier = suppliersList?.find(s => s.name === formData.provider);
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>OPERATIVO</Text>
            <Text style={styles.inputLabel}>Proveedor</Text>
            <TouchableOpacity style={styles.supplierButton} onPress={onShowSupplierModal}>
                <MaterialCommunityIcons name="store" size={16} color="#d4af37" style={{ marginLeft: 12 }} />
                <Text style={styles.supplierButtonText}>{currentSupplier?.name || 'Seleccionar proveedor...'}</Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#d4af37" style={{ marginRight: 12 }} />
            </TouchableOpacity>
            <View style={{ marginTop: 14, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <MaterialCommunityIcons name="account-details-outline" size={18} color="#d4af37" style={{ marginRight: 8 }} />
                    <View>
                        <Text style={styles.inputLabel}>¿Uso Individual?</Text>
                        <Text style={{ fontSize: 9, color: '#666', marginTop: -4 }}>Sugerir división si hay 2+</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.toggleSwitch, isIndividual && styles.toggleSwitchActive]} onPress={onToggleIndividual}>
                    <View style={[styles.toggleCircle, isIndividual && styles.toggleCircleActive]} />
                </TouchableOpacity>
            </View>
            <View style={{ marginTop: 10, marginBottom: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <MaterialCommunityIcons name="package-variant-closed" size={18} color="#d4af37" style={{ marginRight: 8 }} />
                    <Text style={styles.inputLabel}>¿Es un Kit/Combo?</Text>
                </View>
                <TouchableOpacity style={[styles.toggleSwitch, isBundle && styles.toggleSwitchActive]} onPress={onToggleBundle}>
                    <View style={[styles.toggleCircle, isBundle && styles.toggleCircleActive]} />
                </TouchableOpacity>
            </View>
            {/* NUEVO: Toggle Packaging */}
            <View style={{ marginTop: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isPackaging ? '#1a2f1a' : 'transparent', borderRadius: 10, padding: isPackaging ? 10 : 0, borderWidth: isPackaging ? 1 : 0, borderColor: '#2ecc71' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <MaterialCommunityIcons name="sticker-outline" size={18} color={isPackaging ? '#2ecc71' : '#d4af37'} style={{ marginRight: 8 }} />
                    <View>
                        <Text style={[styles.inputLabel, isPackaging && { color: '#2ecc71' }]}>¿Es Insumo de Packaging?</Text>
                        <Text style={{ fontSize: 9, color: '#666', marginTop: -4 }}>Stickers, bolsas, cajas, etc.</Text>
                    </View>
                </View>
                <TouchableOpacity style={[styles.toggleSwitch, isPackaging && { backgroundColor: '#2ecc71' }]} onPress={onTogglePackaging}>
                    <View style={[styles.toggleCircle, isPackaging && styles.toggleCircleActive]} />
                </TouchableOpacity>
            </View>
            {isPackaging && (
                <View style={{ backgroundColor: '#0f2010', borderRadius: 8, padding: 10, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: '#2ecc71' }}>
                    <Text style={{ fontSize: 11, color: '#2ecc71', lineHeight: 16 }}>
                        📦 Al guardar, el costo de este producto se sumará automáticamente al calculador de precio de todos los demás productos.
                    </Text>
                </View>
            )}
            {isBundle && (
                <View style={styles.bundleBox}>
                    <Text style={[styles.inputLabel, { marginBottom: 10 }]}>Productos incluidos</Text>
                    {bundleItems.length === 0 ? (
                        <Text style={{ fontSize: 12, color: '#666', fontStyle: 'italic', textAlign: 'center', paddingVertical: 12 }}>Toca el botón + para agregar</Text>
                    ) : (
                        <View>
                            {bundleItems.map((item, idx) => (
                                <View key={idx} style={[styles.bundleItem, { marginBottom: 8 }]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={{ fontSize: 13, color: '#fff', fontWeight: '600' }}>{item.name}</Text>
                                        <Text style={{ fontSize: 11, color: '#999', marginTop: 2 }}>Cantidad: {item.qty}</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                    <TouchableOpacity style={styles.bundleAddBtn} onPress={onShowBundlePicker}>
                        <MaterialCommunityIcons name="plus" size={16} color="#fff" />
                        <Text style={{ fontSize: 12, color: '#fff', fontWeight: '600', marginLeft: 6 }}>Agregar producto</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};



/**
 * SECCIÓN: VARIANTES (tabla limpia, con preparación para priceOverride futuro)
 */
export const VariantsSection = ({ variants, addVariant, removeVariant, updateVariant }) => (
    <View style={styles.section}>
        <View style={styles.variantsHeader}>
            <Text style={styles.sectionTitle}>VARIANTES (Colores)</Text>
            <TouchableOpacity onPress={addVariant} style={styles.addBtnVariants}>
                <MaterialCommunityIcons name="plus" size={20} color="#fff" />
            </TouchableOpacity>
        </View>

        {variants.length === 0 ? (
            <Text style={styles.emptyMessage}>Sin variantes (producto único)</Text>
        ) : (
            <View style={styles.variantsTable}>
                {/* Encabezado */}
                <View style={styles.variantRow}>
                    <Text style={[styles.variantCell, { flex: 2, color: '#999' }]}>Color</Text>
                    <Text style={[styles.variantCell, { flex: 1, color: '#999' }]}>Stock</Text>
                    <Text style={[styles.variantCell, { flex: 0.5, color: '#999' }]}></Text>
                </View>

                {/* Items */}
                {variants.map((v, idx) => (
                    <View key={idx} style={styles.variantRow}>
                        <TextInput
                            style={[styles.variantCell, { flex: 2 }]}
                            placeholder="Color"
                            placeholderTextColor="#555"
                            value={v.color}
                            onChangeText={(val) => updateVariant(idx, 'color', val)}
                        />
                        <TextInput
                            style={[styles.variantCell, { flex: 1 }]}
                            placeholder="Stock"
                            placeholderTextColor="#555"
                            keyboardType="numeric"
                            value={v.stock !== undefined ? v.stock.toString() : ''}
                            onChangeText={(val) => updateVariant(idx, 'stock', val)}
                        />
                        {/* priceOverride: preparado para futuro - no renderizar aún */}
                        {/* <TextInput placeholder="Precio alt" value={v.priceOverride || ''} onChangeText={(val) => updateVariant(idx, 'priceOverride', val)} /> */}
                        <TouchableOpacity
                            style={styles.variantDelete}
                            onPress={() => removeVariant(idx)}
                        >
                            <MaterialCommunityIcons name="close" size={18} color="#e74c3c" />
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        )}
    </View>
);

/**
 * SECCIÓN: COSTOS FIJOS (opcional, compacta)
 */
export const OverheadSection = ({ value, onChangeText, label, icon }) => (
    <View style={styles.minimalSection}>
        <View style={styles.overheadRow}>
            <MaterialCommunityIcons name={icon} size={18} color="#d4af37" />
            <Text style={styles.overheadLabel}>{label}</Text>
            <TextInput
                style={styles.overheadInput}
                value={value}
                onChangeText={onChangeText}
                keyboardType="numeric"
                placeholder="$0"
                placeholderTextColor="#555"
            />
        </View>
    </View>
);

const styles = StyleSheet.create({
    // === SECCIONES ===
    section: {
        marginBottom: 18,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
    },
    minimalSection: {
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#d4af37',
        letterSpacing: 2,
        marginBottom: 14,
        textTransform: 'uppercase',
    },

    // === INPUTS ===
    inputLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#aaa',
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#0a0a0a',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        fontSize: 15,
        color: '#fff',
        fontWeight: '600',
    },

    // === LAYOUT ===
    twoColumn: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    column: {
        flex: 1,
        marginRight: 10,
    },

    // === IMAGEN ===
    compactImagePicker: {
        width: 80,
        height: 80,
        backgroundColor: '#0a0a0a',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#1a1a1a',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        overflow: 'hidden',
    },
    compactImageLoaded: {
        borderColor: '#2ecc71',
        borderWidth: 2,
    },
    imageLoadedOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
        opacity: 0.9,
    },

    // === BARCODE ===
    barcodeInputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        paddingRight: 4,
    },
    barcodeInput: {
        flex: 1,
        padding: 12,
        fontSize: 15,
        color: '#fff',
        fontWeight: '600',
    },
    scanIconBtn: {
        padding: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // === RENTABILIDAD ===
    rentabilityBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 4,
        marginTop: 10,
    },
    rentabilityContent: {
        flex: 1,
    },
    rentabilityLabel: {
        fontSize: 10,
        color: '#888',
        fontWeight: '600',
    },
    rentabilityValue: {
        fontSize: 18,
        fontWeight: '900',
        color: '#fff',
        marginTop: 2,
    },
    rentabilityBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        alignItems: 'center',
    },
    rentabilityBadgeText: {
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1,
    },
    rentabilityPercent: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
    rentabilityBadgeInline: {
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignItems: 'center',
    },
    rentabilityBadgeTextSmall: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },

    // === VARIANTES ===
    variantsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    addBtn: {
        backgroundColor: '#3498db',
        padding: 8,
        borderRadius: 6,
    },
    addBtnVariants: {
        backgroundColor: '#3498db',
        padding: 10,
        borderRadius: 6,
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#5dade2',
    },
    variantsTable: {
        backgroundColor: '#0a0a0a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        overflow: 'hidden',
    },
    variantRow: {
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#1a1a1a',
        paddingHorizontal: 10,
        paddingVertical: 8,
    },
    variantCell: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '600',
    },
    variantDelete: {
        padding: 6,
    },
    emptyMessage: {
        color: '#666',
        fontSize: 12,
        fontStyle: 'italic',
        padding: 12,
    },

    // === OVERHEAD ===
    overheadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        padding: 10,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    overheadLabel: {
        flex: 1,
        fontSize: 12,
        color: '#aaa',
        fontWeight: '600',
    },
    overheadInput: {
        width: 70,
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#1a1a1a',
        borderRadius: 4,
        padding: 6,
        fontSize: 12,
        color: '#fff',
        fontWeight: '600',
    },

    // === PPP BADGE ===
    pppBadge: {
        marginTop: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: '#d4af3715',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#d4af37',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    pppBadgeText: {
        fontSize: 10,
        color: '#d4af37',
        fontWeight: '700',
        marginLeft: 4
    },

    // === OPERATIVE ===
    supplierButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        paddingHorizontal: 0,
        paddingVertical: 0,
        marginBottom: 12,
    },
    supplierButtonText: {
        flex: 1,
        fontSize: 15,
        color: '#fff',
        fontWeight: '600',
        marginLeft: 8,
        paddingVertical: 12,
    },
    toggleSwitch: {
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingHorizontal: 2,
    },
    toggleSwitchActive: {
        backgroundColor: '#2ecc7133',
        borderColor: '#2ecc71',
    },
    toggleCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#666',
    },
    toggleCircleActive: {
        backgroundColor: '#2ecc71',
        alignSelf: 'flex-end',
    },
    bundleBox: {
        marginTop: 12,
        padding: 12,
        backgroundColor: '#0a0a0a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    bundleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        backgroundColor: '#1a1a1a',
        borderRadius: 6,
        borderLeftWidth: 3,
        borderLeftColor: '#3498db',
    },
    bundleAddBtn: {
        marginTop: 10,
        paddingVertical: 10,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#3498db',
        borderRadius: 6,
    },

    // === MISC ===
    smallNote: {
        fontSize: 11,
        color: '#666',
        fontStyle: 'italic',
        marginTop: 8,
    },
    // === PRECIO SUGERIDO ===
    suggestedCard: {
        backgroundColor: '#0a0a0a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d4af3733',
        padding: 14,
        marginTop: 15,
        borderLeftWidth: 4,
        borderLeftColor: '#d4af37',
    },
    suggestedHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    suggestedHeaderTitle: {
        color: '#d4af37',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    suggestedValueRow: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 8,
        marginBottom: 12,
    },
    suggestedValue: {
        color: '#fff',
        fontSize: 24,
        fontWeight: '900',
    },
    suggestedMarginText: {
        color: '#2ecc71',
        fontSize: 12,
        fontWeight: '700',
    },
    suggestedBreakdown: {
        backgroundColor: '#000',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        marginBottom: 12,
        gap: 6,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    breakdownLabel: {
        color: '#888',
        fontSize: 11,
    },
    breakdownValue: {
        color: '#bbb',
        fontSize: 11,
        fontWeight: '600',
    },
    breakdownDivider: {
        height: 1,
        backgroundColor: '#1a1a1a',
        marginVertical: 4,
    },
    breakdownTotalLabel: {
        color: '#aaa',
        fontSize: 12,
        fontWeight: '800',
    },
    breakdownTotalValue: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '800',
    },
    suggestedActions: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
    },
    suggestedBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestedBtnPrimary: {
        backgroundColor: '#d4af3715',
        borderWidth: 1,
        borderColor: '#d4af37',
    },
    suggestedBtnPrimaryText: {
        color: '#d4af37',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    suggestedBtnSecondary: {
        backgroundColor: '#d4af3733',
        borderWidth: 1,
        borderColor: '#d4af37',
    },
    suggestedBtnSecondaryText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    suggestedConfigBtn: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#2a2a2a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    suggestedConfigBtnActive: {
        borderColor: '#d4af37',
        backgroundColor: '#d4af3715',
    },
    configPanel: {
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#1a1a1a',
        gap: 12,
    },
    configTitle: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 2,
    },
    selectorRow: {
        flexDirection: 'row',
        backgroundColor: '#000',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        padding: 2,
    },
    selectorBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectorBtnActive: {
        backgroundColor: '#d4af3715',
        borderWidth: 1,
        borderColor: '#d4af3733',
    },
    selectorBtnText: {
        color: '#666',
        fontSize: 10,
        fontWeight: '700',
    },
    selectorBtnTextActive: {
        color: '#d4af37',
    },
    configFieldRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    configLabel: {
        color: '#aaa',
        fontSize: 11,
        fontWeight: '600',
        flex: 1,
        marginRight: 10,
    },
    configInput: {
        backgroundColor: '#000',
        borderWidth: 1,
        borderColor: '#1a1a1a',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        width: 100,
        textAlign: 'right',
    },
    configHelper: {
        color: '#666',
        fontSize: 9,
        fontStyle: 'italic',
        marginTop: -6,
        paddingLeft: 2,
    },
    barcodePreviewContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0c0c0c',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#222',
        padding: 10,
        marginTop: 12,
        gap: 12,
    },
    barcodeImage: {
        width: 140,
        height: 55,
        backgroundColor: '#fff',
        borderRadius: 4,
        padding: 4,
    },
    printBarcodeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#d4af37',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        height: 55,
    },
    printBarcodeText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    cbtComparePanel: {
        borderRadius: 10,
        borderWidth: 1,
        padding: 12,
        marginBottom: 12,
    },
    cbtBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
});
