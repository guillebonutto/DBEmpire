import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CartItem = ({ item, onRemove, regionalPrice, onSplit, onOverride, manualOverride, onUpdateQty, availableStock }) => {
    const displayPrice = regionalPrice !== undefined ? regionalPrice : item.sale_price;
    const [editModalVisible, setEditModalVisible] = useState(false);
    const [inputQty, setInputQty] = useState(String(item.qty || 1));

    // Detection logic
    const isSuspicious = item.is_individual && item.qty >= 2 && !manualOverride;

    const handleSaveDirectQty = () => {
        const parsed = parseInt(inputQty, 10);
        if (!isNaN(parsed) && parsed > 0) {
            onUpdateQty && onUpdateQty(item.id, parsed, item.color);
        } else if (parsed <= 0) {
            onRemove && onRemove(item.id, item.color);
        }
        setEditModalVisible(false);
    };

    return (
        <View style={[styles.cartOuter, isSuspicious && styles.suspiciousBorder]}>
            <View style={styles.cartItem}>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.metaRow}>
                        {/* Interactive Quantity Selector */}
                        <View style={styles.qtyBadge}>
                            <TouchableOpacity 
                                onPress={() => onUpdateQty && onUpdateQty(item.id, item.qty - 1, item.color)} 
                                style={styles.qtyActionBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons name="minus" size={16} color="#d4af37" />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => {
                                    setInputQty(String(item.qty));
                                    setEditModalVisible(true);
                                }}
                                style={styles.qtyTextBtn}
                            >
                                <Text style={styles.qtyText}>{item.qty}</Text>
                                <MaterialCommunityIcons name="pencil" size={10} color="#666" style={{ marginLeft: 2 }} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => onUpdateQty && onUpdateQty(item.id, item.qty + 1, item.color)} 
                                style={styles.qtyActionBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons name="plus" size={16} color="#d4af37" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.itemMeta}>
                            x ${displayPrice.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
                        </Text>
                        {item.color && (
                            <View style={styles.colorBadge}>
                                <Text style={styles.colorBadgeText}>{item.color}</Text>
                            </View>
                        )}
                        {item.clientId && (
                            <View style={[styles.colorBadge, { backgroundColor: '#3498db20', borderColor: '#3498db40' }]}>
                                <Text style={[styles.colorBadgeText, { color: '#3498db' }]}>Asignado</Text>
                            </View>
                        )}
                    </View>
                </View>
                <View style={styles.rightSection}>
                    <View style={{ alignItems: 'flex-end', marginRight: 15 }}>
                        <Text style={styles.itemTotal}>${(displayPrice * item.qty).toLocaleString('es-AR', { minimumFractionDigits: 0 })}</Text>
                        <Text style={{ color: '#444', fontSize: 9, fontWeight: 'bold' }}>SUBTOTAL</Text>
                    </View>
                    <TouchableOpacity 
                        onPress={() => onRemove && onRemove(item.id, item.color)} 
                        style={styles.removeBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <MaterialCommunityIcons name="trash-can-outline" size={22} color="#ff3b3b" />
                    </TouchableOpacity>
                </View>
            </View>

            {isSuspicious && (
                <View style={styles.warningContainer}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#e67e22" style={{ marginRight: 6 }} />
                        <Text style={styles.warningText}>Este producto suele ser uno por persona</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity 
                            onPress={() => onOverride(item.id)} 
                            style={styles.ignoreBtn}
                        >
                            <Text style={styles.ignoreText}>Ignorar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => onSplit && onSplit(item.id, item.color)} 
                            style={styles.splitBtn}
                        >
                            <MaterialCommunityIcons name="content-cut" size={12} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.splitText}>Dividir por personas</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {/* Direct Quantity Input Modal */}
            <Modal
                visible={editModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setEditModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.editCard}>
                        <Text style={styles.editTitle}>Modificar Cantidad</Text>
                        <Text style={styles.editSubtitle} numberOfLines={2}>{item.name} {item.color ? `(${item.color})` : ''}</Text>
                        
                        <TextInput
                            style={styles.editInput}
                            value={inputQty}
                            onChangeText={setInputQty}
                            keyboardType="numeric"
                            autoFocus={true}
                            selectTextOnFocus={true}
                        />

                        <View style={styles.editBtnRow}>
                            <TouchableOpacity 
                                style={[styles.editBtn, styles.editBtnCancel]}
                                onPress={() => setEditModalVisible(false)}
                            >
                                <Text style={styles.editBtnCancelText}>Cancelar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.editBtn, styles.editBtnConfirm]}
                                onPress={handleSaveDirectQty}
                            >
                                <Text style={styles.editBtnConfirmText}>Guardar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    cartOuter: {
        backgroundColor: '#0a0a0a',
        borderRadius: 15,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#1a1a1a',
        overflow: 'hidden',
    },
    suspiciousBorder: {
        borderColor: '#e67e22',
        borderWidth: 1.5,
    },
    cartItem: {
        padding: 16,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    warningContainer: {
        backgroundColor: '#e67e2215',
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: '#e67e2230',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    warningText: { color: '#e67e22', fontSize: 11, fontWeight: '600' },
    splitBtn: { 
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#e67e22', 
        paddingHorizontal: 12, 
        paddingVertical: 6, 
        borderRadius: 8 
    },
    splitText: { color: '#fff', fontSize: 11, fontWeight: '900' },
    ignoreBtn: { 
        justifyContent: 'center',
        paddingHorizontal: 8 
    },
    ignoreText: { color: '#888', fontSize: 11, fontWeight: 'bold', textDecorationLine: 'underline' },
    itemInfo: { flex: 1, marginRight: 10 },
    itemName: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 0.3 },
    itemMeta: { color: '#888', fontSize: 13, letterSpacing: 0.5 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' },
    colorBadge: { backgroundColor: '#d4af3720', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 0.5, borderColor: '#d4af3740' },
    colorBadgeText: { color: '#d4af37', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    rightSection: { flexDirection: 'row', alignItems: 'center' },
    itemTotal: { color: '#d4af37', fontSize: 18, fontWeight: '900' },
    removeBtn: { 
        width: 40, 
        height: 40, 
        borderRadius: 20, 
        backgroundColor: '#ff3b3b15', 
        justifyContent: 'center', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#ff3b3b30'
    },
    qtyBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#181818',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#333',
        paddingHorizontal: 4,
        paddingVertical: 3,
        gap: 6,
    },
    qtyActionBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#252525',
        justifyContent: 'center',
        alignItems: 'center',
    },
    qtyTextBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    qtyText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '900',
        minWidth: 18,
        textAlign: 'center',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    editCard: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#111',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#d4af3740',
        alignItems: 'center',
    },
    editTitle: {
        color: '#d4af37',
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    editSubtitle: {
        color: '#aaa',
        fontSize: 13,
        textAlign: 'center',
        marginBottom: 16,
    },
    editInput: {
        width: '100%',
        backgroundColor: '#000',
        color: '#fff',
        fontSize: 28,
        fontWeight: '900',
        textAlign: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#d4af37',
        marginBottom: 20,
    },
    editBtnRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 10,
    },
    editBtn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    editBtnCancel: {
        backgroundColor: '#222',
    },
    editBtnCancelText: {
        color: '#888',
        fontWeight: 'bold',
        fontSize: 14,
    },
    editBtnConfirm: {
        backgroundColor: '#d4af37',
    },
    editBtnConfirmText: {
        color: '#000',
        fontWeight: '900',
        fontSize: 14,
    },
});

export default CartItem;
