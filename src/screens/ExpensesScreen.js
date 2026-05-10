import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, ActivityIndicator, StatusBar, RefreshControl, Linking, Platform, ScrollView, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { GeminiService } from '../services/geminiService';
import { useFinanceStore } from '../store/useFinanceStore';
import { SyncService } from '../services/syncService';
import { LocalDbService } from '../services/localDbService';

const CATEGORIAS_GASTOS = ['General', 'Alquiler', 'Servicios', 'Marketing', 'Inventario', 'Salarios', 'Retiro del Titular', 'Descuento', 'Pago de Deuda', 'Otro'];

export default function ExpensesScreen({ navigation }) {
    const { expenses, supplierOrders: orders, isLoading: storeLoading, addExpenseLocal, setFinanceState, fetchAllData } = useFinanceStore();

    const [viewMode, setViewMode] = useState('expenses'); // 'expenses' | 'purchases'
    const [adding, setAdding] = useState(false);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [scanning, setScanning] = useState(false);

    useFocusEffect(
        useCallback(() => {
            fetchAllData();
        }, [])
    );

    const handleAddExpense = async () => {
        if (!description || !amount) {
            Alert.alert('Error', 'La descripción y el monto son obligatorios');
            return;
        }

        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            Alert.alert('Error', 'Ingresa un monto válido');
            return;
        }

        const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

        const finalAmount = category === 'Descuento' ? -Math.abs(numAmount) : numAmount;
        const newExpense = {
            id: generateUUID(),
            description: description.trim(),
            amount: finalAmount,
            category,
            created_at: new Date().toISOString()
        };

        // 1. Optimistic Update
        addExpenseLocal(newExpense);

        // 2. Queue for Sync
        SyncService.queueAction('expense', newExpense, {}, 'INSERT');

        // 3. Reset UI
        setDescription('');
        setAmount('');
        setCategory('General');
        setAdding(false);
        
        if (Platform.OS === 'web') alert('✅ Gasto Registrado (se sincronizará en segundo plano)');
        else Alert.alert('✅ Gasto Registrado', 'Se sincronizará en segundo plano.');
    };

    const handleDeleteExpense = async (id) => {
        const performDelete = async () => {
            try {
                // Optimistic Local Delete
                setFinanceState({
                    expenses: expenses.filter(e => e.id !== id)
                });
                await LocalDbService.deleteItem('expenses', id);

                // Queue Remote Delete
                await SyncService.queueAction('expense', { id }, {}, 'DELETE');
            } catch (err) {
                if (Platform.OS === 'web') alert('Error: No se pudo eliminar el gasto');
                else Alert.alert('Error', 'No se pudo eliminar el gasto');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm('¿Estás seguro de que quieres eliminar este gasto?')) {
                performDelete();
            }
        } else {
            Alert.alert(
                'Confirmar Eliminación',
                '¿Estás seguro de que quieres eliminar este gasto?',
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Eliminar', style: 'destructive', onPress: performDelete }
                ]
            );
        }
    };

    const handlePayInstallment = async (item) => {
        const currentPaid = item.installments_paid || 0;
        const total = item.installments_total || 1;
        if (currentPaid >= total) return;

        const installmentAmount = (item.total_cost || item.total_amount) / total;

        const confirmPayment = async () => {
            const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });

            const newExpense = {
                id: generateUUID(),
                description: `Cuota ${currentPaid + 1}/${total}: ${item.provider_name} (Pedido #${item.id.slice(0, 4)})`,
                amount: installmentAmount,
                category: 'Pago de Deuda',
                details: item.id, // Vínculo con el pedido de proveedor
                created_at: new Date().toISOString()
            };

            // 1. Optimistic Local State
            addExpenseLocal(newExpense);
            const updatedOrder = { ...item, installments_paid: currentPaid + 1 };
            setFinanceState({
                supplierOrders: orders.map(o => o.id === item.id ? updatedOrder : o)
            });

            // 2. Queue Sync Actions
            await SyncService.queueAction('expense', newExpense, {}, 'INSERT');
            await SyncService.queueAction('order', updatedOrder, {}, 'UPDATE');

            if (Platform.OS === 'web') alert('✅ Pago Registrado: Se sincronizará en segundo plano.');
            else Alert.alert('✅ Pago Registrado', 'Se sincronizará en segundo plano.');
        };

        if (Platform.OS === 'web') {
            if (window.confirm(`¿Registrar el pago de la Cuota ${currentPaid + 1}/${total} por $${installmentAmount.toLocaleString()}?`)) {
                confirmPayment();
            }
        } else {
            Alert.alert(
                'Pagar Cuota',
                `¿Registrar el pago de la Cuota ${currentPaid + 1}/${total} por $${installmentAmount.toLocaleString()}?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Confirmar Pago', onPress: confirmPayment }
                ]
            );
        }
    };

    const handleAIScan = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') return Alert.alert('Error', 'Necesitamos acceso a la cámara');

        const result = await ImagePicker.launchCameraAsync({
            base64: true,
            quality: 0.5
        });

        if (!result.canceled) {
            setScanning(true);
            try {
                const data = await GeminiService.analyzeReceipt(result.assets[0].base64);
                if (data.total) setAmount(data.total.toString());
                if (data.vendor || data.items) setDescription(`${data.vendor || ''} ${data.items || ''}`.trim());
                setAdding(true);
            } catch (err) {
                Alert.alert('AI Error', 'No se pudo analizar el recibo automáticamente.');
            } finally {
                setScanning(false);
            }
        }
    };

    const renderExpenseItem = ({ item }) => (
        <View style={styles.expenseCard}>
            <View style={styles.expenseHeader}>
                <View style={styles.categoryBadge}>
                    <Text style={styles.categoryText}>{item.category || 'General'}</Text>
                </View>
                <Text style={styles.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.expenseMain}>
                <Text style={styles.descriptionText}>{item.description}</Text>
                <Text style={[styles.amountText, item.amount < 0 && { color: '#2ecc71' }]}>
                    {item.amount < 0 ? `+ $${Math.abs(item.amount).toLocaleString()}` : `- $${item.amount.toLocaleString()}`}
                </Text>
            </View>
            <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDeleteExpense(item.id)}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#555" />
            </TouchableOpacity>
        </View>
    );

    const renderOrderItem = ({ item }) => {
        const paid = item.installments_paid || 0;
        const total = item.installments_total || 1;
        const progress = (paid / total) * 100;
        
        return (
            <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <Text style={styles.providerName}>{item.provider_name}</Text>
                    <View style={[styles.statusBadge, item.status === 'received' ? { backgroundColor: '#2ecc7122' } : { backgroundColor: '#3498db22' }]}>
                        <Text style={[styles.statusText, item.status === 'received' ? { color: '#2ecc71' } : { color: '#3498db' }]}>
                            {item.status?.toUpperCase() || 'PENDIENTE'}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.orderInfo}>
                    <View>
                        <Text style={styles.orderLabel}>TOTAL COMPRA</Text>
                        <Text style={styles.orderValue}>$${(item.total_cost || item.total_amount || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.orderLabel}>CUOTAS</Text>
                        <Text style={styles.orderValue}>{paid} / {total}</Text>
                    </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressContainer}>
                    <View style={[styles.progressBar, { width: `${progress}%` }]} />
                </View>

                {paid < total && (
                    <TouchableOpacity style={styles.payButton} onPress={() => handlePayInstallment(item)}>
                        <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.payGradient}>
                            <MaterialCommunityIcons name="cash-check" size={20} color="#000" />
                            <Text style={styles.payText}>PAGAR SIGUIENTE CUOTA</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="chevron-left" size={32} color="#d4af37" />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerLabel}>FINANZAS</Text>
                    <Text style={styles.title}>GASTOS Y COMPRAS</Text>
                </View>
                <TouchableOpacity style={styles.aiButton} onPress={handleAIScan} disabled={scanning}>
                    {scanning ? (
                        <ActivityIndicator size="small" color="#d4af37" />
                    ) : (
                        <MaterialCommunityIcons name="brain" size={28} color="#d4af37" />
                    )}
                </TouchableOpacity>
            </View>

            {/* Mode Selector */}
            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tab, viewMode === 'expenses' && styles.activeTab]} 
                    onPress={() => setViewMode('expenses')}
                >
                    <Text style={[styles.tabText, viewMode === 'expenses' && styles.activeTabText]}>GASTOS</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tab, viewMode === 'purchases' && styles.activeTab]} 
                    onPress={() => setViewMode('purchases')}
                >
                    <Text style={[styles.tabText, viewMode === 'purchases' && styles.activeTabText]}>COMPRAS</Text>
                </TouchableOpacity>
            </View>

            {/* Main Content */}
            <View style={{ flex: 1 }}>
                {viewMode === 'expenses' ? (
                    <FlatList
                        data={expenses}
                        keyExtractor={item => item.id}
                        renderItem={renderExpenseItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyBox}>
                                <MaterialCommunityIcons name="cash-off" size={60} color="#333" />
                                <Text style={styles.emptyText}>No hay gastos registrados este mes</Text>
                            </View>
                        }
                        refreshControl={
                            <RefreshControl refreshing={storeLoading} onRefresh={fetchAllData} tintColor="#d4af37" />
                        }
                    />
                ) : (
                    <FlatList
                        data={orders}
                        keyExtractor={item => item.id}
                        renderItem={renderOrderItem}
                        contentContainerStyle={styles.listContent}
                        ListEmptyComponent={
                            <View style={styles.emptyBox}>
                                <MaterialCommunityIcons name="truck-outline" size={60} color="#333" />
                                <Text style={styles.emptyText}>No hay órdenes de compra registradas</Text>
                            </View>
                        }
                        refreshControl={
                            <RefreshControl refreshing={storeLoading} onRefresh={fetchAllData} tintColor="#d4af37" />
                        }
                    />
                )}
            </View>

            {/* Floating Action Button */}
            <TouchableOpacity 
                style={styles.fab} 
                onPress={() => {
                    if (viewMode === 'purchases') {
                        navigation.navigate('NewSupplierOrder');
                    } else {
                        setAdding(true);
                    }
                }}
            >
                <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.fabGradient}>
                    <MaterialCommunityIcons name="plus" size={32} color="#000" />
                </LinearGradient>
            </TouchableOpacity>

            {/* Add Modal */}
            <Modal visible={adding} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>REGISTRAR GASTO</Text>
                            <TouchableOpacity onPress={() => setAdding(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            <Text style={styles.inputLabel}>DESCRIPCIÓN</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="Ej: Pago de Luz Edesur" 
                                placeholderTextColor="#444"
                                value={description}
                                onChangeText={setDescription}
                            />

                            <Text style={styles.inputLabel}>MONTO ($$)</Text>
                            <TextInput 
                                style={styles.input} 
                                placeholder="0.00" 
                                placeholderTextColor="#444"
                                keyboardType="numeric"
                                value={amount}
                                onChangeText={setAmount}
                            />

                            <Text style={styles.inputLabel}>CATEGORÍA</Text>
                            <View style={styles.categoryGrid}>
                                {CATEGORIAS_GASTOS.map(cat => (
                                    <TouchableOpacity 
                                        key={cat} 
                                        style={[styles.catBtn, category === cat && styles.catBtnActive]}
                                        onPress={() => setCategory(cat)}
                                    >
                                        <Text style={[styles.catBtnText, category === cat && styles.catBtnTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity style={styles.saveButton} onPress={handleAddExpense}>
                                <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.saveGradient}>
                                    <Text style={styles.saveText}>CONFIRMAR GASTO</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 10 },
    backBtn: { marginRight: 10 },
    headerLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', letterSpacing: 2 },
    title: { color: '#d4af37', fontSize: 20, fontWeight: '900' },
    aiButton: { marginLeft: 'auto', width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
    tabContainer: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 10, gap: 15 },
    tab: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: 'transparent' },
    activeTab: { borderBottomColor: '#d4af37' },
    tabText: { color: '#444', fontSize: 14, fontWeight: 'bold' },
    activeTabText: { color: '#fff' },
    listContent: { padding: 20, paddingBottom: 100 },
    expenseCard: { backgroundColor: '#111', borderRadius: 20, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    expenseHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    categoryBadge: { backgroundColor: 'rgba(212, 175, 55, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    categoryText: { color: '#d4af37', fontSize: 10, fontWeight: 'bold' },
    dateText: { color: '#444', fontSize: 11 },
    expenseMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
    descriptionText: { color: '#fff', fontSize: 16, fontWeight: '600', flex: 1, marginRight: 10 },
    amountText: { color: '#ff6b6b', fontSize: 18, fontWeight: '900' },
    deleteIcon: { position: 'absolute', right: 10, top: 10, padding: 5 },
    orderCard: { backgroundColor: '#111', borderRadius: 24, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    orderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
    providerName: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    statusText: { fontSize: 10, fontWeight: 'bold' },
    orderInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    orderLabel: { color: '#555', fontSize: 10, fontWeight: 'bold', marginBottom: 4 },
    orderValue: { color: '#fff', fontSize: 15, fontWeight: '700' },
    progressContainer: { height: 6, backgroundColor: '#222', borderRadius: 3, marginBottom: 15, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#d4af37' },
    payButton: { borderRadius: 12, overflow: 'hidden', marginTop: 5 },
    payGradient: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 12, gap: 10 },
    payText: { color: '#000', fontSize: 13, fontWeight: '900' },
    emptyBox: { marginTop: 60, alignItems: 'center' },
    emptyText: { color: '#444', fontSize: 14, marginTop: 15 },
    fab: { position: 'absolute', bottom: 30, right: 30, width: 64, height: 64, borderRadius: 32, elevation: 8, shadowColor: '#d4af37', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
    fabGradient: { flex: 1, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#000', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '90%', borderWidth: 1, borderColor: '#222' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
    modalTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900' },
    inputLabel: { color: '#555', fontSize: 12, fontWeight: 'bold', marginBottom: 8, marginTop: 15 },
    input: { backgroundColor: '#111', borderRadius: 15, padding: 15, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: '#222' },
    categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 },
    catBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
    catBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    catBtnText: { color: '#666', fontSize: 12, fontWeight: 'bold' },
    catBtnTextActive: { color: '#000' },
    saveButton: { marginTop: 30, borderRadius: 15, overflow: 'hidden', marginBottom: 20 },
    saveGradient: { paddingVertical: 18, alignItems: 'center' },
    saveText: { color: '#000', fontSize: 16, fontWeight: '900' }
});
