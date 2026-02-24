import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CostBreakdown = ({
    subtotal,
    total,
    discount,
    manualDiscount,
    selectedPromo,
    promoDetail
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.label}>Subtotal Productos:</Text>
                <Text style={styles.value}>${subtotal.toFixed(2)}</Text>
            </View>

            {selectedPromo ? (
                <View style={styles.promoSection}>
                    <View style={styles.row}>
                        <Text style={styles.promoLabel}>Promo: {selectedPromo.title}</Text>
                        <Text style={styles.promoValue}>-${discount.toFixed(2)}</Text>
                    </View>
                    {promoDetail ? <Text style={styles.promoDetail}>({promoDetail})</Text> : null}
                </View>
            ) : null}

            {manualDiscount && manualDiscount > 0 ? (
                <View style={styles.row}>
                    <Text style={styles.manualDiscountLabel}>Descuento Manual:</Text>
                    <Text style={styles.manualDiscountValue}>-${manualDiscount.toFixed(2)}</Text>
                </View>
            ) : null}

            <View style={styles.divider} />
            <View style={styles.row}>
                <Text style={styles.totalLabel}>TOTAL:</Text>
                <Text style={styles.totalValue}>${total.toFixed(2)}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { backgroundColor: '#1a1a1a', padding: 15, borderTopWidth: 1, borderTopColor: '#333' },
    row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    label: { color: '#888', fontSize: 14 },
    value: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    promoSection: { marginBottom: 8 },
    promoLabel: { color: '#2ecc71', fontSize: 14, fontWeight: 'bold' },
    promoValue: { color: '#2ecc71', fontSize: 14, fontWeight: 'bold' },
    promoDetail: { color: '#2ecc71', fontSize: 12, fontStyle: 'italic' },
    manualDiscountLabel: { color: '#e74c3c', fontSize: 14, fontWeight: 'bold' },
    manualDiscountValue: { color: '#e74c3c', fontSize: 14, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: '#333', marginVertical: 8 },
    totalLabel: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    totalValue: { color: '#d4af37', fontSize: 18, fontWeight: '900' }
});

export default CostBreakdown;
