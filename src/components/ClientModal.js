import React, { useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator, PanResponder, Animated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const GestureClientRow = ({ item, onSelectWithType }) => {
    const pan = useRef(new Animated.ValueXY()).current;

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 10 || Math.abs(gestureState.dy) > 10;
            },
            onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
            onPanResponderRelease: (e, gestureState) => {
                let type = null;
                if (gestureState.dx > 60) type = 'completed';
                else if (gestureState.dx < -60) type = 'budget';
                else if (gestureState.dy > 60) type = 'pending';

                if (type) {
                    setTimeout(() => onSelectWithType(item, type), 60);
                }
                
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
            collapsable={false}
            style={[styles.clientRow, { transform: [{ translateX: pan.x }, { translateY: pan.y }], backgroundColor }]}
        >
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor, opacity: 0.3 }]} />
            <View style={styles.clientInfo}>
                <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{item ? item.name.charAt(0) : '?'}</Text>
                </View>
                <View>
                    <Text style={styles.rowTitle}>{item ? item.name : 'Cliente Anónimo'}</Text>
                    <Text style={styles.gestureHint}>↔ Venta/Presu  ↓ Deuda</Text>
                </View>
            </View>
            <MaterialCommunityIcons name="gesture-swipe" size={20} color="#333" />
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
    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Seleccionar Cliente</Text>
                    <TouchableOpacity onPress={onClose}>
                        <MaterialCommunityIcons name="close" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

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
                    data={clients}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    renderItem={({ item }) => (
                        <GestureClientRow 
                            item={item} 
                            onSelectWithType={(c, t) => onSelectWithType ? onSelectWithType(item, t) : onSelectClient(item)} 
                        />
                    )}
                />
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalContent: { flex: 1, backgroundColor: '#000', padding: 20 },
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
