import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const SaleTypeSelector = ({ saleType, setSaleType }) => {
    return (
        <View style={styles.typeSelector}>
            <TouchableOpacity
                style={[styles.typeBtn, saleType === 'completed' && styles.typeBtnActive]}
                onPress={() => setSaleType('completed')}
            >
                <MaterialCommunityIcons name="currency-usd" size={18} color={saleType === 'completed' ? '#000' : '#888'} />
                <Text style={[styles.typeText, saleType === 'completed' && styles.typeTextActive]}>VENTA</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.typeBtn, saleType === 'pending' && styles.typeBtnActive]}
                onPress={() => setSaleType('pending')}
            >
                <MaterialCommunityIcons name="clock-outline" size={18} color={saleType === 'pending' ? '#000' : '#888'} />
                <Text style={[styles.typeText, saleType === 'pending' && styles.typeTextActive]}>DEUDA</Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.typeBtn, saleType === 'budget' && styles.typeBtnActive]}
                onPress={() => setSaleType('budget')}
            >
                <MaterialCommunityIcons name="file-document-outline" size={18} color={saleType === 'budget' ? '#000' : '#888'} />
                <Text style={[styles.typeText, saleType === 'budget' && styles.typeTextActive]}>PRESUP.</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    typeSelector: {
        flexDirection: 'row',
        padding: 15,
        gap: 10,
        backgroundColor: '#000',
        borderTopWidth: 1,
        borderTopColor: '#222'
    },
    typeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 10,
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#1a1a1a',
        gap: 8
    },
    typeBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    typeText: { color: '#888', fontSize: 11, fontWeight: '900', letterSpacing: 1 },
    typeTextActive: { color: '#000' }
});

export default SaleTypeSelector;
