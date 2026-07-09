import React, { useRef, useState, useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, PanResponder, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const GestureClientRow = ({ item, onSelectWithType }) => {
    const pan = useRef(new Animated.ValueXY()).current;

    const [actionLabel, setActionLabel] = useState('');

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => false,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                // Solo activamos el pan responder si el movimiento horizontal es muy claro (evita bloquear scroll vertical)
                return Math.abs(gestureState.dx) > 30 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
            },
            onPanResponderMove: (evt, gestureState) => {
                pan.x.setValue(gestureState.dx);
                if (gestureState.dx > 50) setActionLabel('COBRAR VENTA');
                else if (gestureState.dx < -50) setActionLabel('PRESUPUESTO');
                else setActionLabel('');
            },
            onPanResponderRelease: (e, gestureState) => {
                let type = null;
                if (gestureState.dx > 80) type = 'completed';
                else if (gestureState.dx < -80) type = 'budget';

                if (type) {
                    setTimeout(() => onSelectWithType(item, type), 60);
                }
                
                setActionLabel('');
                Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
            }
        })
    ).current;

    const backgroundColor = pan.x.interpolate({
        inputRange: [-100, 0, 100],
        outputRange: ['#3498db', '#111', '#2ecc71'], 
    });

    const overlayColor = pan.y.interpolate({
        inputRange: [0, 100],
        outputRange: ['transparent', '#e74c3c'], 
    });

    return (
        <Animated.View 
            {...panResponder.panHandlers}
            style={{ marginBottom: 10 }}
        >
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => onSelectWithType(item, 'selected_only')}
            >
                <Animated.View style={[styles.clientRow, { transform: [{ translateX: pan.x }], backgroundColor }]}>
                    <View style={[styles.clientInfo, { flex: 1, marginRight: 10 }]}>
                        <View style={styles.avatar}>
                            <Text style={styles.avatarText}>{item ? item.name.charAt(0).toUpperCase() : '?'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.rowTitle} numberOfLines={1}>{item ? item.name : 'Cliente Anónimo (Venta de mostrador)'}</Text>
                            <Text style={styles.gestureHint} numberOfLines={1}>Toca para elegir • Desliza ↔ para acción rápida</Text>
                        </View>
                    </View>
                    
                    {actionLabel ? (
                        <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 12 }}>{actionLabel}</Text>
                    ) : (
                        <MaterialCommunityIcons name="gesture-swipe-horizontal" size={20} color="#555" />
                    )}
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const ClientModal = ({
    visible,
    onClose,
    clients,
    onSelectClient,
    onSelectWithType, // Nueva prop
    showNewClientForm,
    setShowNewClientForm,
    newClientName,
    setNewClientName,
    newClientPhone,
    setNewClientPhone,
    handleCreateClient,
    creatingClient
}) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredClients = useMemo(() => {
        if (!searchQuery) return clients;
        const lowQuery = searchQuery.toLowerCase();
        return clients.filter(c => c.name?.toLowerCase().includes(lowQuery) || c.phone?.includes(lowQuery));
    }, [searchQuery, clients]);

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <SafeAreaView style={styles.safeArea}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
                        <TouchableOpacity onPress={onClose} style={{ padding: 5 }}>
                            <MaterialCommunityIcons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>

                    {/* SEARCH BAR */}
                    {!showNewClientForm && (
                        <View style={styles.searchContainer}>
                            <MaterialCommunityIcons name="magnify" size={20} color="#888" style={styles.searchIcon} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Buscar cliente por nombre o teléfono..."
                                placeholderTextColor="#666"
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <MaterialCommunityIcons name="close-circle" size={20} color="#888" />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                {showNewClientForm ? (
                    <View style={styles.newClientForm}>
                        <Text style={styles.sectionTitle}>Nuevo Cliente</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre completo"
                            placeholderTextColor="#666"
                            value={newClientName}
                            onChangeText={setNewClientName}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder="Teléfono"
                            placeholderTextColor="#666"
                            value={newClientPhone}
                            onChangeText={setNewClientPhone}
                            keyboardType="phone-pad"
                        />
                        <View style={styles.formActions}>
                            <TouchableOpacity
                                style={[styles.smallBtn, { backgroundColor: '#333' }]}
                                onPress={() => setShowNewClientForm(false)}
                            >
                                <Text style={styles.btnText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.smallBtn, { backgroundColor: '#d4af37', flex: 1 }]}
                                onPress={handleCreateClient}
                                disabled={creatingClient}
                            >
                                {creatingClient ? <ActivityIndicator color="#000" /> : <Text style={[styles.btnText, { color: '#000', fontWeight: 'bold' }]}>Guardar y Usar</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.newClientBtn}
                        onPress={() => setShowNewClientForm(true)}
                    >
                        <MaterialCommunityIcons name="account-plus" size={24} color="#000" />
                        <Text style={styles.newClientText}>CREAR NUEVO CLIENTE</Text>
                    </TouchableOpacity>
                )}

                <View style={styles.divider} />

                <Text style={styles.sectionTitle}>Desliza sobre el cliente:</Text>

                <GestureClientRow 
                    item={null} 
                    onSelectWithType={(c, t) => onSelectWithType ? onSelectWithType(null, t) : onSelectClient(null)} 
                />

                <FlatList
                    data={filteredClients}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    keyboardShouldPersistTaps="handled"
                    renderItem={({ item }) => (
                        <GestureClientRow 
                            item={item} 
                            onSelectWithType={(c, t) => {
                                if (t === 'selected_only') {
                                    onSelectClient(item);
                                    onClose();
                                } else {
                                    onSelectWithType ? onSelectWithType(item, t) : onSelectClient(item);
                                }
                            }} 
                        />
                    )}
                    ListEmptyComponent={
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <Text style={{ color: '#888' }}>No se encontraron clientes</Text>
                        </View>
                    }
                />
            </View>
            </SafeAreaView>
        </Modal>
    );
};

const styles = StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: '#000' },
    modalContent: { flex: 1, backgroundColor: '#000', padding: 20 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 10, paddingHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222', height: 45 },
    searchIcon: { marginRight: 10 },
    searchInput: { flex: 1, color: '#fff', fontSize: 14, height: '100%' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#d4af37', fontSize: 20, fontWeight: 'bold' },
    newClientForm: { backgroundColor: '#111', padding: 20, borderRadius: 15, marginBottom: 20 },
    sectionTitle: { color: '#888', fontSize: 12, fontWeight: 'bold', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1 },
    input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    smallBtn: { height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    btnText: { color: '#fff' },
    newClientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d4af37', padding: 15, borderRadius: 12, gap: 10 },
    newClientText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    divider: { height: 1, backgroundColor: '#222', marginVertical: 20 },
    clientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#222', overflow: 'hidden' },
    clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
    rowTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    gestureHint: { color: '#444', fontSize: 10, marginTop: 2, fontWeight: 'bold' }
});

export default ClientModal;
