import React from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

/**
 * SECCIÓN: IDENTIDAD DEL PRODUCTO
 * Nombre, código, imagen (compacta)
 */
export const IdentitySection = ({ formData, handleChange, image, onPickImage, onScanBarcode }) => (
    <View style={styles.section}>
        <Text style={styles.sectionTitle}>IDENTIDAD</Text>

        {/* Imagen compacta - sin redundancia */}
        <TouchableOpacity
            style={[styles.compactImagePicker, image && styles.compactImageLoaded]}
            onPress={onPickImage}
        >
            {image ? (
                <Image source={{ uri: image }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="cover" />
            ) : (
                <>
                    <MaterialCommunityIcons name="image-plus" size={28} color="#d4af37" />
                    <Text style={{ color: '#666', fontSize: 11, marginTop: 4 }}>Foto</Text>
                </>
            )}
        </TouchableOpacity>

        {/* Nombre */}
        <Text style={styles.inputLabel}>Nombre</Text>
        <TextInput
            style={styles.input}
            value={formData.name}
            onChangeText={(text) => handleChange('name', text)}
            placeholder="Ej. Smartwatch Pro"
            placeholderTextColor="#555"
        />

        {/* Código con botón scan integrado */}
        <Text style={styles.inputLabel}>Código de barras</Text>
        <View style={styles.barcodeInputWrapper}>
            <TextInput
                style={styles.barcodeInput}
                value={formData.barcode}
                onChangeText={(text) => handleChange('barcode', text)}
                placeholder="Escanear o ingresar"
                placeholderTextColor="#555"
            />
            <TouchableOpacity
                style={styles.scanIconBtn}
                onPress={onScanBarcode}
            >
                <MaterialCommunityIcons name="barcode-scan" size={20} color="#d4af37" />
            </TouchableOpacity>
        </View>
    </View>
);

/**
 * SECCIÓN: PRECIO (lo más importante)
 * Costo, Margen, Precios por ciudad + Indicador de rentabilidad
 */
export const PriceSection = ({ formData, handleChange, pendingPurchases, onShowPPPModal, queueItem }) => {
    const costPrice = parseFloat(formData.cost_price) || 0;

    // Calcular margen e indicador por ciudad (INDEPENDIENTES)
    const jujuyPrice = parseFloat(formData.sale_price) || 0;
    const cordobaPrice = parseFloat(formData.sale_price_cordoba) || 0;

    const jujuyProfit = jujuyPrice - costPrice;
    const jujuyPercent = costPrice > 0 ? ((jujuyProfit / costPrice) * 100).toFixed(0) : 0;

    const cordobaProfit = cordobaPrice - costPrice;
    const cordobaPercent = costPrice > 0 ? ((cordobaProfit / costPrice) * 100).toFixed(0) : 0;

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
            <View style={{ marginTop: 10, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8 }}>
                    <MaterialCommunityIcons name="package-variant-closed" size={18} color="#d4af37" style={{ marginRight: 8 }} />
                    <Text style={styles.inputLabel}>¿Es un Kit/Combo?</Text>
                </View>
                <TouchableOpacity style={[styles.toggleSwitch, isBundle && styles.toggleSwitchActive]} onPress={onToggleBundle}>
                    <View style={[styles.toggleCircle, isBundle && styles.toggleCircleActive]} />
                </TouchableOpacity>
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
});
