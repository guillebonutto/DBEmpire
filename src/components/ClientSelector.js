import React, { useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, PanResponder, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ClientItem = ({ client, onSelectWithType }) => {
    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Only activate if movement is significant to avoid blocking scroll
                return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
            onPanResponderRelease: (e, gestureState) => {
                let type = null;
                if (gestureState.dx > 50) type = 'completed';
                else if (gestureState.dx < -50) type = 'budget';
                else if (gestureState.dy > 50) type = 'pending';

                if (type) {
                    // Pequeño delay para que Android no explote al desmontar la vista
                    setTimeout(() => onSelectWithType(client, type), 60);
                }
                
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
            }
        })
    ).current;

    const backgroundColor = pan.x.interpolate({
        inputRange: [-100, 0, 100],
        outputRange: ['#3498db', 'transparent', '#2ecc71'], 
    });

    const overlayColor = pan.y.interpolate({
        inputRange: [0, 100],
        outputRange: ['transparent', '#e74c3c'], 
    });

    return (
        <Animated.View 
            {...panResponder.panHandlers}
            collapsable={false}
            style={[
                styles.searchResultItem, 
                { transform: [{ translateX: pan.x }, { translateY: pan.y }], backgroundColor }
            ]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, opacity: 0.2 }]} />
            <MaterialCommunityIcons name="account" size={20} color="#d4af37" />
            <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.resultText}>{client.name}</Text>
                <Text style={styles.gestureHint}>↔ Venta/Presupuesto  ↓ Deuda</Text>
            </View>
        </Animated.View>
    );
};

const ClientSelector = ({
    selectedClient,
    clientError,
    searchQuery,
    setSearchQuery,
    setClientError,
    filteredClients,
    onSelectClient,
    onCreateClient,
    onRemoveClient,
    creatingClient,
    onSelectWithType // New prop for gestures
}) => {
    const handleSelect = (client, type) => {
        if (onSelectWithType) {
            onSelectWithType(client, type);
        } else {
            onSelectClient(client);
        }
    };

    return (
        <View style={styles.searchContainer}>
            {!selectedClient ? (
                <View>
                    <View style={[styles.searchBar, clientError && { borderColor: '#ff4d4d', borderWidth: 1 }]}>
                        <MaterialCommunityIcons name="magnify" size={24} color="#666" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Buscar o Crear Cliente..."
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={(text) => {
                                setSearchQuery(text);
                                if (clientError) setClientError(false);
                            }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <MaterialCommunityIcons name="close" size={20} color="#666" />
                            </TouchableOpacity>
                        )}
                    </View>
                    
                    {clientError && (
                        <Text style={styles.errorText}>
                            Por favor seleccione cliente con un gesto (Der: Venta, Izq: Presu, Aba: Deuda)
                        </Text>
                    )}

                    {searchQuery.length > 0 && (
                        <View style={styles.searchResults}>
                            {filteredClients.length === 0 && (
                                <TouchableOpacity
                                    style={styles.createOption}
                                    onPress={() => onCreateClient(searchQuery)}
                                >
                                    <View style={styles.createIcon}>
                                        {creatingClient ? <ActivityIndicator size="small" color="#000" /> : <MaterialCommunityIcons name="plus" size={20} color="#000" />}
                                    </View>
                                    <Text style={styles.createText}>Crear "{searchQuery}"</Text>
                                </TouchableOpacity>
                            )}

                            {filteredClients.map(client => (
                                <ClientItem 
                                    key={client.id} 
                                    client={client} 
                                    onSelectWithType={handleSelect} 
                                />
                            ))}
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.selectedClientRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.selectedAvatar}>
                            <Text style={{ color: '#000', fontWeight: 'bold' }}>{selectedClient.name.charAt(0)}</Text>
                        </View>
                        <View>
                            <Text style={styles.selectedLabel}>CLIENTE VINCULADO</Text>
                            <Text style={styles.selectedName}>{selectedClient.name}</Text>
                        </View>
                    </View>
                    <TouchableOpacity onPress={onRemoveClient} style={styles.removeClientBtn}>
                        <MaterialCommunityIcons name="close" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    searchContainer: { paddingHorizontal: 15, marginTop: 15, zIndex: 10 },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#111',
        borderRadius: 12,
        paddingHorizontal: 15,
        height: 50,
        borderWidth: 1,
        borderColor: '#222'
    },
    searchInput: { flex: 1, color: '#fff', marginLeft: 10, fontSize: 14 },
    errorText: { color: '#ff4d4d', fontSize: 11, marginTop: 5, marginLeft: 5, fontWeight: 'bold' },
    searchResults: {
        marginTop: 5,
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333',
        overflow: 'hidden'
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    resultText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    gestureHint: { color: '#555', fontSize: 10, marginTop: 2, fontWeight: 'bold' },
    createOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderBottomWidth: 1,
        borderBottomColor: '#222'
    },
    createIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#d4af37',
        justifyContent: 'center',
        alignItems: 'center'
    },
    createText: { color: '#d4af37', marginLeft: 15, fontWeight: 'bold' },
    selectedClientRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#d4af37'
    },
    selectedAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#d4af37',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15
    },
    selectedLabel: { color: '#666', fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    selectedName: { color: '#fff', fontSize: 16, fontWeight: 'bold', marginTop: 2 },
    removeClientBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#333',
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export default ClientSelector;
