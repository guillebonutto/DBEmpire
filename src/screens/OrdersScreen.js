import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export default function OrdersScreen({ navigation, route }) {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [viewType, setViewType] = useState(route.params?.initialViewType || 'pedidos'); // 'pedidos' o 'presupuestos'
    
    // 🔥 Reaccionar a cambios en los parámetros de navegación (p.ej. al volver desde Home con otro botón)
    React.useEffect(() => {
        if (route.params?.initialViewType) {
            setViewType(route.params.initialViewType);
        }
    }, [route.params?.initialViewType]);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            // Traer todos los pedidos pendientes o presupuestos (excluyendo lo entregado/completado)
            const { data, error } = await supabase
                .from('sales')
                .select('*, clients(name), sale_items(*, products(name))')
                .not('status', 'in', '("completed","cancelled","exitosa","vended","transfer_completed")')
                .order('created_at', { ascending: false });

            if (error) throw error;
            
            // Filtro extra de seguridad para ignorar todo lo que sea de Logística (CBA/Socio)
            const filteredData = (data || []).filter(s => {
                const isLogistics = s.clients?.name && (s.clients.name.includes('Cordoba') || s.clients.name.includes('CBA') || s.clients.name.includes('Socio'));
                return !isLogistics;
            });

            setOrders(filteredData);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchOrders();
        }, [])
    );

    const handleTrack = (trackingNumber) => {
        if (!trackingNumber) {
            Alert.alert('Info', 'No hay número de seguimiento');
            return;
        }
        // Universal Tracking Link (17TRACK auto-detect)
        const url = `https://t.17track.net/en#nums=${trackingNumber}`;
        Linking.openURL(url);
    };

    const handleFinishOrder = async (order) => {
        Alert.alert(
            'Finalizar Pedido',
            '¿Marcar como Entregado/Finalizado? Pasará al historial de ventas.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Finalizar',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error } = await supabase
                                .from('sales')
                                .update({ status: 'completed' })
                                .eq('id', order.id);

                            if (error) throw error;
                            fetchOrders();
                            Alert.alert('Éxito', 'Pedido finalizado y archivado.');
                        } catch (err) {
                            Alert.alert('Error', 'No se pudo actualizar.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const generateReceiptPDF = async (saleData) => {
        try {
            const html = `
                <html>
                <body style="font-family: sans-serif; padding: 20px; color: #333;">
                    <div style="text-align: center; margin-bottom: 20px; border-bottom: 2px solid #d4af37; padding-bottom: 10px;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 24px;">DIGITAL BOOST EMPIRE</h1>
                        <p style="margin: 5px 0; font-size: 12px; font-weight: bold; color: #888;">PRESUPUESTO / COMPROBANTE</p>
                    </div>
                    
                    <div style="margin-bottom: 20px; font-size: 14px;">
                        <p style="margin: 5px 0;"><strong>Fecha:</strong> ${new Date(saleData.created_at).toLocaleString()}</p>
                        <p style="margin: 5px 0;"><strong>Operación:</strong> #SC-${saleData.id.slice(0, 8).toUpperCase()}</p>
                        <p style="margin: 5px 0;"><strong>Cliente:</strong> ${saleData.clients?.name || 'Anónimo'}</p>
                        ${saleData.status === 'budget' ? '<p style="margin: 5px 0; color: #e67e22; font-weight: bold;">ESTADO: PRESUPUESTO</p>' : ''}
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="background-color: #fbf0d4; color: #000;">
                                <th style="text-align: left; padding: 10px; border-bottom: 1px solid #d4af37;">Producto</th>
                                <th style="text-align: center; padding: 10px; border-bottom: 1px solid #d4af37;">Cant.</th>
                                <th style="text-align: right; padding: 10px; border-bottom: 1px solid #d4af37;">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${saleData.sale_items?.map(item => `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px;">
                                        ${item.products?.name || 'Item'} ${item.color ? `<span style="color: #666; font-size: 12px;">(${item.color})</span>` : ''}
                                    </td>
                                    <td style="text-align: center; padding: 10px;">${item.quantity}</td>
                                    <td style="text-align: right; padding: 10px;">$${(Number(item.unit_price_at_sale) * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('') || ''}
                        </tbody>
                    </table>

                    <div style="text-align: right; font-size: 18px; border-top: 2px solid #d4af37; padding-top: 10px;">
                        <p><strong>TOTAL: $${Number(saleData.total_amount).toFixed(2)}</strong></p>
                    </div>
                </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri);
        } catch (err) {
            Alert.alert('Error', 'No se pudo generar el PDF.');
        }
    };

    const renderOrderItem = useCallback(({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.orderId}>Pedido #{item.id.slice(0, 4)}</Text>
                    <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
                </View>
                <View style={[
                    styles.statusBadge,
                    {
                        backgroundColor: item.status === 'budget' ? '#e67e22' :
                            (item.tracking_number ? '#2980b9' : '#d4af37')
                    }
                ]}>
                    <Text style={styles.statusText}>
                        {item.status === 'budget' ? 'PRESUPUESTO' :
                            (item.tracking_number ? 'ENVIADO' : 'PENDIENTE')}
                    </Text>
                </View>
            </View>

            <Text style={styles.clientName}>{item.clients ? item.clients.name : 'Cliente Anónimo'}</Text>
            <Text style={styles.amount}>Total: ${item.total_amount}</Text>

            {/* Tracking Section */}
            {item.tracking_number ? (
                <TouchableOpacity style={styles.trackRow} onPress={() => handleTrack(item.tracking_number)}>
                    <MaterialCommunityIcons name="radar" size={20} color="#d4af37" />
                    <Text style={styles.trackText}>Seguimiento: {item.tracking_number}</Text>
                    <MaterialCommunityIcons name="open-in-new" size={16} color="#666" style={{ marginLeft: 5 }} />
                </TouchableOpacity>
            ) : (
                <Text style={styles.noTrack}>Sin número de seguimiento</Text>
            )}

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#d4af37', marginRight: 10 }]}
                    onPress={() => generateReceiptPDF(item)}
                >
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="#d4af37" />
                    <Text style={[styles.actionText, { color: '#d4af37' }]}>PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleFinishOrder(item)}
                >
                    <MaterialCommunityIcons name="check-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionText}>FINALIZAR</Text>
                </TouchableOpacity>
            </View>
        </View>
    ), []);

    const displayedOrders = orders.filter(o => 
        viewType === 'presupuestos' ? o.status === 'budget' : o.status !== 'budget'
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <View style={styles.header}>
                <Text style={styles.title}>GESTIÓN DE PEDIDOS</Text>
                {viewType === 'pedidos' && (
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => navigation.navigate('NewOrder')}
                    >
                        <MaterialCommunityIcons name="account-cash" size={20} color="#000" />
                        <Text style={styles.addBtnText}>NUEVO CLIENTE</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tabBtn, viewType === 'pedidos' && styles.tabBtnActive]}
                    onPress={() => setViewType('pedidos')}
                >
                    <Text style={[styles.tabText, viewType === 'pedidos' && styles.tabTextActive]}>📦 PEDIDOS A ENVIAR</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabBtn, viewType === 'presupuestos' && styles.tabBtnActive]}
                    onPress={() => setViewType('presupuestos')}
                >
                    <Text style={[styles.tabText, viewType === 'presupuestos' && styles.tabTextActive]}>📝 PRESUPUESTOS</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={displayedOrders}
                keyExtractor={item => item.id}
                renderItem={renderOrderItem}
                contentContainerStyle={{ padding: 20 }}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchOrders} tintColor="#d4af37" />}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <MaterialCommunityIcons name={viewType === 'presupuestos' ? "file-document-outline" : "package-variant-closed"} size={50} color="#333" />
                        <Text style={styles.emptyText}>
                            {viewType === 'presupuestos' ? 'No hay presupuestos pendientes.' : 'No hay pedidos por enviar.'}
                        </Text>
                    </View>
                }
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
            />
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    title: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: 1 },
    addBtn: { flexDirection: 'row', backgroundColor: '#d4af37', paddingHorizontal: 15, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
    addBtnText: { fontWeight: 'bold', marginLeft: 5 },

    tabContainer: { flexDirection: 'row', padding: 10, backgroundColor: '#0a0a0a', borderBottomWidth: 1, borderBottomColor: '#333', gap: 10 },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: '#333' },
    tabBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    tabText: { color: '#666', fontWeight: 'bold', fontSize: 12 },
    tabTextActive: { color: '#000' },

    card: { backgroundColor: '#1e1e1e', borderRadius: 12, padding: 20, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    orderId: { color: '#888', fontWeight: 'bold' },
    date: { color: '#666', fontSize: 12 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 5 },
    statusText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },

    clientName: { color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
    amount: { color: '#2ecc71', fontSize: 16, fontWeight: 'bold', marginBottom: 15 },

    trackRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', padding: 10, borderRadius: 8, marginBottom: 15, alignSelf: 'flex-start' },
    trackText: { color: '#d4af37', marginLeft: 10, fontWeight: '600' },
    noTrack: { color: '#444', fontStyle: 'italic', marginBottom: 15, fontSize: 12 },

    actions: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 15, alignItems: 'flex-end' },
    actionBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#27ae60', padding: 10, borderRadius: 8 },
    actionText: { color: '#fff', fontWeight: 'bold', marginLeft: 5, fontSize: 12 },

    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#666', marginTop: 10, fontSize: 16 }
});
