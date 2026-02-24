import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const ClientModal = ({
    visible,
    onClose,
    clients,
    onSelectClient,
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

                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>O selecciona uno existente:</Text>

                <TouchableOpacity style={styles.clientRow} onPress={() => {
                    onSelectClient(null);
                }}>
                    <View style={styles.clientInfo}>
                        <View style={[styles.avatar, { backgroundColor: '#333' }]}>
                            <MaterialCommunityIcons name="incognito" size={24} color="#888" />
                        </View>
                        <Text style={styles.rowTitle}>Cliente Anónimo / Mostrador</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                </TouchableOpacity>

                <FlatList
                    data={clients}
                    keyExtractor={item => item.id}
                    contentContainerStyle={{ paddingBottom: 50 }}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.clientRow} onPress={() => {
                            onSelectClient(item);
                        }}>
                            <View style={styles.clientInfo}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{item.name.charAt(0)}</Text>
                                </View>
                                <View>
                                    <Text style={styles.rowTitle}>{item.name}</Text>
                                    {item.phone ? <Text style={styles.rowSubtitle}>{item.phone}</Text> : null}
                                </View>
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                        </TouchableOpacity>
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
    sectionTitle: { color: '#888', fontSize: 14, fontWeight: 'bold', marginBottom: 15 },
    input: { backgroundColor: '#000', color: '#fff', padding: 15, borderRadius: 10, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
    smallBtn: { height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
    btnText: { color: '#fff' },
    newClientBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#d4af37', padding: 15, borderRadius: 12, gap: 10 },
    newClientText: { color: '#000', fontWeight: 'bold', fontSize: 14 },
    divider: { height: 1, backgroundColor: '#222', marginVertical: 20 },
    clientRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#111', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
    clientInfo: { flexDirection: 'row', alignItems: 'center', gap: 15 },
    avatar: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#d4af37', justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#000', fontWeight: 'bold', fontSize: 18 },
    rowTitle: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    rowSubtitle: { color: '#666', fontSize: 12, marginTop: 2 }
});

export default ClientModal;
