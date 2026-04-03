import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, RefreshControl, StatusBar, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function SalesScreen({ navigation }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ today: 0, month: 0, countToday: 0, commissions: 0 });
    const [recentSales, setRecentSales] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewType, setViewType] = useState('ventas'); // 'ventas' o 'presupuestos'

    const [expandedSale, setExpandedSale] = useState(null);
    const generateReceiptPDF = async (saleData) => {
        try {
            const subtotalBeforeDiscounts = saleData.sale_items.reduce((acc, item) => 
                acc + (Number(item.unit_price_at_sale) * item.quantity), 0);
            
            const manualDiscount = Number(saleData.manual_discount_amount || 0);
            const total = Number(saleData.total_amount || 0);
            const promoInfo = saleData.promotions ? `${saleData.promotions.title}` : null;
            
            // Calculate percentage if manual discount was percent-based (approximate from values if not stored separately)
            // But usually we have manual_discount_type. If it's percentage, we should show it.
            let discountLabel = "Descuento";
            if (manualDiscount > 0) {
                if (saleData.manual_discount_type === 'percent') {
                    // Calculate original subtotal if needed, but we have manual_discount_value or we can infer it
                    const pct = Math.round((manualDiscount / (subtotalBeforeDiscounts)) * 100);
                    discountLabel = `Descuento Especial (${pct}%)`;
                } else {
                    discountLabel = "Descuento Especial";
                }
            }

            const html = `
                <html>
                <body style="font-family: 'Helvetica', 'Arial', sans-serif; padding: 40px; color: #333;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #d4af37; margin: 0; font-size: 28px; letter-spacing: 2px;">DIGITAL BOOST EMPIRE</h1>
                        <p style="margin: 5px 0; color: #888; font-size: 14px;">Recibo de Venta Oficial</p>
                        <div style="width: 100%; height: 1px; background-color: #d4af37; margin-top: 15px;"></div>
                    </div>
                    
                    <div style="margin-bottom: 30px; font-size: 14px; line-height: 1.6;">
                        <p style="margin: 2px 0;"><strong>Fecha:</strong> ${new Date(saleData.created_at).toLocaleString()}</p>
                        <p style="margin: 2px 0;"><strong>Operación:</strong> #SC-${saleData.id.slice(0, 8).toUpperCase()}</p>
                        <p style="margin: 2px 0;"><strong>Cliente:</strong> ${saleData.clients?.name || 'Anónimo'}</p>
                    </div>

                    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                        <thead>
                            <tr style="border-bottom: 1px solid #333;">
                                <th style="text-align: left; padding: 10px; font-size: 14px; color: #000;">Producto</th>
                                <th style="text-align: center; padding: 10px; font-size: 14px; color: #000;">Cant</th>
                                <th style="text-align: right; padding: 10px; font-size: 14px; color: #000;">Precio</th>
                                <th style="text-align: right; padding: 10px; font-size: 14px; color: #000;">Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${saleData.sale_items.map(item => `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; font-size: 13px;">
                                        ${item.products?.name || 'Item'} ${item.color ? `<span style="color: #666; font-size: 12px;">(${item.color})</span>` : ''}
                                    </td>
                                    <td style="text-align: center; padding: 10px; font-size: 13px;">${item.quantity}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">$${Number(item.unit_price_at_sale).toFixed(0)}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">$${(Number(item.unit_price_at_sale) * item.quantity).toFixed(2)}</td>
                                </tr>
                            `).join('')}

                            ${promoInfo ? `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; font-size: 13px;">Promo: ${promoInfo}</td>
                                    <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px; color: #d4af37;">Descontado</td>
                                </tr>
                            ` : ''}

                            ${manualDiscount > 0 ? `
                                <tr style="border-bottom: 1px solid #eee;">
                                    <td style="padding: 10px; font-size: 13px;">${discountLabel}</td>
                                    <td style="text-align: center; padding: 10px; font-size: 13px;">1</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-$${manualDiscount.toFixed(0)}</td>
                                    <td style="text-align: right; padding: 10px; font-size: 13px;">-$${manualDiscount.toFixed(2)}</td>
                                </tr>
                            ` : ''}
                        </tbody>
                    </table>

                    <div style="text-align: right; margin-top: 10px; padding-top: 10px; border-top: 1px solid #d4af37;">
                        <p style="margin: 0; color: #888; font-size: 14px;">Subtotal: $${subtotalBeforeDiscounts.toFixed(2)}</p>
                        <h2 style="margin: 10px 0 0 0; color: #000; font-size: 22px;">TOTAL A PAGAR: $${total.toFixed(2)}</h2>
                    </div>
                    
                    <div style="margin-top: 60px; text-align: center; color: #bbb; font-size: 11px;">
                        <p>¡Gracias por elegir al Imperio!</p>
                        <p>Digital Boost Empire - Resultados Reales</p>
                    </div>
                </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html });
            await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: '.pdf', dialogTitle: 'Enviar Recibo' });
        } catch (err) {
            console.error('PDF Error:', err);
            Alert.alert('Error', 'No se pudo generar el PDF.');
        }
    };

    const fetchSalesData = async () => {
        setLoading(true);
        try {
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            // Logic:
            // 1. Fetch EVERYTHING that is 'budget' or 'pending' (regardless of date)
            // 2. Fetch 'completed/exitosa' ONLY for the current month
            const { data, error } = await supabase
                .from('sales')
                .select('*, profiles(full_name), clients(name), promotions(title), sale_items(*, products(name))')
                .or(`status.in.(budget,pending),and(status.in.(completed,exitosa,"",vended),created_at.gte.${startOfMonth})`)
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                processStats(data);
                setRecentSales(data);
            }
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    // Filtered sales based on search query and view type
    const filteredRecentSales = useMemo(() => {
        let list = [...recentSales];
        
        // Tab Filtering
        if (viewType === 'ventas') {
            list = list.filter(sale => {
                const status = (sale.status || '').toLowerCase();
                return status === 'completed' || status === 'exitosa' || status === '' || status === 'vended' || !status;
            });
        } else {
            list = list.filter(sale => {
                const status = (sale.status || '').toLowerCase();
                return status === 'budget' || status === 'pending';
            });
        }

        // Search Filtering
        if (!searchQuery.trim()) return list;
        const lowQuery = searchQuery.toLowerCase();
        return list.filter(sale => {
            const clientName = (sale.clients?.name || 'anónimo').toLowerCase();
            const saleIdShort = sale.id.slice(0, 4).toLowerCase();
            return clientName.includes(lowQuery) || saleIdShort.includes(lowQuery);
        });
    }, [searchQuery, recentSales, viewType]);

    const processStats = (sales) => {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

        let totalToday = 0;
        let totalMonth = 0;
        let count = 0;
        let totalCommissions = 0;

        sales.forEach(sale => {
            const status = (sale.status || '').toLowerCase();
            const isCompleted = status === 'completed' || status === 'exitosa' || status === '' || status === 'vended' || !status;

            if (!isCompleted) return; // Skip budgets and other non-finalized statuses for money stats

            const saleDate = new Date(sale.created_at).getTime();

            // Calculate total commissions globally
            if (sale.commission_amount) {
                totalCommissions += sale.commission_amount;
            }

            if (saleDate >= startOfMonth) {
                totalMonth += (sale.total_amount || 0);
            }
            if (saleDate >= startOfDay) {
                totalToday += (sale.total_amount || 0);
                count++;
            }
        });

        // Store commission in stats
        setStats({ today: totalToday, month: totalMonth, countToday: count, commissions: totalCommissions });
    };

    useFocusEffect(
        useCallback(() => {
            fetchSalesData();
        }, [])
    );

    const handleCancelSale = async (sale) => {
        const isBudget = sale.status === 'budget';
        const title = isBudget ? 'Anular Presupuesto' : 'Anular Venta';
        const message = isBudget
            ? '¿Estás seguro de que deseas anular este presupuesto? Se eliminará de la lista activa.'
            : '¿Deseas anular esta operación? Ten en cuenta que esto no devolverá el stock automáticamente si ya fue descontado.';

        Alert.alert(
            title,
            message,
            [
                { text: 'No, mantener', style: 'cancel' },
                {
                    text: 'SÍ, ANULAR',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            const { error } = await supabase
                                .from('sales')
                                .update({ status: 'cancelled' })
                                .eq('id', sale.id);

                            if (error) throw error;

                            Alert.alert('✅ Anulado', 'La operación ha sido anulada con éxito.');
                            fetchSalesData();
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'No se pudo anular la operación.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const handleConvertToSale = async (sale) => {
        Alert.alert(
            'Confirmar Venta',
            '¿Deseas convertir este presupuesto en una venta real? Esto descontará los productos del inventario.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'SÍ, CONVERTIR',
                    onPress: async () => {
                        setLoading(true);
                        try {
                            // 1. Fetch items
                            const { data: items, error: itemsError } = await supabase
                                .from('sale_items')
                                .select('product_id, quantity, products(current_stock)')
                                .eq('sale_id', sale.id);

                            if (itemsError) throw itemsError;

                            // 2. Update status and timestamp to now
                            const { error: updateError } = await supabase
                                .from('sales')
                                .update({
                                    status: 'completed',
                                    created_at: new Date().toISOString()
                                })
                                .eq('id', sale.id);

                            if (updateError) throw updateError;

                            // 3. Update stock (Try-catch for non-critical failure)
                            try {
                                for (const item of items) {
                                    const currentStock = item.products?.current_stock || 0;
                                    const newStock = currentStock - item.quantity;
                                    await supabase
                                        .from('products')
                                        .update({ current_stock: newStock })
                                        .eq('id', item.product_id);
                                }
                            } catch (stockError) {
                                console.error('Stock Update Error during conversion:', stockError);
                                Alert.alert('Aviso', 'Venta confirmada, pero hubo un error actualizando el inventario.');
                            }

                            Alert.alert('✅ Convertido', 'Venta finalizada con éxito.');
                            fetchSalesData();
                        } catch (err) {
                            console.error(err);
                            Alert.alert('Error', 'No se pudo completar la operación.');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderSaleItem = ({ item }) => {
        const isBudget = item.status === 'budget';
        const isPending = item.status === 'pending';
        const isExpanded = expandedSale === item.id;

        return (
            <TouchableOpacity
                style={[styles.saleItem, (isBudget || isPending) && styles.saleItemPending, isExpanded && styles.saleItemExpanded]}
                onPress={() => setExpandedSale(isExpanded ? null : item.id)}
                activeOpacity={0.8}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View style={{ flex: 1 }}>
                        <View style={styles.saleHeader}>
                            <Text style={styles.saleId}>Venta #{item.id.slice(0, 4)}</Text>
                            {isBudget && <View style={styles.budgetBadge}><Text style={styles.budgetText}>PRESUPUESTO</Text></View>}
                            {isPending && <View style={[styles.budgetBadge, { backgroundColor: '#ff4444' }]}><Text style={styles.budgetText}>DEUDA</Text></View>}
                        </View>
                        <Text style={styles.saleDate}>{new Date(item.created_at).toLocaleDateString()} - {new Date(item.created_at).toLocaleTimeString()}</Text>

                        <Text style={styles.clientName}>
                            Cliente: {item.clients ? item.clients.name : 'Anónimo'}
                        </Text>

                        {item.profiles && <Text style={styles.sellerName}>Por: {item.profiles.full_name}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.saleAmount, isBudget && { color: '#e67e22' }]}>${item.total_amount}</Text>
                        {!isBudget && <Text style={styles.saleProfit}>(G: ${item.profit_generated})</Text>}
                        
                        <TouchableOpacity 
                            onPress={() => generateReceiptPDF(item)}
                            style={{ marginTop: 8, padding: 8, backgroundColor: '#000', borderRadius: 8, borderWidth: 1, borderColor: '#d4af37' }}
                        >
                            <MaterialCommunityIcons name="file-pdf-box" size={24} color="#d4af37" />
                        </TouchableOpacity>

                        <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color="#555" style={{ marginTop: 5 }} />
                    </View>
                </View>

                {isExpanded && (
                    <View style={styles.itemsDetail}>
                        {item.sale_items?.map((detail, idx) => (
                            <View key={idx} style={styles.detailRow}>
                                <Text style={styles.detailText} numberOfLines={1}>{detail.products?.name || 'Item'} {detail.color ? `(${detail.color})` : ''}</Text>
                                <Text style={styles.detailQty}>x{detail.quantity}</Text>
                                <Text style={styles.detailPrice}>${detail.unit_price_at_sale}</Text>
                            </View>
                        ))}
                        
                        {/* Breakdown in UI */}
                        <View style={{ borderTopWidth: 1, borderTopColor: '#333', marginTop: 10, paddingTop: 10 }}>
                            {item.promotions && (
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailText, { color: '#d4af37' }]}>Promo: {item.promotions.title}</Text>
                                    <Text style={styles.detailPrice}>Aplicada</Text>
                                </View>
                            )}
                            {item.manual_discount_amount > 0 && (
                                <View style={styles.detailRow}>
                                    <Text style={[styles.detailText, { color: '#e74c3c' }]}>Descuento Manual</Text>
                                    <Text style={styles.detailPrice}>-${item.manual_discount_amount}</Text>
                                </View>
                            )}
                        </View>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 15 }}>
                            {isBudget && (
                                <TouchableOpacity
                                    style={styles.convertBtn}
                                    onPress={() => handleConvertToSale(item)}
                                    disabled={loading}
                                >
                                    <MaterialCommunityIcons name="check-decagram" size={14} color="#000" />
                                    <Text style={styles.convertBtnText}>COBRAR AHORA</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={[styles.convertBtn, { backgroundColor: '#1a1a1a', borderWidth: 1, borderColor: '#d4af37' }]}
                                onPress={() => generateReceiptPDF(item)}
                                disabled={loading}
                            >
                                <MaterialCommunityIcons name="file-pdf-box" size={14} color="#d4af37" />
                                <Text style={[styles.convertBtnText, { color: '#d4af37' }]}>DESCARGAR PDF</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.convertBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#ff4444' }]}
                                onPress={() => handleCancelSale(item)}
                                disabled={loading}
                            >
                                <MaterialCommunityIcons name="delete-outline" size={14} color="#ff4444" />
                                <Text style={[styles.convertBtnText, { color: '#ff4444' }]}>ANULAR</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            {/* Cards Header */}
            <View style={styles.statsContainer}>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Vendido Hoy ({stats.countToday})</Text>
                    <Text style={styles.statValue}>${stats.today.toFixed(2)}</Text>
                </View>
                <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Este Mes</Text>
                    <Text style={styles.statValue}>${stats.month.toFixed(2)}</Text>
                </View>
            </View>

            {/* COMMISSION CARD */}
            <TouchableOpacity
                style={[styles.commissionCard]}
                activeOpacity={0.9}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={styles.goldIcon}>
                        <Text style={{ fontSize: 20 }}>🤝</Text>
                    </View>
                    <View>
                        <Text style={styles.commissionLabel}>COMISIONES A PAGAR</Text>
                        <Text style={styles.commissionValue}>${stats.commissions ? stats.commissions.toFixed(2) : '0.00'}</Text>
                    </View>
                </View>
            </TouchableOpacity>

            <View style={styles.btnRow}>
                {/* Visualizar Históricos */}
                <TouchableOpacity
                    style={styles.historyBtn}
                    onPress={() => navigation.navigate('Reports')}
                >
                    <Text style={styles.historyBtnText}>📅 Ver Cierres Diarios</Text>
                </TouchableOpacity>
            </View>

            {/* SEARCH BAR */}
            <View style={styles.searchContainer}>
                <MaterialCommunityIcons name="magnify" size={20} color="#666" style={{ marginLeft: 10 }} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar por cliente o ID..."
                    placeholderTextColor="#666"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery !== '' && (
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <MaterialCommunityIcons name="close-circle" size={18} color="#666" style={{ marginRight: 10 }} />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.tabContainer}>
                <TouchableOpacity 
                    style={[styles.tabBtn, viewType === 'ventas' && styles.tabBtnActive]}
                    onPress={() => setViewType('ventas')}
                >
                    <Text style={[styles.tabText, viewType === 'ventas' && styles.tabTextActive]}>💰 VENTAS FINALIZADAS</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                    style={[styles.tabBtn, viewType === 'presupuestos' && styles.tabBtnActive]}
                    onPress={() => setViewType('presupuestos')}
                >
                    <Text style={[styles.tabText, viewType === 'presupuestos' && styles.tabTextActive]}>📝 PRESUPUESTOS</Text>
                    {recentSales.filter(s => s.status === 'budget' || s.status === 'pending').length > 0 && (
                        <View style={styles.badgeCount}>
                            <Text style={styles.badgeText}>{recentSales.filter(s => s.status === 'budget' || s.status === 'pending').length}</Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>
                {viewType === 'ventas' ? 'HISTORIAL DE VENTAS' : 'PENDIENTES DE CIERRE'} ({filteredRecentSales.length})
            </Text>

            <FlatList
                data={filteredRecentSales}
                keyExtractor={item => item.id}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
                removeClippedSubviews={true}
                renderItem={renderSaleItem}
                contentContainerStyle={styles.list}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchSalesData} />}
                ListEmptyComponent={<Text style={styles.empty}>No hay ventas registradas.</Text>}
            />
        </SafeAreaView>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },

    // Stats Cards
    statsContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
    statCard: { width: '48%', padding: 20, borderRadius: 15, elevation: 3, borderWidth: 1, borderColor: '#333', backgroundColor: '#1e1e1e' },
    statLabel: { color: '#888', fontSize: 12, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
    statValue: { color: '#d4af37', fontSize: 24, fontWeight: '900', marginTop: 5 }, // Gold text

    // Commission Card (Gold Highlight)
    commissionCard: {
        backgroundColor: '#1a1a1a',
        padding: 20,
        borderRadius: 15,
        marginBottom: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#d4af37', // Gold Border
        shadowColor: '#d4af37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 5
    },
    goldIcon: { marginRight: 15, backgroundColor: 'rgba(212, 175, 55, 0.1)', padding: 12, borderRadius: 30 },
    commissionLabel: { color: '#d4af37', fontSize: 12, fontWeight: '900', letterSpacing: 2 },
    commissionValue: { color: 'white', fontSize: 28, fontWeight: 'bold' },

    // Buttons
    btnRow: { marginBottom: 25 },
    historyBtn: { backgroundColor: '#222', padding: 15, borderRadius: 10, alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#444' },
    historyBtnText: { color: '#ccc', fontWeight: 'bold', letterSpacing: 0.5 },
    newSaleBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 10, alignItems: 'center', shadowColor: '#d4af37', shadowOpacity: 0.3, elevation: 10 },
    newSaleText: { color: '#000', fontWeight: '900', fontSize: 18, letterSpacing: 1 },

    // List & Items
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#666', marginBottom: 15, letterSpacing: 1, textTransform: 'uppercase' },
    list: { paddingBottom: 20 },
    saleItem: { backgroundColor: '#1e1e1e', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
    saleItemExpanded: { borderColor: '#d4af37' },
    saleId: { fontWeight: 'bold', color: '#fff' },
    saleDate: { fontSize: 12, color: '#666' },
    clientName: { fontSize: 13, fontWeight: '600', color: '#a29bfe', marginTop: 2 },
    sellerName: { fontSize: 12, color: '#ccc', marginTop: 2 },
    saleAmount: { fontSize: 16, fontWeight: 'bold', color: '#2ecc71' }, // Green for positives stays good
    saleProfit: { fontSize: 10, color: '#888' },

    // Details styles
    itemsDetail: { marginTop: 15, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#333' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    detailText: { color: '#ccc', fontSize: 12, flex: 2 },
    detailQty: { color: '#fff', fontSize: 12, flex: 0.5, textAlign: 'center', fontWeight: 'bold' },
    detailPrice: { color: '#fff', fontSize: 12, flex: 1, textAlign: 'right' },

    empty: { textAlign: 'center', marginTop: 50, color: '#444', fontStyle: 'italic' },

    // New styles for budget conversion
    saleHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    budgetBadge: { backgroundColor: '#e67e22', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
    budgetText: { color: '#000', fontSize: 8, fontWeight: 'bold' },
    saleItemPending: { borderColor: '#444', borderStyle: 'dashed' },
    convertBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#d4af37',
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 10,
        gap: 5
    },
    convertBtnText: { color: '#000', fontSize: 10, fontWeight: '900' },

    // Search Styles
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 12,
        marginHorizontal: 0,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#333'
    },
    searchInput: {
        flex: 1,
        color: '#fff',
        paddingVertical: 12,
        paddingHorizontal: 10,
        fontSize: 14
    },

    // Tab Styles
    tabContainer: { flexDirection: 'row', paddingHorizontal: 0, paddingVertical: 10, backgroundColor: 'transparent', marginBottom: 10, gap: 10 },
    tabBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#333', position: 'relative' },
    tabBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    tabText: { color: '#666', fontWeight: 'bold', fontSize: 11 },
    tabTextActive: { color: '#000' },
    badgeCount: { position: 'absolute', top: -5, right: -5, backgroundColor: '#ff4444', height: 18, minWidth: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4 },
    badgeText: { color: '#fff', fontSize: 10, fontWeight: '900' }
});
