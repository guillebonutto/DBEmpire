import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const PromotionSelector = ({ promos, selectedPromo, onSelectPromo }) => {
    if (promos.length === 0) return null;

    return (
        <View style={styles.promoContainer}>
            <Text style={styles.promoLabel}>APLICAR PROMOCIÓN / OFERTA:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <TouchableOpacity
                    style={[
                        styles.promoChip,
                        selectedPromo === null && styles.promoChipSelected
                    ]}
                    onPress={() => onSelectPromo(null)}
                >
                    <Text style={[styles.promoChipText, selectedPromo === null && styles.promoChipTextSelected]}>NINGUNA</Text>
                </TouchableOpacity>
                {promos.map(promo => (
                    <TouchableOpacity
                        key={promo.id}
                        style={[
                            styles.promoChip,
                            selectedPromo?.id === promo.id && styles.promoChipSelected
                        ]}
                        onPress={() => onSelectPromo(promo)}
                    >
                        <MaterialCommunityIcons
                            name="sale"
                            size={14}
                            color={selectedPromo?.id === promo.id ? "black" : "#d4af37"}
                            style={{ marginRight: 5 }}
                        />
                        <Text style={[
                            styles.promoChipText,
                            selectedPromo?.id === promo.id && styles.promoChipTextSelected
                        ]}>
                            {promo.title.toUpperCase()}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    promoContainer: { backgroundColor: '#111', padding: 15, borderTopWidth: 1, borderTopColor: '#333' },
    promoLabel: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 10, letterSpacing: 1 },
    promoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#1a1a1a',
        marginRight: 10,
        borderWidth: 1,
        borderColor: '#333'
    },
    promoChipSelected: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    promoChipText: { color: '#888', fontSize: 11, fontWeight: 'bold' },
    promoChipTextSelected: { color: '#000' }
});

export default PromotionSelector;
