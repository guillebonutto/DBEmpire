import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image, Switch } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/useAuthStore';

/**
 * SECCIÓN: IDENTIDAD DEL PRODUCTO
 * Nombre, código, imagen con previsualización nítida
 */
export const IdentitySection = ({
    formData,
    handleChange,
    image,
    onPickImage,
    onRemoveImage,
    onScanBarcode,
    onGenerateBarcodeFromName,
    onPrintBarcode,
    onPrintBarcode2x,
    onPrintBarcodeGrid
}) => {
    const imageSource = typeof image === 'number'
        ? image
        : (typeof image === 'string' && image.trim().length > 0
            ? { uri: image.trim() }
            : (image?.uri ? image : null));

    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>IDENTIDAD</Text>

            {/* Imagen compacta con previsualización */}
            <View style={{ flexDirection: 'row', gap: 15, alignItems: 'center' }}>
                <View style={styles.imagePickerWrapper}>
                    <TouchableOpacity
                        style={[styles.imagePicker, imageSource && styles.imagePickerWithImage]}
                        onPress={onPickImage}
                        activeOpacity={0.8}
                    >
                        {imageSource ? (
                            <>
                                <ExpoImage
                                    source={imageSource}
                                    style={styles.imagePreview}
                                    contentFit="cover"
                                    transition={200}
                                    cachePolicy="disk"
                                />
                                <View style={styles.editImageBadge}>
                                    <MaterialCommunityIcons name="pencil" size={10} color="#000" />
                                </View>
                            </>
                        ) : (
                            <View style={styles.imagePlaceholder}>
                                <MaterialCommunityIcons name="camera-plus" size={28} color="#d4af37" />
                                <Text style={styles.imagePlaceholderText}>FOTO</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                    {imageSource && onRemoveImage && (
                        <TouchableOpacity
                            style={styles.removeImageBadge}
                            onPress={onRemoveImage}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <MaterialCommunityIcons name="close" size={12} color="#fff" />
                        </TouchableOpacity>
                    )}
                </View>

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
                        {onPrintBarcode2x && (
                            <TouchableOpacity style={[styles.printBarcodeBtn, { paddingHorizontal: 4, backgroundColor: '#a67c00' }]} onPress={onPrintBarcode2x}>
                                <MaterialCommunityIcons name="grid-large" size={14} color="#000" />
                                <Text style={[styles.printBarcodeText, { fontSize: 10 }]} numberOfLines={1}>2x Códigos</Text>
                            </TouchableOpacity>
                        )}
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
};

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

    // Auth & Role View (Admin vs Socio)
    const { userRole } = useAuthStore();
    const isCurrentAdmin = userRole === 'admin' || userRole === 'leader';
    const isCurrentSocio = userRole === 'seller' || userRole === 'socio';

    const [selectedRoleView, setSelectedRoleView] = useState(isCurrentSocio ? 'socio' : 'admin');
    const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);

    useEffect(() => {
        if (isCurrentSocio) {
            setSelectedRoleView('socio');
        } else {
            setSelectedRoleView('admin');
        }
    }, [userRole]);

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
    const [adminCommissionPercent, setAdminCommissionPercent] = useState('60');
    const [partnerCommissionPercent, setPartnerCommissionPercent] = useState('40');
    // Servicios por provincia
    const [electricityJujuy, setElectricityJujuy] = useState('5000');
    const [internetJujuy, setInternetJujuy] = useState('3000');
    const [unitsMonthlyJujuy, setUnitsMonthlyJujuy] = useState('50');
    const [electricityCordoba, setElectricityCordoba] = useState('5000');
    const [internetCordoba, setInternetCordoba] = useState('3000');
    const [unitsMonthlyCordoba, setUnitsMonthlyCordoba] = useState('50');
    // Transporte y packaging
    const [transportCordoba, setTransportCordoba] = useState('0');
    const [packagingCostGeneral, setPackagingCostGeneral] = useState('65');
    const [packagingCostRfid, setPackagingCostRfid] = useState('60');

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
                    if (config.adminCommissionPercent !== undefined) setAdminCommissionPercent(String(config.adminCommissionPercent));
                    if (config.partnerCommissionPercent !== undefined) setPartnerCommissionPercent(String(config.partnerCommissionPercent));
                    if (config.electricityJujuy) setElectricityJujuy(config.electricityJujuy);
                    if (config.internetJujuy) setInternetJujuy(config.internetJujuy);
                    if (config.unitsMonthlyJujuy) setUnitsMonthlyJujuy(config.unitsMonthlyJujuy);
                    if (config.electricityCordoba) setElectricityCordoba(config.electricityCordoba);
                    if (config.internetCordoba) setInternetCordoba(config.internetCordoba);
                    if (config.unitsMonthlyCordoba) setUnitsMonthlyCordoba(config.unitsMonthlyCordoba);
                    if (config.transportCordoba) setTransportCordoba(config.transportCordoba);
                }

                // Packaging unit costs: general vs rfid
                const pkgGeneral = await AsyncStorage.getItem('packaging_cost_general');
                const pkgRfid = await AsyncStorage.getItem('packaging_cost_rfid');
                if (pkgGeneral) setPackagingCostGeneral(pkgGeneral);
                if (pkgRfid) setPackagingCostRfid(pkgRfid);
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
                adminCommissionPercent,
                partnerCommissionPercent,
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

    const calculateSuggestedPrice = () => {
        const cost = parseFloat(formData.cost_price) || 0;

        // Determine packaging cost: direct input from user takes precedence, otherwise preset
        const packagingType = formData.packaging_type || ((formData.name && /rfid|nfc|tarjeta/i.test(formData.name)) ? 'rfid' : 'general');
        let bagCost = 0;
        if (formData.packaging_cost !== undefined && formData.packaging_cost !== '') {
            bagCost = parseFloat(formData.packaging_cost) || 0;
        } else if (packagingType === 'rfid') {
            bagCost = parseFloat(packagingCostRfid) || 60;
        } else if (packagingType === 'general') {
            bagCost = parseFloat(packagingCostGeneral) || 65;
        }
        const stickerCost = packagingType === 'none' ? 0 : (parseFloat(formData.packaging_sticker_cost) || 0);
        const pkg = bagCost + stickerCost;

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
        // Costo base fijo (igual para ambas ubicaciones)
        const baseFija = cost + labor + pkg;

        // Gastos operativos necesarios por ubicación
        const gastosOpJujuy = serviciosJujuy;
        const gastosOpCordoba = serviciosCordoba + transport;

        const costoTodoNecesarioJujuy = baseFija + gastosOpJujuy;
        const costoTodoNecesarioCordoba = baseFija + gastosOpCordoba;

        // 1. Precio con todo sumado (con margen de ganancia incluido):
        const precioTodoSumadoJujuy = Math.round(costoTodoNecesarioJujuy * (1 + margin / 100));
        const precioTodoSumadoCordoba = Math.round(costoTodoNecesarioCordoba * (1 + margin / 100));

        const gananciaJujuy = Math.max(0, precioTodoSumadoJujuy - costoTodoNecesarioJujuy);
        const gananciaCordoba = Math.max(0, precioTodoSumadoCordoba - costoTodoNecesarioCordoba);
        const comisionDueno = Math.round(gananciaJujuy * ((parseFloat(adminCommissionPercent) || 0) / 100));
        const comisionSocio = Math.round(gananciaCordoba * ((parseFloat(partnerCommissionPercent) || 0) / 100));

        return {
            laborCost: labor,
            serviciosJujuy,
            serviciosCordoba,
            comisionDueno,
            comisionSocio,
            packagingCost: pkg,
            packagingBagCost: bagCost,
            packagingStickerCost: stickerCost,
            packagingType,
            transportCost: transport,
            costoTodoNecesarioJujuy,
            costoTodoNecesarioCordoba,
            precioTodoSumadoJujuy,
            precioTodoSumadoCordoba,
            suggestedPriceJujuy: precioTodoSumadoJujuy + comisionDueno,
            suggestedPriceCordoba: precioTodoSumadoCordoba + comisionSocio,
        };
    };

    const calculated = calculateSuggestedPrice();

    // Margen de ganancia escrito por el usuario para el producto (formData.profit_margin_percent)
    const currentMarginPercent = formData.profit_margin_percent !== undefined && formData.profit_margin_percent !== ''
        ? formData.profit_margin_percent
        : suggestedMargin;
    const marginNum = parseFloat(currentMarginPercent) || 0;

    const handleMarginChange = (val) => {
        const clean = val.replace(/[^0-9.]/g, '');
        handleChange('profit_margin_percent', clean);
        setSuggestedMargin(clean);
        saveConfig({ suggestedMargin: clean });
    };

    // === CÁLCULOS DEL PRODUCTO (COSTOS -> MARGEN -> PORCENTAJE DE CADA PERSONA) ===
    // 1. PRECIO BASE (costo físico de adquisición/compra)
    const precioBase = costPrice;
    const baseFija = precioBase + calculated.laborCost + calculated.packagingCost;

    // 2. GASTOS NECESARIOS (Luz, Internet, Transporte, Mano de Obra, Packaging)
    const gastosOpJujuy = calculated.serviciosJujuy;
    const gastosOpCordoba = calculated.serviciosCordoba + calculated.transportCost;

    const costoNecesarioJujuy = baseFija + gastosOpJujuy;
    const costoNecesarioCordoba = baseFija + gastosOpCordoba;

    const costoNecesarioActivo = selectedRoleView === 'admin' ? costoNecesarioJujuy : costoNecesarioCordoba;
    const gastosOpActivo = selectedRoleView === 'admin' ? gastosOpJujuy : gastosOpCordoba;

    // 3. PRECIO C/ TODO SUMADO (con margen de ganancia incluido):
    // "el precio de todo sumado es con margen de ganancia incluido"
    const precioTodoSumadoJujuy = Math.round(costoNecesarioJujuy * (1 + marginNum / 100));
    const precioTodoSumadoCordoba = Math.round(costoNecesarioCordoba * (1 + marginNum / 100));
    const precioTodoSumadoActivo = selectedRoleView === 'admin' ? precioTodoSumadoJujuy : precioTodoSumadoCordoba;

    // Each person's commission is calculated from the margin amount and added after it.
    const pctAdmin = parseFloat(adminCommissionPercent) || 0;
    const pctSocio = parseFloat(partnerCommissionPercent) || 0;
    const pctActivo = selectedRoleView === 'admin' ? pctAdmin : pctSocio;

    const gananciaJujuy = Math.max(0, precioTodoSumadoJujuy - costoNecesarioJujuy);
    const gananciaCordoba = Math.max(0, precioTodoSumadoCordoba - costoNecesarioCordoba);
    const comisionMontoJujuy = Math.round(gananciaJujuy * (pctAdmin / 100));
    const comisionMontoCordoba = Math.round(gananciaCordoba * (pctSocio / 100));
    const comisionMontoActiva = selectedRoleView === 'admin' ? comisionMontoJujuy : comisionMontoCordoba;

    const precioFinalJujuy = precioTodoSumadoJujuy + comisionMontoJujuy;
    const precioFinalCordoba = precioTodoSumadoCordoba + comisionMontoCordoba;
    const precioFinalActivo = selectedRoleView === 'admin' ? precioFinalJujuy : precioFinalCordoba;

    // 5. MARGEN BRUTO:
    // If a city has a manually entered sale price, use it for the gross-profit display.
    const activeCustomSalePrice = selectedRoleView === 'admin' ? jujuyPrice : cordobaPrice;
    const hasActiveSalePrice = activeCustomSalePrice > 0;
    const effectiveSalePrice = hasActiveSalePrice ? activeCustomSalePrice : precioFinalActivo;

    // Margen Bruto: Precio de Venta Efectivo - Costo Necesario de Producción/Adquisición
    const margenBrutoPesos = effectiveSalePrice - costoNecesarioActivo;
    const margenPorcentaje = effectiveSalePrice > 0 ? ((margenBrutoPesos / effectiveSalePrice) * 100).toFixed(1) : '0';

    const handleApplyPrice = (target) => {
        if (target === 'jujuy') {
            handleChange('sale_price', precioFinalJujuy.toString());
            handleChange('profit_margin_percent', marginNum.toString());
        } else if (target === 'cordoba') {
            handleChange('sale_price_cordoba', precioFinalCordoba.toString());
            handleChange('profit_margin_percent', marginNum.toString());
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
        if (percent >= 50) return '#2ecc71'; // ALTA
        if (percent >= 33.3) return '#f39c12'; // MEDIA
        if (percent > 0) return '#e67e22';    // BAJA
        return '#e74c3c';                      // CRÍTICA
    };

    const getLabel = (percent) => {
        if (percent >= 50) return 'ALTA';
        if (percent >= 33.3) return 'MEDIA';
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

            {/* CÁLCULOS DEL PRODUCTO (UNIFICADO) */}
            <View style={styles.calcHeroCard}>
                {/* Encabezado con selector de perspectiva y botón de configuración */}
                <View style={styles.calcRoleHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="calculator-variant" size={16} color="#d4af37" />
                        <Text style={styles.calcRoleTitle}>CÁLCULOS DEL PRODUCTO</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={styles.roleToggleGroup}>
                            <TouchableOpacity
                                style={[styles.rolePill, selectedRoleView === 'admin' && styles.rolePillActiveAdmin]}
                                onPress={() => setSelectedRoleView('admin')}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="crown" size={12} color={selectedRoleView === 'admin' ? '#7fb3d3' : '#666'} />
                                <Text style={[styles.rolePillText, selectedRoleView === 'admin' && styles.rolePillTextActiveAdmin]}>
                                    Admin (Jujuy)
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.rolePill, selectedRoleView === 'socio' && styles.rolePillActiveSocio]}
                                onPress={() => setSelectedRoleView('socio')}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="handshake" size={12} color={selectedRoleView === 'socio' ? '#e8924f' : '#666'} />
                                <Text style={[styles.rolePillText, selectedRoleView === 'socio' && styles.rolePillTextActiveSocio]}>
                                    Socio (Córdoba)
                                </Text>
                            </TouchableOpacity>
                        </View>
                        <TouchableOpacity
                            style={[styles.suggestedConfigBtn, showCalculator && styles.suggestedConfigBtnActive]}
                            onPress={() => setShowCalculator(!showCalculator)}
                            accessibilityLabel="Configurar cálculos del producto"
                        >
                            <MaterialCommunityIcons name="cog" size={14} color={showCalculator ? '#d4af37' : '#888'} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Fila con Columna izquierda de cálculos y Columna derecha Margen Bruto */}
                <View style={styles.calcColumnsRow}>
                    {/* COLUMNA IZQUIERDA: Cálculos acomodados en columna */}
                    <View style={styles.calcLeftCol}>
                        {/* 1. Precio Base */}
                        <View style={styles.calcColItem}>
                            <Text style={styles.calcColItemLabel}>PRECIO BASE</Text>
                            <Text style={styles.calcColItemValue}>
                                ${precioBase.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.calcColItemSub}>Costo físico de adquisición</Text>
                        </View>

                        {/* 2. Gastos Necesarios (Luz, Transporte, etc.) */}
                        <View style={styles.calcColItem}>
                            <Text style={styles.calcColItemLabel}>MANO DE OBRA</Text>
                            <Text style={[styles.calcColItemValue, { color: '#e8924f' }]}>
                                ${calculated.laborCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.calcColItemSub}>
                                {laborType === 'fijo' ? 'Costo fijo por unidad' : `${timeSpentMinutes || 0} min por unidad`}
                            </Text>
                        </View>

                        <View style={styles.calcColItem}>
                            <Text style={styles.calcColItemLabel}>GASTOS NECESARIOS</Text>
                            <Text style={[styles.calcColItemValue, { color: selectedRoleView === 'admin' ? '#7fb3d3' : '#e8924f' }]}>
                                ${(calculated.laborCost + calculated.packagingCost + gastosOpActivo).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                            <Text style={styles.calcColItemSub} numberOfLines={1}>
                                {selectedRoleView === 'admin'
                                    ? 'Luz, Net, M.O., Bolsita+Stickers'
                                    : 'Luz, Net, Transp., M.O., Bolsita+Stk'}
                            </Text>
                            <Text style={[styles.calcColItemSub, { marginTop: 4 }]} numberOfLines={2}>
                                Bolsita ${calculated.packagingBagCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {' + Stickers $'}{calculated.packagingStickerCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                {' + Servicios $'}{gastosOpActivo.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Text>
                        </View>

                        {/* 3. Margen de Ganancia (%) que escribe el usuario */}
                        <View style={styles.calcColItem}>
                            <Text style={styles.calcColItemLabel}>MARGEN DE GANANCIA (%)</Text>
                            <View style={styles.marginInputRow}>
                                <TextInput
                                    style={styles.marginInput}
                                    value={currentMarginPercent?.toString() || ''}
                                    onChangeText={handleMarginChange}
                                    keyboardType="numeric"
                                    placeholder="50"
                                    placeholderTextColor="#666"
                                />
                                <Text style={styles.marginInputUnit}>%</Text>
                            </View>
                            <Text style={styles.calcColItemSub}>% de ganancia para este producto</Text>
                        </View>

                        {/* 4. Precio c/ todo sumado (con margen de ganancia incluido) */}
                        <View style={[styles.calcColItem, { borderLeftColor: '#f39c12' }]}>
                            <Text style={styles.calcColItemLabel}>PRECIO C/ TODO SUMADO</Text>
                            <Text style={[styles.calcColItemValue, { color: '#f39c12', fontSize: 15 }]}>
                                ${precioTodoSumadoActivo.toLocaleString('es-AR')}
                            </Text>
                            <Text style={styles.calcColItemSub} numberOfLines={1}>
                                Base + Gastos + Margen ({marginNum}%)
                            </Text>
                        </View>

                        {/* 5. Precio con comisión, added after costs and product margin */}
                        <View style={[styles.calcColItem, { borderLeftColor: '#d4af37', backgroundColor: '#18150a' }]}>
                            <Text style={[styles.calcColItemLabel, { color: '#d4af37' }]}>
                                PRECIO CON COMISIÓN
                            </Text>
                            <Text style={[styles.calcColItemValue, { color: '#d4af37', fontSize: 16 }]}>
                                ${precioFinalActivo.toLocaleString('es-AR')}
                            </Text>
                            <Text style={styles.calcColItemSub} numberOfLines={2}>
                                {selectedRoleView === 'admin' ? 'Jujuy' : 'Córdoba'}: Precio c/Todo Sumado + comisión {selectedRoleView === 'admin' ? `Admin ${pctAdmin}%` : `Socio ${pctSocio}%`} sobre el margen (+${comisionMontoActiva.toLocaleString('es-AR')})
                            </Text>
                            <TouchableOpacity
                                style={styles.applyInlineBtn}
                                onPress={() => handleApplyPrice(selectedRoleView === 'admin' ? 'jujuy' : 'cordoba')}
                                activeOpacity={0.7}
                            >
                                <MaterialCommunityIcons name="lightning-bolt" size={12} color="#000" />
                                <Text style={styles.applyInlineBtnText}>
                                    Aplicar a {selectedRoleView === 'admin' ? 'Jujuy' : 'Córdoba'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Divisor vertical */}
                    <View style={styles.calcVerticalDivider} />

                    {/* COLUMNA DERECHA: Más en grande y más en el medio el cálculo de margen bruto */}
                    <View style={styles.calcRightCol}>
                        <View style={styles.margenHeaderRow}>
                            <MaterialCommunityIcons name="chart-line-variant" size={14} color="#2ecc71" />
                            <Text style={styles.margenTitle}>MARGEN BRUTO</Text>
                        </View>

                        {/* Monto destacado en grande y centrado */}
                        <Text style={[styles.margenAmountBig, { color: margenBrutoPesos >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                            {margenBrutoPesos >= 0 ? `+$${Math.round(margenBrutoPesos).toLocaleString('es-AR')}` : `-$${Math.round(Math.abs(margenBrutoPesos)).toLocaleString('es-AR')}`}
                        </Text>

                        {/* Porcentaje de margen */}
                        <View style={[styles.margenPercentBadge, { backgroundColor: margenBrutoPesos >= 0 ? '#2ecc7120' : '#e74c3c20' }]}>
                            <MaterialCommunityIcons
                                name={margenBrutoPesos >= 0 ? "trending-up" : "trending-down"}
                                size={14}
                                color={margenBrutoPesos >= 0 ? '#2ecc71' : '#e74c3c'}
                            />
                            <Text style={[styles.margenPercentText, { color: margenBrutoPesos >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                                {margenPorcentaje >= 0 ? `+${margenPorcentaje}%` : `${margenPorcentaje}%`}
                            </Text>
                        </View>

                        {/* Fórmula clara del cálculo del Margen Bruto */}
                        <Text style={styles.margenFormulaText} numberOfLines={1}>
                            ${Math.round(effectiveSalePrice).toLocaleString('es-AR')} - ${Math.round(costoNecesarioActivo).toLocaleString('es-AR')}
                        </Text>
                        <Text style={styles.margenFormulaSub}>
                            (Precio Venta - Costos Necesarios)
                        </Text>
                        <Text style={[styles.margenFormulaSub, { marginTop: 2 }]}>
                            Porcentaje calculado sobre el precio de venta
                        </Text>

                        {/* Referencia de precio de venta */}
                        <Text style={styles.margenRefText} numberOfLines={1}>
                            {hasActiveSalePrice
                                ? `s/ Venta actual ($${Math.round(activeCustomSalePrice).toLocaleString('es-AR')})`
                                : `s/ Precio c/ comisión ($${Math.round(precioFinalActivo).toLocaleString('es-AR')})`}
                        </Text>

                        {/* Badge de rentabilidad */}
                        <View style={[styles.rentabilidadPill, {
                            backgroundColor: getRentabilidadColor(margenPorcentaje) + '22',
                            borderColor: getRentabilidadColor(margenPorcentaje) + '77'
                        }]}>
                            <Text style={[styles.rentabilidadPillText, { color: getRentabilidadColor(margenPorcentaje) }]}>
                                RENTABILIDAD {getLabel(margenPorcentaje)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Acciones para aplicar a precios por ciudad */}
                <View style={[styles.suggestedActions, { marginTop: 12 }]}>
                    <TouchableOpacity style={[styles.suggestedBtn, styles.suggestedBtnPrimary]} onPress={() => handleApplyPrice('jujuy')}>
                        <Text style={styles.suggestedBtnPrimaryText}>Aplicar Jujuy (${precioFinalJujuy.toLocaleString('es-AR')})</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.suggestedBtn, styles.suggestedBtnSecondary]} onPress={() => handleApplyPrice('cordoba')}>
                        <Text style={styles.suggestedBtnSecondaryText}>Aplicar Córdoba (${precioFinalCordoba.toLocaleString('es-AR')})</Text>
                    </TouchableOpacity>
                </View>

                {/* Botón para ver/ocultar desglose detallado */}
                <TouchableOpacity
                    style={styles.toggleBreakdownBtn}
                    onPress={() => setShowDetailedBreakdown(!showDetailedBreakdown)}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons
                        name={showDetailedBreakdown ? "chevron-up" : "chevron-down"}
                        size={14}
                        color="#888"
                    />
                    <Text style={styles.toggleBreakdownText}>
                        {showDetailedBreakdown ? 'Ocultar desglose detallado de gastos' : 'Ver desglose detallado de gastos'}
                    </Text>
                </TouchableOpacity>

                {/* Desglose detallado expandible */}
                {showDetailedBreakdown && (
                    <View style={[styles.suggestedBreakdown, { marginTop: 8 }]}>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Costo Producto:</Text>
                            <Text style={styles.breakdownValue}>${costPrice.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={styles.breakdownLabel}>Mano de Obra:</Text>
                            <Text style={styles.breakdownValue}>${calculated.laborCost.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#2ecc71' }]}>
                                📦 Bolsita ({calculated.packagingType === 'rfid' ? 'Tarjetas RFID/NFC' : 'General'}):
                            </Text>
                            <Text style={[styles.breakdownValue, { color: '#2ecc71' }]}>${calculated.packagingBagCost.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#2ecc71' }]}>🏷️ Stickers:</Text>
                            <Text style={[styles.breakdownValue, { color: '#2ecc71' }]}>${calculated.packagingStickerCost.toFixed(2)}</Text>
                        </View>

                        <View style={[styles.breakdownRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: '#1e3a5f22', paddingTop: 6 }]}>
                            <Text style={[styles.breakdownLabel, { color: '#7fb3d3' }]}>🟦 Servicios Jujuy (Luz + Net):</Text>
                            <Text style={[styles.breakdownValue, { color: '#7fb3d3' }]}>${calculated.serviciosJujuy.toFixed(2)}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#f39c12' }]}>   ↳ Precio c/ Todo Sumado Jujuy:</Text>
                            <Text style={[styles.breakdownValue, { color: '#f39c12' }]}>${precioTodoSumadoJujuy.toLocaleString('es-AR')}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#7fb3d3' }]}>   ↳ Comisión Admin (60% del margen):</Text>
                            <Text style={[styles.breakdownValue, { color: '#7fb3d3' }]}>+${comisionMontoJujuy.toLocaleString('es-AR')}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#d4af37', fontWeight: '800' }]}>   ⭐ Precio Final Jujuy:</Text>
                            <Text style={[styles.breakdownValue, { color: '#d4af37', fontWeight: '800' }]}>${precioFinalJujuy.toLocaleString('es-AR')}</Text>
                        </View>

                        <View style={[styles.breakdownRow, { marginTop: 6, borderTopWidth: 1, borderTopColor: '#5a301022', paddingTop: 6 }]}>
                            <Text style={[styles.breakdownLabel, { color: '#e8924f' }]}>🟠 Servicios Córdoba (Luz + Net):</Text>
                            <Text style={[styles.breakdownValue, { color: '#e8924f' }]}>${calculated.serviciosCordoba.toFixed(2)}</Text>
                        </View>
                        {calculated.transportCost > 0 && (
                            <View style={styles.breakdownRow}>
                                <Text style={[styles.breakdownLabel, { color: '#e8924f' }]}>🚚 Transporte CBA:</Text>
                                <Text style={[styles.breakdownValue, { color: '#e8924f' }]}>${calculated.transportCost.toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#f39c12' }]}>   ↳ Precio c/ Todo Sumado Córdoba:</Text>
                            <Text style={[styles.breakdownValue, { color: '#f39c12' }]}>${precioTodoSumadoCordoba.toLocaleString('es-AR')}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#e8924f' }]}>   ↳ Comisión Socio (40% del margen):</Text>
                            <Text style={[styles.breakdownValue, { color: '#e8924f' }]}>+${comisionMontoCordoba.toLocaleString('es-AR')}</Text>
                        </View>
                        <View style={styles.breakdownRow}>
                            <Text style={[styles.breakdownLabel, { color: '#d4af37', fontWeight: '800' }]}>   ⭐ Precio Final Córdoba:</Text>
                            <Text style={[styles.breakdownValue, { color: '#d4af37', fontWeight: '800' }]}>${precioFinalCordoba.toLocaleString('es-AR')}</Text>
                        </View>
                    </View>
                )}

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
                                { key: 'commission', label: '💸 Comisiones' },
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
                                    <TextInput
                                        style={[styles.configInput, { borderColor: '#d4af3733' }]}
                                        value={formData.cost_price?.toString() || ''}
                                        onChangeText={(value) => handleChange('cost_price', value.replace(/[^0-9.]/g, ''))}
                                        keyboardType="numeric"
                                    />
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
                                <Text style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                                    Configurá el costo unitario de cada tipo de bolsita (packaging):
                                </Text>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>🛍️ Bolsita General ($/unidad):</Text>
                                    <TextInput
                                        style={styles.configInput}
                                        value={packagingCostGeneral}
                                        onChangeText={(val) => {
                                            const clean = val.replace(/[^0-9.]/g, '');
                                            setPackagingCostGeneral(clean);
                                            AsyncStorage.setItem('packaging_cost_general', clean).catch(e => console.warn(e));
                                        }}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>💳 Bolsita Tarjetas RFID/NFC ($/unidad):</Text>
                                    <TextInput
                                        style={styles.configInput}
                                        value={packagingCostRfid}
                                        onChangeText={(val) => {
                                            const clean = val.replace(/[^0-9.]/g, '');
                                            setPackagingCostRfid(clean);
                                            AsyncStorage.setItem('packaging_cost_rfid', clean).catch(e => console.warn(e));
                                        }}
                                        keyboardType="numeric"
                                    />
                                </View>
                                <View style={{ backgroundColor: '#0f2010', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: '#2ecc7133' }}>
                                    <Text style={{ fontSize: 11, color: '#2ecc71', lineHeight: 16 }}>
                                        💡 Los costos por producto de bolsita y sticker se cargan en la sección Packaging.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* 💸 COMISIONES */}
                        {activeConfigTab === 'commission' && (
                            <View style={{ gap: 10 }}>
                                <Text style={{ fontSize: 11, color: '#999', marginBottom: 4 }}>
                                    Se calculan por separado sobre el importe del margen de ganancia del producto.
                                </Text>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>👑 Comisión Admin / Jujuy (% del margen):</Text>
                                    <TextInput
                                        style={styles.configInput}
                                        value={adminCommissionPercent}
                                        onChangeText={(val) => handleUpdateField('adminCommissionPercent', val.replace(/[^0-9.]/g, ''), setAdminCommissionPercent)}
                                        keyboardType="numeric"
                                        accessibilityLabel="Comisión Admin sobre margen (%)"
                                    />
                                </View>
                                <View style={styles.configFieldRow}>
                                    <Text style={styles.configLabel}>🤝 Comisión Socio / Córdoba (% del margen):</Text>
                                    <TextInput
                                        style={styles.configInput}
                                        value={partnerCommissionPercent}
                                        onChangeText={(val) => handleUpdateField('partnerCommissionPercent', val.replace(/[^0-9.]/g, ''), setPartnerCommissionPercent)}
                                        keyboardType="numeric"
                                        accessibilityLabel="Comisión Socio sobre margen (%)"
                                    />
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
    bundleItems,
    onShowBundlePicker,
    onShowSupplierModal
}) => {
    const currentSupplier = suppliersList?.find(s => s.name === formData.provider);
    const activePackaging = formData.packaging_type || ((formData.name && /rfid|nfc|tarjeta/i.test(formData.name)) ? 'rfid' : 'general');
    const defaultCost = activePackaging === 'rfid'
        ? '60'
        : activePackaging === 'none'
            ? '0'
            : '65';
    const currentPackagingCost = formData.packaging_cost !== undefined && formData.packaging_cost !== ''
        ? formData.packaging_cost.toString()
        : defaultCost;

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

            {/* SELECCIÓN DE PACKAGING (BOLSITA + STICKERS) */}
            <View style={styles.packagingCard}>
                <View style={styles.packagingHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="package-variant" size={18} color="#d4af37" />
                        <Text style={styles.packagingTitle}>PACKAGING (BOLSITA + STICKERS)</Text>
                    </View>
                    <View style={styles.packagingBadgeActive}>
                        <Text style={styles.packagingBadgeActiveText}>
                            {activePackaging === 'rfid'
                                ? '💳 Tarjetas RFID/NFC'
                                : activePackaging === 'none'
                                    ? '🚫 Sin bolsita'
                                    : '🛍️ General'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.packagingSubtitle}>
                    Elegí el tipo de bolsita y cargá por separado el costo de la bolsita y los stickers:
                </Text>

                <View style={styles.packagingPillsRow}>
                    <TouchableOpacity
                        style={[
                            styles.packagingPill,
                            activePackaging === 'general' && styles.packagingPillActiveGeneral
                        ]}
                        onPress={() => {
                            handleChange('packaging_type', 'general');
                            handleChange('packaging_cost', '65');
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="shopping"
                            size={16}
                            color={activePackaging === 'general' ? '#2ecc71' : '#777'}
                        />
                        <Text
                            style={[
                                styles.packagingPillText,
                                activePackaging === 'general' && styles.packagingPillTextActiveGeneral
                            ]}
                        >
                            General (Todos)
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.packagingPill,
                            activePackaging === 'rfid' && styles.packagingPillActiveRfid
                        ]}
                        onPress={() => {
                            handleChange('packaging_type', 'rfid');
                            handleChange('packaging_cost', '60');
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="credit-card-chip-outline"
                            size={16}
                            color={activePackaging === 'rfid' ? '#7fb3d3' : '#777'}
                        />
                        <Text
                            style={[
                                styles.packagingPillText,
                                activePackaging === 'rfid' && styles.packagingPillTextActiveRfid
                            ]}
                        >
                            Tarjetas RFID/NFC
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.packagingPill,
                            activePackaging === 'none' && styles.packagingPillActiveNone
                        ]}
                        onPress={() => {
                            handleChange('packaging_type', 'none');
                            handleChange('packaging_cost', '0');
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons
                            name="close-circle-outline"
                            size={16}
                            color={activePackaging === 'none' ? '#e74c3c' : '#777'}
                        />
                        <Text
                            style={[
                                styles.packagingPillText,
                                activePackaging === 'none' && styles.packagingPillTextActiveNone
                            ]}
                        >
                            Sin Bolsita
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* INPUT DIRECTO PARA EL PRECIO DEL PACKAGING */}
                <View style={styles.packagingPriceRow}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.packagingPriceLabel}>PRECIO / COSTO DE BOLSITA ($)</Text>
                        <Text style={styles.packagingPriceHelper}>
                            {activePackaging === 'rfid'
                                ? 'Bolsita para tarjetas RFID/NFC'
                                : activePackaging === 'none'
                                    ? 'Sin costo de empaque'
                                    : 'Bolsita general para este producto'}
                        </Text>
                    </View>
                    <View style={styles.packagingInputContainer}>
                        <Text style={styles.packagingInputPrefix}>$</Text>
                        <TextInput
                            style={styles.packagingPriceInput}
                            value={currentPackagingCost}
                            onChangeText={(val) => {
                                const clean = val.replace(/[^0-9.]/g, '');
                                handleChange('packaging_cost', clean);
                            }}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#666"
                        />
                    </View>
                </View>

                <View style={[styles.packagingPriceRow, { marginTop: 10 }]}>
                    <View style={{ flex: 1, marginRight: 10 }}>
                        <Text style={styles.packagingPriceLabel}>PRECIO / COSTO DE STICKERS ($)</Text>
                        <Text style={styles.packagingPriceHelper}>
                            {activePackaging === 'none' ? 'No se suma si elegís Sin Bolsita' : 'Costo total de stickers por unidad'}
                        </Text>
                    </View>
                    <View style={styles.packagingInputContainer}>
                        <Text style={styles.packagingInputPrefix}>$</Text>
                        <TextInput
                            style={styles.packagingPriceInput}
                            value={formData.packaging_sticker_cost?.toString() || '0'}
                            onChangeText={(val) => handleChange('packaging_sticker_cost', val.replace(/[^0-9.]/g, ''))}
                            keyboardType="numeric"
                            placeholder="0"
                            placeholderTextColor="#666"
                        />
                    </View>
                </View>

                <View style={styles.packagingInfoBox}>
                    <MaterialCommunityIcons name="information-outline" size={13} color="#888" />
                    <Text style={styles.packagingInfoText}>
                        {activePackaging === 'rfid'
                            ? 'El costo de la bolsita y el de los stickers se suman por separado.'
                            : activePackaging === 'none'
                                ? 'Sin costo de empaque para este producto ($0).'
                                : 'El costo de los stickers se suma al de la bolsita.'}
                    </Text>
                </View>
            </View>
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
    imagePickerWrapper: {
        position: 'relative',
        width: 82,
        height: 82,
    },
    imagePicker: {
        width: 82,
        height: 82,
        backgroundColor: '#0c0c0c',
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#262626',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    imagePickerWithImage: {
        borderStyle: 'solid',
        borderColor: '#d4af37',
        backgroundColor: '#000',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    imagePlaceholderText: {
        color: '#888',
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 4,
        letterSpacing: 0.5,
    },
    editImageBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: '#d4af37',
        width: 20,
        height: 20,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.6,
        shadowRadius: 2,
        elevation: 3,
    },
    removeImageBadge: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: '#e74c3c',
        width: 22,
        height: 22,
        borderRadius: 11,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#000',
        elevation: 4,
        zIndex: 10,
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        color: '#aaa',
        marginBottom: 6,
    },
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
    // === CÁLCULOS ADICIONALES (COLUMNA + MARGEN BRUTO) ===
    calcHeroCard: {
        backgroundColor: '#0c0c0c',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#d4af3733',
        padding: 12,
        marginTop: 12,
        marginBottom: 12,
    },
    calcRoleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1e1e1e',
    },
    calcRoleTitle: {
        color: '#d4af37',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    roleToggleGroup: {
        flexDirection: 'row',
        gap: 6,
    },
    rolePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 14,
        backgroundColor: '#181818',
        borderWidth: 1,
        borderColor: '#2e2e2e',
    },
    rolePillActiveAdmin: {
        backgroundColor: '#7fb3d325',
        borderColor: '#7fb3d3',
    },
    rolePillActiveSocio: {
        backgroundColor: '#e8924f25',
        borderColor: '#e8924f',
    },
    rolePillText: {
        fontSize: 10,
        color: '#888',
        fontWeight: '600',
    },
    rolePillTextActiveAdmin: {
        color: '#7fb3d3',
        fontWeight: '800',
    },
    rolePillTextActiveSocio: {
        color: '#e8924f',
        fontWeight: '800',
    },
    calcColumnsRow: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'stretch',
    },
    calcLeftCol: {
        flex: 1.15,
        justifyContent: 'space-between',
        gap: 8,
    },
    calcColItem: {
        backgroundColor: '#141414',
        borderRadius: 8,
        padding: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#d4af37',
    },
    calcColItemLabel: {
        color: '#888',
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.5,
        marginBottom: 2,
    },
    calcColItemValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
    },
    calcColItemSub: {
        color: '#666',
        fontSize: 9,
        marginTop: 2,
    },
    marginInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0a0a0a',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#333',
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginTop: 2,
        marginBottom: 2,
    },
    marginInput: {
        color: '#d4af37',
        fontSize: 14,
        fontWeight: '900',
        padding: 0,
        minWidth: 40,
        flex: 1,
    },
    marginInputUnit: {
        color: '#d4af37',
        fontSize: 12,
        fontWeight: '800',
        marginLeft: 2,
    },
    applyInlineBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f39c12',
        paddingVertical: 3,
        paddingHorizontal: 6,
        borderRadius: 4,
        gap: 3,
        marginTop: 4,
    },
    applyInlineBtnText: {
        color: '#000',
        fontSize: 9,
        fontWeight: '800',
    },
    calcVerticalDivider: {
        width: 1,
        backgroundColor: '#1e1e1e',
        marginVertical: 2,
    },
    calcRightCol: {
        flex: 1,
        backgroundColor: '#121212',
        borderRadius: 10,
        padding: 10,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#222',
    },
    margenHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 6,
    },
    margenTitle: {
        color: '#aaa',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    margenAmountBig: {
        fontSize: 22,
        fontWeight: '900',
        textAlign: 'center',
    },
    margenPercentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 12,
        marginTop: 6,
        marginBottom: 6,
    },
    margenPercentText: {
        fontSize: 12,
        fontWeight: '800',
    },
    margenFormulaText: {
        color: '#aaa',
        fontSize: 10,
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 2,
    },
    margenFormulaSub: {
        color: '#666',
        fontSize: 8,
        textAlign: 'center',
        marginBottom: 4,
    },
    margenRefText: {
        color: '#666',
        fontSize: 9,
        textAlign: 'center',
        marginBottom: 6,
    },
    rentabilidadPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 4,
        borderWidth: 1,
    },
    rentabilidadPillText: {
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    toggleBreakdownBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        marginTop: 8,
        marginBottom: 4,
        borderRadius: 6,
        backgroundColor: '#141414',
    },
    toggleBreakdownText: {
        color: '#888',
        fontSize: 10,
        fontWeight: '700',
    },
    packagingCard: {
        backgroundColor: '#121212',
        borderRadius: 10,
        padding: 12,
        marginTop: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222',
    },
    packagingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    packagingTitle: {
        color: '#d4af37',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    packagingBadgeActive: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        backgroundColor: '#1a1a1a',
        borderWidth: 1,
        borderColor: '#333',
    },
    packagingBadgeActiveText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    packagingSubtitle: {
        color: '#888',
        fontSize: 10,
        marginBottom: 10,
    },
    packagingPillsRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 8,
    },
    packagingPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#0c0c0c',
        borderWidth: 1,
        borderColor: '#262626',
    },
    packagingPillActiveGeneral: {
        backgroundColor: '#2ecc7118',
        borderColor: '#2ecc71',
    },
    packagingPillActiveRfid: {
        backgroundColor: '#7fb3d318',
        borderColor: '#7fb3d3',
    },
    packagingPillActiveNone: {
        backgroundColor: '#e74c3c18',
        borderColor: '#e74c3c',
    },
    packagingPillText: {
        color: '#777',
        fontSize: 9,
        fontWeight: '700',
        textAlign: 'center',
    },
    packagingPillTextActiveGeneral: {
        color: '#2ecc71',
        fontWeight: '800',
    },
    packagingPillTextActiveRfid: {
        color: '#7fb3d3',
        fontWeight: '800',
    },
    packagingPillTextActiveNone: {
        color: '#e74c3c',
        fontWeight: '800',
    },
    packagingInfoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#0a0a0a',
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#1a1a1a',
    },
    packagingInfoText: {
        color: '#888',
        fontSize: 9,
        flex: 1,
    },
    packagingPriceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0a0a0a',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#262626',
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 8,
    },
    packagingPriceLabel: {
        color: '#d4af37',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.5,
    },
    packagingPriceHelper: {
        color: '#888',
        fontSize: 9,
        marginTop: 2,
    },
    packagingInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#141414',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#d4af3766',
        paddingHorizontal: 10,
        paddingVertical: 4,
        minWidth: 90,
    },
    packagingInputPrefix: {
        color: '#d4af37',
        fontSize: 14,
        fontWeight: '900',
        marginRight: 4,
    },
    packagingPriceInput: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '900',
        padding: 0,
        minWidth: 50,
        textAlign: 'right',
    },
});
