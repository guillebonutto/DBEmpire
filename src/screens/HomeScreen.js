import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Dimensions, ActivityIndicator, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { supabase } from '../services/supabase';
import { useFocusEffect } from '@react-navigation/native';
import { NotificationService } from '../services/notificationService';
import { SyncService } from '../services/syncService';
import NetInfo from '@react-native-community/netinfo';
import { DeviceAuthService } from '../services/deviceAuth';
import { CRMService } from '../services/crmService';
import { GeminiService } from '../services/geminiService';
import { Linking } from 'react-native';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const [userRole, setUserRole] = useState('seller');
    const [stats, setStats] = useState({
        todaySales: 0,
        todayNetProfit: 0,
        monthCommissions: 0,
        monthSales: 0,
        budgetSales: 0,
        commissionRate: 0,
        lowStockCount: 0,
        lowStockProducts: []
    });
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingMission, setGeneratingMission] = useState(null);
    const [aiModalVisible, setAiModalVisible] = useState(false);

    // Camera State
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem('user_role').then(role => {
            if (role) setUserRole(role);
        });
        NotificationService.requestPermissions();

        // Initial sync attempt
        SyncService.syncPending();

        // Listen for reconnect
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected) {
                SyncService.syncPending().then(success => {
                    if (success) {
                        fetchDashboardStats(); // Refresh stats after sync
                    }
                });
            }
        });

        return () => unsubscribe();
    }, []);

    const fetchDashboardStats = async () => {
        setLoading(true);
        try {
            // Get role directly to avoid race conditions with state
            const currentRole = await AsyncStorage.getItem('user_role') || 'seller';

            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

            const deviceSig = await DeviceAuthService.getDeviceSignature();

            // Fetch Daily Sales (for Admin)
            const { data: dailySalesData } = await supabase
                .from('sales')
                .select('total_amount, profit_generated, commission_amount, status')
                .gte('created_at', startOfDay);

            // Fetch Monthly Sales (for Seller Filter)
            let monthlyQuery = supabase
                .from('sales')
                .select('total_amount, commission_amount, status, device_sig')
                .gte('created_at', startOfMonth);

            if (currentRole === 'seller' && deviceSig) {
                monthlyQuery = monthlyQuery.eq('device_sig', deviceSig);
            }
            const { data: monthlySalesData } = await monthlyQuery;

            // Calculate Today's Stats
            let todaySales = 0;
            let todayGrossProfit = 0;
            let todayCommissionsTotal = 0;
            if (dailySalesData) {
                dailySalesData.forEach(s => {
                    const status = (s.status || '').toLowerCase();
                    if (status === 'completed' || status === 'exitosa' || status === '' || status === 'vended') {
                        todaySales += (s.total_amount || 0);
                        todayGrossProfit += (s.profit_generated || 0);
                        todayCommissionsTotal += (s.commission_amount || 0);
                    }
                });
            }

            // Calculate Seller's Monthly Stats
            let monthSales = 0;
            let monthCommissions = 0;
            if (monthlySalesData) {
                monthlySalesData.forEach(s => {
                    const status = (s.status || '').toLowerCase();
                    if (status === 'completed' || status === 'exitosa' || status === '' || status === 'vended') {
                        monthSales += (s.total_amount || 0);
                        monthCommissions += (s.commission_amount || 0);
                    }
                });
            }

            // Fetch Expenses (Today)
            const { data: expenses } = await supabase.from('expenses').select('amount').gte('created_at', startOfDay);
            const todayExpenses = expenses ? expenses.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) : 0;

            const { data: budgets } = await supabase.from('sales').select('total_amount').eq('status', 'budget');
            const { data: lowStock } = await supabase.from('products').select('id, name, current_stock').eq('active', true).lte('current_stock', 5);

            // Fetch Commission Rate for display
            const { data: settings } = await supabase.from('settings').select('value').eq('key', 'commission_rate').single();
            const rate = settings ? parseFloat(settings.value) * 100 : 0;

            setStats({
                todaySales,
                todayNetProfit: todayGrossProfit - todayCommissionsTotal - todayExpenses,
                monthSales,
                monthCommissions,
                budgetSales: budgets ? budgets.reduce((acc, s) => acc + (s.total_amount || 0), 0) : 0,
                commissionRate: rate,
                lowStockCount: lowStock ? lowStock.length : 0,
                lowStockProducts: lowStock || []
            });

            // --- MISSION GENERATION (Only for Sellers) ---
            if (currentRole === 'seller') {
                const dailyMissions = [];

                // 1. Client Recovery Mission
                const inactive = await CRMService.getInactiveClients(20);
                if (inactive && inactive.length > 0) {
                    const target = inactive[0];
                    dailyMissions.push({
                        id: 'recovery',
                        title: 'CAZADOR DE VENTAS',
                        desc: `Contactar a ${target.name} (Sin compras hace 20 días)`,
                        icon: 'account-clock',
                        color: '#ff7675',
                        target: target,
                        type: 'crm'
                    });
                }

                // 2. Content Mission
                const { data: randomProduct } = await supabase.from('products').select('name').eq('active', true).limit(1).single();
                if (randomProduct) {
                    dailyMissions.push({
                        id: 'content',
                        title: 'EL GUIONISTA',
                        desc: `Generar guion para vender: ${randomProduct.name}`,
                        icon: 'movie-edit',
                        color: '#74b9ff',
                        target: randomProduct,
                        type: 'creative'
                    });
                }

                // 3. Goal Mission
                dailyMissions.push({
                    id: 'goal',
                    title: 'META DEL DÍA',
                    desc: monthSales > 0 ? '¡Sigue así! Supera tu récord hoy.' : '¡Hoy es el día! Logra tu primera venta.',
                    icon: 'trophy-award',
                    color: '#fdcb6e',
                    type: 'info'
                });

                setMissions(dailyMissions);
            }
        } catch (error) {
            console.log('Stats error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAICounsel = () => {
        if (loading) return "Analizando panorama imperial...";
        if (userRole === 'admin') {
            if (stats.lowStockCount > 3) return "⚠️ Hay productos críticos sin reposición. El Imperio pierde ventas.";
            if (stats.budgetSales > 0) return `💡 Tienes $${stats.budgetSales} en presupuestos por cerrar.`;
            return "Las finanzas están estables. Es momento de expandir.";
        } else {
            if (missions.length > 0) return `⚔️ Tienes ${missions.length} misiones pendientes. Conquista el mercado hoy.`;
            return "Buen trabajo, Aliado. Sigue alimentando el catálogo.";
        }
    };

    const handleMissionAction = async (mission) => {
        if (mission.type === 'crm') {
            setGeneratingMission(mission.id);
            try {
                const prompt = `Genera un mensaje de WhatsApp corto y profesional para recuperar a un cliente llamado ${mission.target.name} que no ha comprado en 20 días. El tono debe ser entusiasta y mencionar que tenemos novedades. Solo devuelve el texto.`;
                const message = await GeminiService.handleGeneralRequest(prompt);
                const url = `whatsapp://send?phone=${mission.target.phone}&text=${encodeURIComponent(message)}`;
                Linking.openURL(url);
            } catch (e) { Alert.alert('Error IA', 'No se pudo generar el mensaje'); }
            finally { setGeneratingMission(null); }
        } else if (mission.type === 'creative') {
            setGeneratingMission(mission.id);
            try {
                const prompt = `Genera un GUION corto para un video de 15 segundos vendiendo el producto: ${mission.target.name}. 
                Estructura: 
                1. Gancho (Hook).
                2. Beneficio clave.
                3. Llamado a la acción (CTA).
                Usa un tono viral. Devuelve texto plano sin markdown.`;
                const script = await GeminiService.handleGeneralRequest(prompt);

                Alert.alert(
                    '🎬 Guion Generado',
                    script,
                    [
                        { text: 'OK' },
                        {
                            text: 'ENVIAR A MI PC (WA)',
                            onPress: () => Linking.openURL(`whatsapp://send?text=${encodeURIComponent("🚀 GUION PARA MI PC:\n\n" + script)}`)
                        }
                    ]
                );
            } catch (e) { Alert.alert('Error IA', 'No se pudo generar el guion'); }
            finally { setGeneratingMission(null); }
        }
    };

    useFocusEffect(useCallback(() => { fetchDashboardStats(); }, []));

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned) return;

        let barcodeData = data;
        // SMART QR HANDLE
        if (data.includes('linktr.ee/digital_boost_empire')) {
            const parts = data.split('barcode=');
            if (parts.length > 1) barcodeData = parts[1];
        }

        setScanned(true);
        setIsScanning(false);
        try {
            const { data: product } = await supabase.from('products').select('*').eq('barcode', barcodeData).single();
            if (product) {
                navigation.navigate('NewSale', { preselectedProduct: product });
            } else {
                navigation.navigate('AddProduct', { scannedBarcode: barcodeData });
            }
        } catch (err) {
            navigation.navigate('AddProduct', { scannedBarcode: barcodeData });
        } finally {
            setScanned(false);
        }
    };

    const MinimalModule = ({ title, icon, color, isNew, onPress }) => (
        <TouchableOpacity style={styles.miniCard} onPress={onPress} activeOpacity={0.7}>
            <View style={[styles.miniIcon, { backgroundColor: color + '15', borderColor: color + '40' }]}>
                <MaterialCommunityIcons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.miniTitle}>{title}</Text>
            {isNew && <View style={styles.miniBadge} />}
        </TouchableOpacity>
    );

    const renderAIModal = () => (
        <Modal
            visible={aiModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setAiModalVisible(false)}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <MaterialCommunityIcons name="robot-happy" size={32} color="#d4af37" />
                        <Text style={styles.modalTitle}>EMPIRE AI COACH</Text>
                        <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                            <MaterialCommunityIcons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.modalBody}>
                        <View style={styles.aiAdviceBox}>
                            <Text style={styles.aiAdviceText}>{getAICounsel()}</Text>
                        </View>

                        {stats.lowStockProducts.length > 0 && (
                            <View style={styles.restockSection}>
                                <Text style={styles.sectionSub}>PRODUCTOS A REPONER:</Text>
                                {stats.lowStockProducts.map((item, index) => (
                                    <View key={item.id} style={styles.restockItem}>
                                        <View style={styles.restockInfo}>
                                            <Text style={styles.restockName}>{item.name}</Text>
                                            <Text style={styles.restockStock}>Stock actual: {item.current_stock}</Text>
                                        </View>
                                        <TouchableOpacity
                                            style={styles.orderBtn}
                                            onPress={() => {
                                                setAiModalVisible(false);
                                                navigation.navigate('NewSupplierOrder', { preselectedProduct: item });
                                            }}
                                        >
                                            <Text style={styles.orderBtnText}>PEDIR</Text>
                                        </TouchableOpacity>
                                    </View>
                                ))}
                            </View>
                        )}

                        {stats.budgetSales > 0 && (
                            <View style={styles.opportunityBox}>
                                <MaterialCommunityIcons name="lightbulb-on" size={20} color="#f1c40f" />
                                <Text style={styles.opportunityText}>
                                    Tienes ${stats.budgetSales} en presupuestos. ¡Es hora de cerrar esas ventas!
                                </Text>
                            </View>
                        )}
                    </ScrollView>

                    <TouchableOpacity
                        style={styles.closeModalBtn}
                        onPress={() => setAiModalVisible(false)}
                    >
                        <Text style={styles.closeModalBtnText}>ENTENDIDO</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    if (isScanning) {
        return (
            <View style={styles.scannerFull}>
                <CameraView style={StyleSheet.absoluteFillObject} onBarcodeScanned={scanned ? undefined : handleBarcodeScanned} />
                <TouchableOpacity style={styles.closeBtn} onPress={() => setIsScanning(false)}>
                    <MaterialCommunityIcons name="close-circle" size={50} color="#fff" />
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#121212']} style={styles.background} />
            {renderAIModal()}

            <SafeAreaView style={styles.safe}>
                <View style={styles.header}>
                    <View>
                        <Text style={styles.brandName}>EMPIRE 👑</Text>
                        <Text style={styles.headerRole}>{userRole === 'admin' ? 'Líder Supremo' : 'Aliado'}</Text>
                    </View>
                    <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('user_role'); navigation.replace('Login', { fromLogout: true }); }}>
                        <MaterialCommunityIcons name="logout-variant" size={24} color="#d4af37" />
                    </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Minimal Insight */}
                    <View style={styles.insightBox}>
                        <LinearGradient colors={['rgba(212,175,55,0.1)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.insightGrad} />
                        <MaterialCommunityIcons name="lightning-bolt" size={18} color="#d4af37" />
                        <Text style={styles.insightText}>{getAICounsel()}</Text>
                    </View>

                    {/* Stats Bricks Clean - ADMIN ONLY */}
                    {userRole === 'admin' ? (
                        <View style={styles.statsGrid}>
                            <View style={styles.statBrick}>
                                <Text style={styles.statLab}>Ventas Hoy</Text>
                                <Text style={styles.statVal}>${stats.todaySales}</Text>
                            </View>
                            <View style={styles.statBrick}>
                                <Text style={styles.statLab}>Balance Neto</Text>
                                <Text style={[styles.statVal, { color: stats.todayNetProfit >= 0 ? '#00ff88' : '#ff4444' }]}>
                                    ${stats.todayNetProfit}
                                </Text>
                            </View>
                        </View>
                    ) : (
                        /* PREMIUM COMMISSION BOX - SELLER ONLY */
                        <View style={styles.commissionContainer}>
                            <LinearGradient
                                colors={['#d4af3720', '#d4af3705']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.commissionBox}
                            >
                                <View style={styles.commissionHeader}>
                                    <MaterialCommunityIcons name="star-circle" size={20} color="#d4af37" />
                                    <Text style={styles.commissionLab}>MI COMISIÓN ACUMULADA (MES)</Text>
                                </View>
                                <Text style={styles.commissionVal}>${stats.monthCommissions.toFixed(2)}</Text>
                                <Text style={styles.commissionSub}>Comisión del {stats.commissionRate}% sobre tus ventas directas</Text>
                            </LinearGradient>
                        </View>
                    )}

                    {/* DAILY MISSIONS - SELLER ONLY */}
                    {userRole === 'seller' && missions.length > 0 && (
                        <View style={styles.missionsSection}>
                            <Text style={styles.sectionLabel}>MISIONES DEL DÍA ⚔️</Text>
                            {missions.map(m => (
                                <TouchableOpacity
                                    key={m.id}
                                    style={styles.missionCard}
                                    onPress={() => handleMissionAction(m)}
                                >
                                    <View style={[styles.missionIcon, { backgroundColor: m.color + '20' }]}>
                                        <MaterialCommunityIcons name={m.icon} size={22} color={m.color} />
                                    </View>
                                    <View style={styles.missionInfo}>
                                        <Text style={styles.missionTitle}>{m.title}</Text>
                                        <Text style={styles.missionDesc}>{m.desc}</Text>
                                    </View>
                                    {generatingMission === m.id ? (
                                        <ActivityIndicator color={m.color} />
                                    ) : (
                                        m.type !== 'info' && <MaterialCommunityIcons name="chevron-right" size={20} color="#333" />
                                    )}
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Minimalist Grid of Actions */}
                    <Text style={styles.sectionLabel}>MÓDULOS DEL IMPERIO</Text>
                    <View style={styles.actionGrid}>
                        {userRole === 'admin' && <MinimalModule title="Plan IA" icon="robot-happy" color="#3498db" isNew onPress={() => setAiModalVisible(true)} />}
                        <MinimalModule title="Catálogo" icon="cellphone-link" color="#00ff88" onPress={() => navigation.navigate('Catalog')} />
                        <MinimalModule title="Assets" icon="video-plus" color="#a29bfe" onPress={() => navigation.navigate('Assets')} />
                        <MinimalModule title="Clientes" icon="account-group" color="#9b59b6" onPress={() => navigation.navigate('Clients')} />
                        <MinimalModule title="Inventario" icon="package-variant-closed" color="#e67e22" onPress={() => navigation.navigate('Inventario')} />
                        {userRole === 'admin' && (
                            <>
                                <MinimalModule title="Historial" icon="history" color="#bdc3c7" onPress={() => navigation.navigate('Sales')} />
                                <MinimalModule title="Reportes" icon="chart-bar" color="#f1c40f" onPress={() => navigation.navigate('Reports')} />
                            </>
                        )}
                        <MinimalModule title="Presupuesto" icon="file-document-edit" color="#e67e22" onPress={() => navigation.navigate('NewSale', { mode: 'quote' })} />
                    </View>

                    {/* Primary Action: Minimalist Giant Scanner */}
                    <View style={styles.scannerCenter}>
                        <TouchableOpacity style={styles.scannerTap} onPress={() => setIsScanning(true)}>
                            <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.scannerCircle}>
                                <MaterialCommunityIcons name="barcode-scan" size={45} color="#000" />
                                <Text style={styles.scannerLabel}>ESCANEAR PRODUCTO</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    background: { ...StyleSheet.absoluteFillObject },
    safe: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 20 },
    brandName: { color: '#d4af37', fontSize: 22, fontWeight: '900', letterSpacing: 2 },
    headerRole: { color: '#666', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

    scroll: { paddingBottom: 120 },

    insightBox: { marginHorizontal: 25, flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#1a1a1a', overflow: 'hidden' },
    insightGrad: { ...StyleSheet.absoluteFillObject },
    insightText: { color: '#bbb', fontSize: 13, fontWeight: '600', marginLeft: 10 },

    statsGrid: { flexDirection: 'row', gap: 12, paddingHorizontal: 25, marginTop: 20 },
    statBrick: { flex: 1, backgroundColor: '#0a0a0a', padding: 18, borderRadius: 15, borderWidth: 1, borderColor: '#1a1a1a' },
    statLab: { color: '#555', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
    statVal: { color: '#fff', fontSize: 24, fontWeight: '900', marginTop: 8 },

    missionsSection: { marginTop: 25, paddingHorizontal: 25 },
    missionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0a0a0a', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#1a1a1a' },
    missionIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    missionInfo: { flex: 1, marginLeft: 15 },
    missionTitle: { color: '#888', fontSize: 9, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
    missionDesc: { color: '#eee', fontSize: 13, fontWeight: '700' },

    commissionContainer: { paddingHorizontal: 25, marginTop: 20 },
    commissionBox: { padding: 25, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', alignItems: 'center' },
    commissionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
    commissionLab: { color: '#d4af37', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    commissionVal: { color: '#fff', fontSize: 36, fontWeight: '900', textShadowColor: 'rgba(212,175,55,0.5)', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 },
    commissionSub: { color: '#666', fontSize: 12, fontWeight: '600', marginTop: 15, textAlign: 'center' },

    sectionLabel: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15, paddingHorizontal: 25, marginTop: 20 },

    actionGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 20, gap: 10 },
    miniCard: { width: (width - 60) / 3, backgroundColor: '#0a0a0a', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#1a1a1a' },
    miniIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, marginBottom: 10 },
    miniTitle: { color: '#888', fontSize: 10, fontWeight: '800' },
    miniBadge: { position: 'absolute', top: 10, right: 10, width: 6, height: 6, borderRadius: 3, backgroundColor: '#d4af37' },

    scannerCenter: { alignItems: 'center', marginTop: 40 },
    scannerTap: { width: 180, height: 180, borderRadius: 90, elevation: 20, shadowColor: '#d4af37', shadowOpacity: 0.3, shadowRadius: 20 },
    scannerCircle: { flex: 1, borderRadius: 90, justifyContent: 'center', alignItems: 'center', padding: 20 },
    scannerLabel: { color: '#000', fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 10, letterSpacing: 1 },

    scannerFull: { flex: 1, backgroundColor: '#000' },
    closeBtn: { position: 'absolute', top: 50, right: 30 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '80%', borderTopWidth: 1, borderTopColor: '#333' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 25 },
    modalTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    modalBody: { marginBottom: 20 },
    aiAdviceBox: { backgroundColor: '#1a1a1a', padding: 20, borderRadius: 15, marginBottom: 25, borderWidth: 1, borderColor: '#333' },
    aiAdviceText: { color: '#fff', fontSize: 16, lineHeight: 24, fontWeight: '600' },

    restockSection: { marginBottom: 20 },
    sectionSub: { color: '#666', fontSize: 12, fontWeight: '900', marginBottom: 15, letterSpacing: 1 },
    restockItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0a0a0a', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#222' },
    restockInfo: { flex: 1 },
    restockName: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    restockStock: { color: '#e74c3c', fontSize: 12, marginTop: 2 },
    orderBtn: { backgroundColor: '#d4af37', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
    orderBtnText: { color: '#000', fontSize: 12, fontWeight: '900' },

    opportunityBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f1c40f15', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#f1c40f30' },
    opportunityText: { color: '#f1c40f', fontSize: 13, fontWeight: '600', flex: 1 },

    closeModalBtn: { backgroundColor: '#333', padding: 18, borderRadius: 15, alignItems: 'center' },
    closeModalBtnText: { color: '#fff', fontWeight: '900', fontSize: 16, letterSpacing: 1 }
});
