import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CartItem = ({ item, onRemove }) => {
    return (
        <View style={styles.cartItem}>
            <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemMeta}>Cant: {item.qty} x ${item.sale_price}</Text>
            </View>
            <View style={styles.rightSection}>
                <Text style={styles.itemTotal}>${(item.sale_price * item.qty).toFixed(2)}</Text>
                <TouchableOpacity onPress={() => onRemove(item.id)} style={styles.removeBtn}>
                    <MaterialCommunityIcons name="delete-outline" size={24} color="#e74c3c" />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    cartItem: {
        backgroundColor: '#1a1a1a',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333'
    },
    itemInfo: { flex: 1 },
    itemName: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
    itemMeta: { color: '#888', fontSize: 12, marginTop: 4 },
    rightSection: { flexDirection: 'row', alignItems: 'center' },
    itemTotal: { color: '#fff', fontSize: 16, fontWeight: '900', marginRight: 15 },
    removeBtn: { padding: 5 }
});

export default CartItem;
