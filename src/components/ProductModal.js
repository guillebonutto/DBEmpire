import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ProductModal = ({
    visible,
    onClose,
    products,
    cart,
    expandedProductId,
    setExpandedProductId,
    tempQty,
    selectedColor,
    setSelectedColor,
    adjustTempQty,
    initiateProductSelection,
    confirmAddToCart,
    userRole,
}) => {
    const [searchQuery, setSearchQuery] = React.useState('');

    const filteredProducts = React.useMemo(() => {
        if (!searchQuery.trim()) return products;
        const lowQuery = searchQuery.toLowerCase();
        return products.filter(p =>
            p.name?.toLowerCase().includes(lowQuery) ||
            p.barcode?.includes(searchQuery)
        );
    }, [searchQuery, products]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Buscar Producto</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <MaterialCommunityIcons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <MaterialCommunityIcons name="magnify" size={20} color="#888" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar por nombre o código..."
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus={false}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <MaterialCommunityIcons name="close-circle" size={18} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <FlatList
                        data={filteredProducts}
                        keyExtractor={item => item.id}
                        contentContainerStyle={{ paddingBottom: 20 }}
                        renderItem={({ item }) => {
                            const inCartItem = cart.find(c => c.id === item.id);
                            const inCartQty = inCartItem ? inCartItem.qty : 0;
                            
                            // Use Córdoba stock for everyone except admin/leader
                            const baseStock = (userRole === 'admin' || userRole === 'leader') ? (item.stock_local || item.current_stock || 0) : (item.stock_cordoba || 0);
                            const available = baseStock - inCartQty;
                            
                            const isExpanded = expandedProductId === item.id;
                            const displayPrice = (userRole === 'admin' || userRole === 'leader') ? item.sale_price : (item.sale_price_cordoba || item.sale_price);

                            const selectedVariant = isExpanded && selectedColor ? item.variants?.find(v => v.color === selectedColor) : null;
                            const effectiveMax = selectedVariant ? (selectedVariant.stock || 0) : available;

                            return (
                                <View style={[styles.productRow, isExpanded && styles.productRowExpanded]}>
                                    {!isExpanded ? (
                                        <TouchableOpacity
                                            style={styles.rowContent}
                                            onPress={() => {
                                                if (!item.variants || item.variants.length === 0) {
                                                    confirmAddToCart(item);
                                                } else {
                                                    initiateProductSelection(item);
                                                }
                                            }}
                                        >
                                            <View style={{ flex: 1, marginRight: 15 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                                                    <Text style={styles.rowTitle} numberOfLines={2}>{item.name}</Text>
                                                    {inCartQty > 0 && (
                                                        <View style={styles.inCartBadge}>
                                                            <Text style={styles.inCartBadgeText}>x{inCartQty}</Text>
                                                        </View>
                                                    )}
                                                </View>
                                                <Text style={[styles.rowSubtitle, { color: available <= 0 ? '#e74c3c' : '#888' }]}>
                                                    Disp: {available} {!(userRole === 'admin' || userRole === 'leader') && <Text style={{ fontSize: 9, color: '#d4af37' }}>(STOCK CBA)</Text>}
                                                </Text>
                                            </View>
                                            <View style={{ alignItems: 'flex-end', gap: 4 }}>
                                                <Text style={styles.rowPrice} numberOfLines={1}>${displayPrice}</Text>
                                                <View style={styles.addPill}>
                                                    <MaterialCommunityIcons name="plus" size={14} color="#000" />
                                                    <Text style={styles.addPillText}>AGREGAR</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                    ) : (
                                        <View>
                                            <View style={styles.expandedHeader}>
                                                <Text style={[styles.expandedTitle, { flex: 1, marginRight: 15 }]} numberOfLines={2}>{item.name}</Text>
                                                <Text style={styles.expandedPrice}>${displayPrice}</Text>
                                            </View>

                                            <View style={styles.qtyContainer}>
                                                <Text style={styles.qtyLabel}>Cantidad a agregar:</Text>
                                                <View style={styles.qtyControls}>
                                                    <TouchableOpacity
                                                        onPress={() => adjustTempQty(-1, effectiveMax)}
                                                        style={styles.qtyBtn}
                                                    >
                                                        <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                                                    </TouchableOpacity>

                                                    <Text style={styles.qtyValue}>{tempQty}</Text>

                                                    <TouchableOpacity
                                                        onPress={() => adjustTempQty(1, effectiveMax)}
                                                        style={[styles.qtyBtn, tempQty >= effectiveMax && { opacity: 0.3 }]}
                                                        disabled={tempQty >= effectiveMax}
                                                    >
                                                        <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            </View>

                                            {item.variants && item.variants.length > 0 && (
                                                <View style={styles.variantsContainer}>
                                                    <Text style={styles.variantsLabel}>Seleccionar Color:</Text>
                                                    <View style={styles.variantsList}>
                                                        {item.variants.map((v, idx) => {
                                                            const isSelected = selectedColor === v.color;
                                                            const isOutOfStock = (v.stock || 0) <= 0;

                                                            return (
                                                                <TouchableOpacity
                                                                    key={idx}
                                                                    style={[
                                                                        styles.variantPill,
                                                                        isSelected && styles.variantPillSelected,
                                                                        isOutOfStock && styles.variantPillDisabled
                                                                    ]}
                                                                    onPress={() => !isOutOfStock && setSelectedColor(v.color)}
                                                                    disabled={isOutOfStock}
                                                                >
                                                                    <Text style={[
                                                                        styles.variantPillText,
                                                                        isSelected && styles.variantPillTextSelected,
                                                                        isOutOfStock && styles.variantPillTextDisabled
                                                                    ]}>
                                                                        {v.color} ({v.stock})
                                                                    </Text>
                                                                </TouchableOpacity>
                                                            );
                                                        })}
                                                    </View>
                                                </View>
                                            )}
                                            <Text style={styles.availableText}>Disponible: {available}</Text>

                                            <View style={styles.actionRow}>
                                                <TouchableOpacity
                                                    style={[styles.smallBtn, { flex: 1, backgroundColor: '#222' }]}
                                                    onPress={() => setExpandedProductId(null)}
                                                >
                                                    <Text style={styles.btnText}>Cancelar</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[styles.smallBtn, { flex: 2, backgroundColor: '#d4af37' }]}
                                                    onPress={() => confirmAddToCart(item)}
                                                >
                                                    <Text style={[styles.btnText, { color: '#000', fontWeight: 'bold' }]}>CONFIRMAR (+{tempQty})</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            );
                        }}
                    />

                    <View style={styles.modalFooterRow}>
                        <TouchableOpacity style={styles.finishBtn} onPress={onClose}>
                            <Text style={styles.finishText}>
                                {cart.length > 0 ? `CONTINUAR CON ${cart.length} ${cart.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'}` : 'VOLVER AL CARRITO'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000'
    },
    modalContent: { flex: 1, backgroundColor: '#000', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold' },
    closeBtn: { padding: 4 },
    productRow: {
        backgroundColor: '#111',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#222'
    },
    productRowExpanded: { borderColor: '#d4af37', borderWidth: 2 },
    rowContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    rowTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    rowSubtitle: { fontSize: 12, marginTop: 4 },
    rowPrice: { color: '#d4af37', fontSize: 16, fontWeight: 'bold' },
    addPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d4af37',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        gap: 2,
    },
    addPillText: {
        color: '#000',
        fontSize: 10,
        fontWeight: '900',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchIcon: { marginRight: 10 },
    searchInput: {
        flex: 1,
        color: '#fff',
        fontSize: 14,
    },
    expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    expandedTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    expandedPrice: { color: '#d4af37', fontSize: 18, fontWeight: 'bold' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', borderRadius: 8, padding: 10 },
    qtyLabel: { color: '#888' },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    qtyBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
    qtyValue: { color: '#fff', fontSize: 20, fontWeight: 'bold', minWidth: 30, textAlign: 'center' },
    availableText: { color: '#888', textAlign: 'right', marginTop: 5, fontSize: 12 },
    actionRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
    smallBtn: { height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 14 },
    finishBtn: { backgroundColor: '#d4af37', padding: 16, borderRadius: 12, alignItems: 'center', width: '100%' },
    finishText: { color: '#000', fontWeight: '900', fontSize: 15, letterSpacing: 0.5 },
    variantsContainer: { marginTop: 15 },
    variantsLabel: { color: '#888', fontSize: 12, marginBottom: 8 },
    variantsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    variantPill: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#222',
        borderWidth: 1,
        borderColor: '#333'
    },
    variantPillSelected: {
        backgroundColor: '#d4af37',
        borderColor: '#d4af37'
    },
    variantPillDisabled: {
        opacity: 0.3,
        backgroundColor: '#111'
    },
    variantPillText: { color: '#fff', fontSize: 13 },
    variantPillTextSelected: { color: '#000', fontWeight: 'bold' },
    variantPillTextDisabled: { color: '#666' },
    inCartBadge: {
        backgroundColor: '#d4af3720',
        borderColor: '#d4af37',
        borderWidth: 0.5,
        borderRadius: 8,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    inCartBadgeText: {
        color: '#d4af37',
        fontSize: 10,
        fontWeight: 'bold',
    },
    modalFooterRow: {
        marginTop: 10,
    },
});

export default ProductModal;
