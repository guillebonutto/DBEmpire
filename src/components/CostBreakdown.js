import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const CostBreakdown = ({
    subtotal,
    total,
    discount,
    selectedPromo,
    promoDetail,
    includeTransport,
    setIncludeTransport,
    transportCost
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

            <TouchableOpacity
                style={[styles.transportBtn, includeTransport && styles.transportBtnActive]}
                onPress={() => setIncludeTransport(!includeTransport)}
            >
                <View style={styles.transportLeft}>
                    <MaterialCommunityIcons
                        name={includeTransport ? "checkbox-marked" : "checkbox-blank-outline"}
                        size={20}
                        color={includeTransport ? '#2ecc71' : '#666'}
                        style={{ marginRight: 8 }}
                    />
                    <Text style={[styles.transportLabel, includeTransport && styles.transportLabelActive]}>Incluir Transporte:</Text>
                </View>
                <Text style={[styles.transportValue, includeTransport && styles.transportValueActive]}>
                    ${transportCost.toFixed(2)}
                </Text>
            </TouchableOpacity>

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
    transportBtn: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
        padding: 8,
        backgroundColor: 'transparent',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#333'
    },
    transportBtnActive: { backgroundColor: '#1e2a1e', borderColor: '#2ecc71' },
    transportLeft: { flexDirection: 'row', alignItems: 'center' },
    transportLabel: { color: '#888', fontSize: 14 },
    transportLabelActive: { color: '#2ecc71' },
    transportValue: { color: '#666', fontSize: 14, fontWeight: 'bold' },
    transportValueActive: { color: '#2ecc71' },
    divider: { height: 1, backgroundColor: '#333', marginVertical: 8 },
    totalLabel: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    totalValue: { color: '#d4af37', fontSize: 18, fontWeight: '900' }
});

export default CostBreakdown;
