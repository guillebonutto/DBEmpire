import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CartItem = ({ item, onRemove, regionalPrice, onSplit, onOverride, manualOverride }) => {
    const displayPrice = regionalPrice !== undefined ? regionalPrice : item.sale_price;

    // Detection logic
    const isSuspicious = item.is_individual && item.qty >= 2 && !manualOverride;

    return (
        <View style={[styles.cartOuter, isSuspicious && styles.suspiciousBorder]}>
            <View style={styles.cartItem}>
                <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.itemMeta}>
                            <Text style={{ fontWeight: '900', color: '#fff' }}>{item.qty}</Text> x ${displayPrice.toLocaleString('es-AR', { minimumFractionDigits: 0 })}
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
                    <TouchableOpacity onPress={() => onRemove(item.cartId)} style={styles.removeBtn}>
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
                            onPress={() => onSplit(item.cartId)} 
                            style={styles.splitBtn}
                        >
                            <MaterialCommunityIcons name="content-cut" size={12} color="#fff" style={{ marginRight: 4 }} />
                            <Text style={styles.splitText}>Dividir por personas</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
        padding: 18,
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
    itemInfo: { flex: 1, marginRight: 15 },
    itemName: { color: '#fff', fontSize: 16, fontWeight: '900', letterSpacing: 0.3 },
    itemMeta: { color: '#888', fontSize: 13, marginTop: 6, letterSpacing: 0.5 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    colorBadge: { backgroundColor: '#d4af3720', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, marginTop: 4, borderWidth: 0.5, borderColor: '#d4af3740' },
    colorBadgeText: { color: '#d4af37', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    rightSection: { flexDirection: 'row', alignItems: 'center' },
    itemTotal: { color: '#d4af37', fontSize: 19, fontWeight: '900' },
    removeBtn: { 
        width: 36, 
        height: 36, 
        borderRadius: 18, 
        backgroundColor: '#ff3b3b15', 
        justifyContent: 'center', 
        alignItems: 'center' 
    }
});

export default CartItem;
