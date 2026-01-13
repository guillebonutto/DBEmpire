import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, MaterialCommunityIcons } from 'react-native';

const ProductModal = ({
    visible,
    onClose,
    products,
    cart,
    expandedProductId,
    setExpandedProductId,
    tempQty,
    adjustTempQty,
    initiateProductSelection,
    confirmAddToCart
}) => {
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Seleccionar Producto</Text>
                    <TouchableOpacity onPress={onClose}>
                        <MaterialCommunityIcons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <FlatList
                    data={products}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    renderItem={({ item }) => {
                        const inCartItem = cart.find(c => c.id === item.id);
                        const inCartQty = inCartItem ? inCartItem.qty : 0;
                        const available = (item.current_stock || 0) - inCartQty;
                        const isExpanded = expandedProductId === item.id;

                        return (
                            <View style={[styles.productRow, isExpanded && styles.productRowExpanded]}>
                                {!isExpanded ? (
                                    <TouchableOpacity
                                        style={styles.rowContent}
                                        onPress={() => initiateProductSelection(item)}
                                    >
                                        <View>
                                            <Text style={styles.rowTitle}>{item.name}</Text>
                                            <Text style={[styles.rowSubtitle, { color: available < 5 ? '#e74c3c' : '#888' }]}>
                                                Disp: {available}
                                            </Text>
                                        </View>
                                        <Text style={styles.rowPrice}>${item.sale_price}</Text>
                                    </TouchableOpacity>
                                ) : (
                                    <View>
                                        <View style={styles.expandedHeader}>
                                            <Text style={styles.expandedTitle}>{item.name}</Text>
                                            <Text style={styles.expandedPrice}>${item.sale_price}</Text>
                                        </View>

                                        <View style={styles.qtyContainer}>
                                            <Text style={styles.qtyLabel}>Cantidad:</Text>
                                            <View style={styles.qtyControls}>
                                                <TouchableOpacity
                                                    onPress={() => adjustTempQty(-1, available)}
                                                    style={styles.qtyBtn}
                                                >
                                                    <MaterialCommunityIcons name="minus" size={24} color="#fff" />
                                                </TouchableOpacity>

                                                <Text style={styles.qtyValue}>{tempQty}</Text>

                                                <TouchableOpacity
                                                    onPress={() => adjustTempQty(1, available)}
                                                    style={[styles.qtyBtn, tempQty >= available && { opacity: 0.3 }]}
                                                    disabled={tempQty >= available}
                                                >
                                                    <MaterialCommunityIcons name="plus" size={24} color="#fff" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        <Text style={styles.availableText}>Disponible: {available}</Text>

                                        <View style={styles.actionRow}>
                                            <TouchableOpacity
                                                style={[styles.smallBtn, { flex: 1, backgroundColor: '#333' }]}
                                                onPress={() => setExpandedProductId(null)}
                                            >
                                                <Text style={styles.btnText}>Cancelar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.smallBtn, { flex: 2, backgroundColor: '#d4af37' }]}
                                                onPress={() => confirmAddToCart(item)}
                                            >
                                                <Text style={[styles.btnText, { color: '#000', fontWeight: 'bold' }]}>AGREGAR (+{tempQty})</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                )}
                            </View>
                        );
                    }}
                />
                <TouchableOpacity style={styles.finishBtn} onPress={onClose}>
                    <Text style={styles.finishText}>Terminar Selección</Text>
                </TouchableOpacity>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContent: { flex: 1, backgroundColor: '#000', padding: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold' },
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
    expandedHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    expandedTitle: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    expandedPrice: { color: '#d4af37', fontSize: 18, fontWeight: 'bold' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#000', borderRadius: 8, padding: 10 },
    qtyLabel: { color: '#888' },
    qtyControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    qtyBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
    qtyValue: { color: '#fff', fontSize: 24, fontWeight: 'bold', minWidth: 40, textAlign: 'center' },
    availableText: { color: '#888', textAlign: 'right', marginTop: 5, fontSize: 12 },
    actionRow: { flexDirection: 'row', marginTop: 15, gap: 10 },
    smallBtn: { height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    btnText: { color: '#fff', fontSize: 14 },
    finishBtn: { backgroundColor: '#d4af37', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
    finishText: { color: '#000', fontWeight: 'bold', fontSize: 16 }
});

export default ProductModal;
