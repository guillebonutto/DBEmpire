import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Dimensions, ActivityIndicator, Modal, TextInput, Platform } from 'react-native';
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
import { SecurityService } from '../services/securityService';
import { EmpireAIService } from '../services/empireAIService';
import { Linking } from 'react-native';

const { width } = Dimensions.get('window');

const renderMarkdownText = (text) => {
    if (!text) return null;
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <Text key={index} style={{ fontWeight: '900', color: '#d4af37' }}>{part.slice(2, -2)}</Text>;
        }
        return <Text key={index}>{part}</Text>;
    });
};

const MinimalModule = React.memo(({ title, icon, color, isNew, onPress, fullWidth }) => (
    <TouchableOpacity style={[styles.miniCard, fullWidth && styles.fullWidthCard]} onPress={onPress} activeOpacity={0.7}>
        <View style={[styles.miniIcon, { backgroundColor: color + '15', borderColor: color + '40' }]}>
            <MaterialCommunityIcons name={icon} size={24} color={color} />
        </View>
        <Text style={styles.miniTitle}>{title}</Text>
        {isNew && <View style={styles.miniBadge} />}
    </TouchableOpacity>
));

export default function HomeScreen({ navigation }) {
    const [userRole, setUserRole] = useState('seller');
    const [stats, setStats] = useState({
        todaySales: 0,
        todayNetProfit: 0,
        totalCommissions: 0,
        monthCommissions: 0,
        totalSales: 0,
        budgetSales: 0,
        commissionRate: 0,
        lowStockCount: 0,
        lowStockProducts: []
    });
    const [missions, setMissions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [generatingMission, setGeneratingMission] = useState(null);
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [aiAdvice, setAiAdvice] = useState(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [simulatorQuery, setSimulatorQuery] = useState('');

    // Camera State
    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        const init = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role) setUserRole(role);
            NotificationService.requestPermissions();
            SyncService.syncPending();
        };
        init();

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

        // Pre-request camera permissions to speed up opening
        requestPermission();

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
            const startOfLastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

            // Parallel fetch for basic stats
            const [
                { data: dailySalesData },
                { data: monthlySalesData },
                { data: expensesData },
                { data: budgetsData },
                { data: lowStockData },
                { data: settingsData },
                { data: recentRestocks }
            ] = await Promise.all([
                supabase.from('sales').select('total_amount, profit_generated, commission_amount, status').gte('created_at', startOfDay),
                (currentRole === 'seller' && deviceSig)
                    ? supabase.from('sales').select('total_amount, commission_amount, status, device_sig, created_at').eq('device_sig', deviceSig)
                    : supabase.from('sales').select('total_amount, commission_amount, status, device_sig, created_at'),
                supabase.from('expenses').select('amount').gte('created_at', startOfDay),
                supabase.from('sales').select('total_amount').eq('status', 'budget'),
                supabase.from('products').select('id, name, current_stock, sale_price, stock_local, stock_cordoba').eq('active', true),
                supabase.from('settings').select('value').eq('key', 'commission_rate').single(),
                supabase.from('supplier_orders').select('id, total_cost').eq('status', 'received').gte('created_at', startOfLastWeek)
            ]);

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

            // Calculate Seller's Total Stats & Month Breakdown
            let totalSales = 0;
            let totalCommissions = 0;
            let monthCommissions = 0;
            let monthSales = 0;
            let weekSales = 0;
            const startOfMonthTimestamp = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const startOfWeekTimestamp = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).getTime();

            if (monthlySalesData) {
                monthlySalesData.forEach(s => {
                    const status = (s.status || '').toLowerCase();
                    if (status === 'completed' || status === 'exitosa' || status === '' || status === 'vended') {
                        const amount = (s.total_amount || 0);
                        const comm = (s.commission_amount || 0);
                        totalSales += amount;
                        totalCommissions += comm;

                        // Check if it belongs to current month (local filtering)
                        const saleDate = new Date(s.created_at).getTime();
                        if (saleDate >= startOfMonthTimestamp) {
                            monthCommissions += comm;
                            monthSales += amount;
                        }
                        if (saleDate >= startOfWeekTimestamp) {
                            weekSales += amount;
                        }
                    }
                });
            }

            const todayExpenses = expensesData ? expensesData.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0) : 0;
            const rate = settingsData ? parseFloat(settingsData.value) * 100 : 0;

            // Calculate locked capital in low stock items
            // All products: split into low stock (<=5) and stagnant (stock>5 but no recent sales focus for coach)
            const allProducts = lowStockData || [];
            const trulyLowStock = allProducts.filter(p => (p.current_stock || 0) <= 5);
            const stagnantStock = allProducts.filter(p => (p.current_stock || 0) > 5);
            const lockedCapital = allProducts.reduce((sum, p) => sum + ((p.current_stock || 0) * (parseFloat(p.sale_price) || 0)), 0);

            const newStats = {
                todaySales,
                weekSales,
                monthSales,
                lockedCapital,
                todayNetProfit: todayGrossProfit - todayCommissionsTotal - todayExpenses,
                totalSales,
                totalCommissions,
                monthCommissions,
                budgetSales: budgetsData ? budgetsData.reduce((acc, s) => acc + (s.total_amount || 0), 0) : 0,
                commissionRate: rate,
                lowStockCount: trulyLowStock.length,
                lowStockProducts: trulyLowStock,
                stagnantProducts: stagnantStock,
                recentRestockCount: recentRestocks ? recentRestocks.length : 0
            };
            setStats(newStats);

            // --- MISSION GENERATION (Collaborative & Local) ---
            const dailyMissions = [];

            // 1. Fetch Internal Reports (Collaborative Missions)
            try {
                const { data: internalReports } = await supabase
                    .from('activity_logs')
                    .select('*')
                    .eq('action_type', 'BUSINESS_REPORT')
                    .order('created_at', { ascending: false })
                    .limit(3);

                if (internalReports) {
                    internalReports.forEach(report => {
                        // Only show reports FROM the other role
                        if (report.user_role !== currentRole) {
                            dailyMissions.push({
                                id: `report_${report.id}`,
                                title: 'MENSAJE DEL SOCIO',
                                desc: report.description.substring(0, 50) + '...',
                                fullText: report.description,
                                icon: 'office-building-marker',
                                color: '#d4af37',
                                type: 'internal_report'
                            });
                        }
                    });
                }
            } catch (e) { console.log("Internal reports fetch failed", e); }

            if (currentRole === 'seller') {
                // Parallel mission data fetching
                const [inactive, { data: randomProduct }] = await Promise.all([
                    CRMService.getInactiveClients(20),
                    supabase.from('products').select('name').eq('active', true).limit(1).single()
                ]);

                // 2. Client Recovery Mission
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

                // 3. Content Mission
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
            }

            // 4. Goal Mission (Visible to both if they want)
            dailyMissions.push({
                id: 'goal',
                title: 'META DEL DÍA',
                desc: totalSales > 0 ? '¡Sigue así! Supera tu récord hoy.' : '¡Hoy es el día! Logra tu primera venta.',
                icon: 'trophy-award',
                color: '#fdcb6e',
                type: 'info'
            });

            setMissions(dailyMissions);
        } catch (error) {
            console.log('Stats error:', error);
        } finally {
            setLoading(false);
        }
    };

    const getAICounsel = useCallback(() => {
        if (loading) return "Sincronizando con data central...";
        if (userRole === 'admin') {
            if (stats.lowStockCount > 3) return "⚠️ Atención: Tienes varios productos en reserva crítica.";
            if (stats.budgetSales > 0) return `💡 Tienes $${stats.budgetSales.toFixed(2)} en presupuestos por cerrar.`;
            return "Las métricas están estables. Entra al Coach para un análisis profundo.";
        } else {
            if (missions.length > 0) return `⚔️ Tienes ${missions.length} misiones pendientes de venta.`;
            return "Buen trabajo. Entra al Coach para estrategias de venta.";
        }
    }, [loading, userRole, stats.lowStockCount, stats.budgetSales, missions.length]);

    const getEmpireLevel = (sales) => {
        if (sales < 1000) return 'Nivel 1: Emprendedor 🌱';
        if (sales < 5000) return 'Nivel 2: Comerciante 🏪';
        if (sales < 20000) return 'Nivel 3: Mercader 🚢';
        return 'Nivel 4: Imperio 👑';
    };

    // ── DYNAMIC AI BUSINESS COACH & DECISION SIMULATOR ──
    const generateAiInsights = async (forceRef = true) => {
        setIsAiLoading(true);
        try {
            const adviceData = await EmpireAIService.getInsights(forceRef);
            
            // Map the missions returned by EmpireAIService into the UI state
            if (adviceData && adviceData.missions && !adviceData.error) {
                // Prepend AI missions to existing local missions
                const aiMissions = adviceData.missions.map((m, idx) => ({
                    id: `ai_${Date.now()}_${idx}`,
                    title: String(m.title || 'Misión Estratégica').toUpperCase(),
                    desc: m.reason || adviceData.summary || 'Revisar detalles en la app.',
                    icon: m.action_type === 'restock' ? 'package-variant-closed' : 
                          m.action_type === 'pricing' ? 'cash-multiple' : 
                          m.action_type === 'marketing' ? 'bullhorn' : 'lightning-bolt',
                    color: m.impact === 'high' ? '#e74c3c' : 
                           m.impact === 'medium' ? '#f39c12' : '#2ecc71',
                    type: 'ai_action',
                    action_type: m.action_type,
                    target: m.target_id || null
                }));
                
                setMissions(prev => {
                    const nonAiMissions = prev.filter(p => p.type !== 'ai_action');
                    return [...aiMissions, ...nonAiMissions];
                });
                
                setAiAdvice(adviceData);
            } else {
                setAiAdvice(adviceData || "error");
            }
        } catch (error) {
            console.error('Error fetching AI insights:', error);
            setAiAdvice("error");
        } finally {
            setIsAiLoading(false);
        }
    };

    // Auto-fetch missions on load (silent trigger intelligently cached in service)
    useFocusEffect(
        useCallback(() => { 
            fetchDashboardStats(); 
            generateAiInsights(false); // background silent fetch
        }, [])
    );

    useEffect(() => {
        if (aiModalVisible && (!aiAdvice || aiAdvice === 'error') && !isAiLoading) {
            generateAiInsights(true); // force fresh on manual open
        }
    }, [aiModalVisible]);

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

                if (Platform.OS === 'web') {
                    if (confirm(`🎬 Guion Generado:\n\n${script}\n\n¿Copiar al portapapeles?`)) {
                        require('expo-clipboard').setStringAsync(script);
                    }
                } else {
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
                }
            } catch (e) { 
                if (Platform.OS === 'web') alert(`Error IA: ${e.message}`);
                else Alert.alert('Error IA', e.message); 
            }
            finally { setGeneratingMission(null); }
        } else if (mission.type === 'branding') {
            navigation.navigate('Branding');
        } else if (mission.type === 'internal_report') {
            if (Platform.OS === 'web') {
                alert(`${mission.title}\n\n${mission.fullText}`);
            } else {
                Alert.alert(
                    mission.title,
                    mission.fullText,
                    [
                        { text: 'ENTENDIDO' },
                        {
                            text: 'RESPONDER POR WA',
                            onPress: () => Linking.openURL(`whatsapp://send?text=${encodeURIComponent("Recibí tu reporte: " + mission.desc)}`)
                        }
                    ]
                );
            }
        } else if (mission.type === 'ai_action') {
            // DIRECT AI ACTIONS ORCHESTRATION & TRACKING
            EmpireAIService.markActionExecuted(mission.title);
            
            if (mission.action_type === 'restock') {
                navigation.navigate('NewSupplierOrder');
            } else if (mission.action_type === 'pricing') {
                navigation.navigate('Catalog');
            } else if (mission.action_type === 'marketing') {
                navigation.navigate('Promotions');
            } else {
                navigation.navigate('Admin');
            }
        }
    };

    const handleBarcodeScanned = async ({ data }) => {
        if (scanned) return;
        setScanned(true);

        let barcodeData = data;
        // Detectamos "barcode=" o el corto "bc="
        if (data.includes('barcode=') || data.includes('bc=')) {
            const separator = data.includes('barcode=') ? 'barcode=' : 'bc=';
            const parts = data.split(separator);
            if (parts.length > 1) {
                barcodeData = parts[1].split('&')[0].split('?')[0].split(' ')[0].split(')')[0].split('%')[0].trim();
            }
        }
        
        Alert.alert(
            "🔎 PRUEBA DE CAMARA",
            `LECTURA:\n${data}\n\nRESULTADO:\n[${barcodeData}]`,
            [{ 
                text: "BUSCAR", 
                onPress: async () => {
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
                }
            },
            {
                text: "REINTENTAR",
                onPress: () => setScanned(false)
            }]
        );
    };

    const renderAIModal = () => {
        const empLevel = getEmpireLevel(stats.monthSales);
        return (
            <Modal
                visible={aiModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setAiModalVisible(false)}
            >
            <View style={styles.modalOverlay}>
                <View style={[styles.aiModalContent, { maxHeight: '90%' }]}>
                    <View style={styles.aiModalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                            <MaterialCommunityIcons name="robot" size={32} color="#d4af37" />
                            <View style={{ marginLeft: 15 }}>
                                <Text style={styles.aiModalTitle}>EMPIRE AI COACH</Text>
                                <Text style={styles.aiModalSubtitle}>{empLevel}</Text>
                            </View>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15 }}>
                            <TouchableOpacity
                                onPress={() => {
                                    if (!aiAdvice || aiAdvice === 'error') return;
                                    const shareText = `💎 *CONSEJO DEL EMPIRE AI COACH* 💎\n\nNivel: ${empLevel}\n\n📍 *Estado:* ${aiAdvice.prediction || 'Analizando...'}\n\n🚀 *Estrategia:* ${aiAdvice.strategyB?.plan || aiAdvice.strategyA?.plan || 'Ver más en la app'}\n\n💰 *Sugerencia:* ${aiAdvice.strategyB?.suggestedInvestment || ''}`;
                                    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareText)}`);
                                }}
                                style={{ padding: 5 }}
                            >
                                <MaterialCommunityIcons name="whatsapp" size={24} color="#25D366" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setAiModalVisible(false)} style={{ padding: 5 }}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                        {isAiLoading ? (
                            <View style={[styles.aiAdviceBox, { alignItems: 'center', paddingVertical: 40 }]}>
                                <ActivityIndicator size="large" color="#d4af37" />
                                <Text style={[styles.aiAdviceText, { marginTop: 15, textAlign: 'center' }]}>
                                    Sincronizando con redes neuronales...{'\n'}Calculando proyecciones financieras.
                                </Text>
                            </View>
                        ) : aiAdvice && aiAdvice !== "error" ? (
                            <View style={{ gap: 15 }}>
                                {/* Urgency Banner */}
                                <View style={[
                                    styles.urgencyBanner,
                                    (aiAdvice.urgency || 'Estable') === 'Crítico' ? { borderColor: '#e74c3c', backgroundColor: '#e74c3c20' } :
                                        (aiAdvice.urgency || 'Estable') === 'Atención' ? { borderColor: '#f39c12', backgroundColor: '#f39c1220' } :
                                            { borderColor: '#2ecc71', backgroundColor: '#2ecc7120' }
                                ]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={[
                                            styles.urgencyDot,
                                            (aiAdvice.urgency || 'Estable') === 'Crítico' ? { backgroundColor: '#e74c3c' } :
                                                (aiAdvice.urgency || 'Estable') === 'Atención' ? { backgroundColor: '#f39c12' } :
                                                    { backgroundColor: '#2ecc71' }
                                        ]} />
                                        <Text style={[
                                            styles.urgencyLabel,
                                            (aiAdvice.urgency || 'Estable') === 'Crítico' ? { color: '#e74c3c' } :
                                                (aiAdvice.urgency || 'Estable') === 'Atención' ? { color: '#f39c12' } :
                                                    { color: '#2ecc71' }
                                        ]}>{String(aiAdvice.urgency || 'ESTABLE').toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.urgencyReason}>{aiAdvice.urgencyReason || 'El negocio avanza según lo esperado.'}</Text>
                                </View>

                                {/* Decision Simulator Input */}
                                <View style={styles.simulatorContainer}>
                                    <View style={styles.simulatorHeader}>
                                        <MaterialCommunityIcons name="brain" size={18} color="#9b59b6" />
                                        <Text style={styles.simulatorTitle}>SIMULADOR DE DECISIONES</Text>
                                    </View>
                                    <View style={styles.simulatorInputRow}>
                                        <TextInput
                                            style={styles.simulatorInput}
                                            placeholder="Ej: 'Si bajo 10% el precio de fundas...'"
                                            placeholderTextColor="#666"
                                            value={simulatorQuery}
                                            onChangeText={setSimulatorQuery}
                                            onSubmitEditing={() => generateAiInsights(simulatorQuery)}
                                        />
                                        <TouchableOpacity
                                            style={styles.simulatorBtn}
                                            onPress={() => generateAiInsights(simulatorQuery)}
                                        >
                                            <MaterialCommunityIcons name="send" size={20} color="#000" />
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                {/* Trend Radar */}
                                {aiAdvice.trendRadar && (
                                    <View style={styles.trendRadarBox}>
                                        <MaterialCommunityIcons name="radar" size={24} color="#00ff88" />
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>RADAR GLOBAL</Text>
                                                {aiAdvice.trendScore && (
                                                    <View style={{ backgroundColor: '#00ff8820', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                                                        <Text style={{ color: '#00ff88', fontSize: 10, fontWeight: '900' }}>🔥 {aiAdvice.trendScore}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={styles.trendRadarText}>{aiAdvice.trendRadar}</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Opportunity Index Table */}
                                {aiAdvice.opportunityIndex && aiAdvice.opportunityIndex.length > 0 && (
                                    <View style={styles.coachCard}>
                                        <Text style={styles.planTitle}>ÍNDICE DE OPORTUNIDAD</Text>
                                        <View style={styles.tableHeader}>
                                            <Text style={[styles.tableColTitle, { flex: 2 }]}>Producto</Text>
                                            <Text style={styles.tableColTitle}>Demanda</Text>
                                            <Text style={styles.tableColTitle}>Nivel</Text>
                                        </View>
                                        {aiAdvice.opportunityIndex.map((row, idx) => (
                                            <View key={idx} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { flex: 2, color: '#fff' }]}>{row.product}</Text>
                                                <Text style={styles.tableCell}>{row.demand}</Text>
                                                <Text style={styles.tableCell}>{row.opportunity}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Strategies A & B */}
                                {(aiAdvice.strategyA || aiAdvice.strategyB) && (
                                    <View style={{ gap: 10, marginBottom: 20 }}>
                                        {aiAdvice.strategyA && (
                                            <View style={[styles.coachCard, { borderColor: '#e74c3c60', marginBottom: 0 }]}>
                                                <Text style={[styles.planTitle, { color: '#e74c3c' }]}>{aiAdvice.strategyA.name}</Text>
                                                <Text style={styles.planStep}>{aiAdvice.strategyA.plan}</Text>
                                            </View>
                                        )}
                                        <View style={{ alignItems: 'center', marginVertical: -8, zIndex: 10 }}>
                                            <View style={{ backgroundColor: '#0a0a0a', paddingHorizontal: 10, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#333' }}>
                                                <Text style={{ color: '#666', fontSize: 10, fontWeight: '900' }}>VS</Text>
                                            </View>
                                        </View>
                                        {aiAdvice.strategyB && (
                                            <View style={[styles.coachCard, { borderColor: '#3498db60', marginTop: 0, marginBottom: 0 }]}>
                                                <Text style={[styles.planTitle, { color: '#3498db' }]}>{aiAdvice.strategyB.name}</Text>
                                                <Text style={styles.planStep}>{aiAdvice.strategyB.plan}</Text>

                                                {/* Inversion Suggestion block */}
                                                {aiAdvice.strategyB.suggestedInvestment && (
                                                    <View style={{ marginTop: 15, padding: 12, backgroundColor: '#3498db15', borderRadius: 8, borderWidth: 1, borderColor: '#3498db30' }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: '900' }}>INVERSIÓN SUGERIDA:</Text>
                                                            <Text style={{ color: '#3498db', fontSize: 11, fontWeight: '900' }}>{aiAdvice.strategyB.suggestedInvestment}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: '900' }}>STOCK RECOMENDADO:</Text>
                                                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{aiAdvice.strategyB.suggestedStock}</Text>
                                                        </View>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                                            <Text style={{ color: '#888', fontSize: 10, fontWeight: '900' }}>MARGEN ESTIMADO:</Text>
                                                            <Text style={{ color: '#2ecc71', fontSize: 11, fontWeight: '900' }}>{aiAdvice.strategyB.estimatedMargin}</Text>
                                                        </View>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Prediction */}
                                {aiAdvice.prediction && (
                                    <View style={styles.predictionBox}>
                                        <MaterialCommunityIcons name="crystal-ball" size={24} color="#9b59b6" />
                                        <Text style={styles.predictionText}>{aiAdvice.prediction}</Text>
                                    </View>
                                )}

                                {/* Enviar al Socio (Interno App) */}
                                {stats.stagnantProducts && stats.stagnantProducts.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.coachActionBtn, { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#2ecc71', marginBottom: 10 }]}
                                        onPress={async () => {
                                            const stagnantContext = stats.stagnantProducts
                                                .map(p => `${p.name} (Stock: ${p.current_stock} un., Precio $${p.sale_price})`)
                                                .join(', ');
                                            const message = `REPORTE DE NEGOCIO: Nivel ${getEmpireLevel(stats.monthSales)}. Estado: ${aiAdvice.prediction || 'Analizando...'}. Stock Crítico/Dormido detectado en: ${stagnantContext}. Por favor, revisa estas prioridades.`;
                                            
                                            setAiModalVisible(false);
                                            setLoading(true);
                                            try {
                                                await SecurityService.logActivity('BUSINESS_REPORT', message);
                                                Alert.alert('✅ ¡Reporte Enviado!', 'Tu socio verá este mensaje al abrir su Dashboard de la App.');
                                            } catch (e) {
                                                Alert.alert('Error', 'No se pudo enviar el reporte interno.');
                                            } finally {
                                                setLoading(false);
                                                fetchDashboardStats();
                                            }
                                        }}
                                    >
                                        <MaterialCommunityIcons name="cellphone-arrow-down" size={20} color="#2ecc71" />
                                        <Text style={[styles.coachActionBtnText, { color: '#2ecc71' }]}>NOTIFICAR AL SOCIO (EN APP) 📲</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Enviar al Aliado (AI) */}
                                {stats.stagnantProducts && stats.stagnantProducts.length > 0 && (
                                    <TouchableOpacity
                                        style={[styles.coachActionBtn, { backgroundColor: '#1a1a2e', borderWidth: 1, borderColor: '#9b59b6', marginBottom: 10 }]}
                                        onPress={() => {
                                            setAiModalVisible(false);
                                            const stagnantContext = stats.stagnantProducts
                                                .map(p => `${p.name} (Stock: ${p.current_stock} un., Precio $${p.sale_price})`)
                                                .join(', ');
                                            navigation.navigate('Inventario', {
                                                allyPrompt: `Tengo los siguientes productos con stock alto que no están rotando bien: ${stagnantContext}. Necesito ideas de contenido creativo (reels, stories, copies para WhatsApp) para activar las ventas de estos productos sin bajar el precio.`
                                            });
                                        }}
                                    >
                                        <MaterialCommunityIcons name="robot-excited" size={20} color="#9b59b6" />
                                        <Text style={[styles.coachActionBtnText, { color: '#9b59b6' }]}>CREAR CONTENIDO (Aliado AI) 🤖</Text>
                                    </TouchableOpacity>
                                )}

                                {/* Main Action */}
                                <TouchableOpacity
                                    style={styles.coachActionBtn}
                                    onPress={() => {
                                        setAiModalVisible(false);
                                        if (aiAdvice.actionId === 'create_promo') navigation.navigate('Catalog');
                                        else if (aiAdvice.actionId === 'restock') navigation.navigate('Inventario');
                                        else if (aiAdvice.actionId === 'close_budgets') navigation.navigate('Orders', { initialViewType: 'presupuestos' });
                                        else navigation.navigate('Catalog');
                                    }}
                                >
                                    <MaterialCommunityIcons name="lightning-bolt" size={20} color="#000" />
                                    <Text style={styles.coachActionBtnText}>{aiAdvice.actionText}</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={styles.aiAdviceBox}>
                                <Text style={styles.aiAdviceText}>Error de conexión. Intenta nuevamente.</Text>
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
};

    if (isScanning) {
        return (
            <View style={styles.scannerFull}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
                
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerOutline} />
                    <Text style={styles.scannerText}>APUNTA AL QR DE PRUEBA</Text>
                    {scanned && (
                        <TouchableOpacity style={styles.resetBtn} onPress={() => setScanned(false)}>
                            <Text style={styles.resetText}>REINTENTAR LECTURA</Text>
                        </TouchableOpacity>
                    )}
                </View>

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

            <SafeAreaView style={styles.safe} edges={['top']}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.navigate('Branding')} activeOpacity={0.7}>
                        <Text style={styles.brandName}>EMPIRE 👑</Text>
                        <Text style={styles.headerRole}>{userRole === 'admin' ? 'Líder Supremo' : 'SOCIO ESTRATÉGICO'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('user_role'); navigation.replace('Login', { fromLogout: true }); }}>
                        <MaterialCommunityIcons name="logout-variant" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    {/* NEON HEADER LINE */}
                    <View style={styles.neonHeaderLine} />
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    {/* Minimal Insight */}
                    <View style={styles.insightBox}>
                        <LinearGradient colors={['rgba(212, 175, 55, 0.1)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.insightGrad} />
                        <MaterialCommunityIcons name="lightning-bolt" size={18} color="#d4af37" />
                        <Text style={styles.insightText}>{getAICounsel()}</Text>
                    </View>

                    {/* Stats Bricks Clean - ADMIN ONLY */}
                    <View style={styles.statsGrid}>
                        <View style={styles.statBrick}>
                            <Text style={styles.statLab}>Ventas Hoy</Text>
                            <Text style={styles.statVal}>${stats.todaySales.toFixed(0)}</Text>
                        </View>
                        <View style={styles.statBrick}>
                            <Text style={styles.statLab}>Balance Neto Hoy</Text>
                            <Text style={[styles.statVal, { color: stats.todayNetProfit >= 0 ? '#00ff88' : '#ff4444' }]}>
                                ${stats.todayNetProfit.toFixed(0)}
                            </Text>
                        </View>
                    </View>

                    {userRole === 'seller' && (
                        <View style={styles.commissionContainer}>
                            <LinearGradient
                                colors={['#d4af3720', '#d4af3705']}
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                                style={styles.commissionBox}
                            >
                                <View style={styles.commissionHeader}>
                                    <MaterialCommunityIcons name="star-circle" size={20} color="#d4af37" />
                                    <Text style={styles.commissionLab}>MI COMISIÓN ACUMULADA TOTAL</Text>
                                </View>
                                <Text style={styles.commissionVal}>${stats.totalCommissions.toFixed(2)}</Text>

                                {stats.totalCommissions > 0 && (
                                    <View style={styles.monthBadgeSmall}>
                                        <Text style={styles.monthBadgeText}>
                                            ESTE MES: ${stats.monthCommissions.toFixed(2)} ({((stats.monthCommissions / stats.totalCommissions) * 100).toFixed(0)}%)
                                        </Text>
                                    </View>
                                )}
                            </LinearGradient>
                        </View>
                    )}


                    {/* Minimalist Grid of Actions */}
                    <Text style={styles.sectionLabel}>MÓDULOS DEL IMPERIO</Text>
                    <View style={styles.actionGrid}>
                        <MinimalModule title="Coach personalizado" icon="robot-happy" color="#d4af37" isNew fullWidth onPress={() => setAiModalVisible(true)} />

                        <View style={styles.actionSubGrid}>
                            <MinimalModule title="Catálogo" icon="cellphone-link" color="#00ff88" onPress={() => navigation.navigate('Catalog')} />
                            <MinimalModule title="Clientes" icon="account-group" color="#9b59b6" onPress={() => navigation.navigate('Clients')} />
                            <MinimalModule title="Pedidos" icon="clipboard-list-outline" color="#3498db" onPress={() => navigation.navigate('Orders')} />
                        </View>
                    </View>

                    {/* Primary Action: Minimalist Giant Scanner */}
                    <View style={styles.scannerCenter}>
                        <TouchableOpacity style={styles.scannerTap} onPress={() => setIsScanning(true)}>
                            <LinearGradient colors={['#d4af37', '#b8860b']} style={styles.scannerCircle}>
                                <MaterialCommunityIcons name="barcode-scan" size={45} color="#000" />
                                <Text style={styles.scannerLabel}>ESCANEAR PRODUCTO</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.manualEntryBtn}
                            onPress={() => navigation.navigate('NewSale', { selectClientFirst: true })}
                        >
                            <MaterialCommunityIcons name="cursor-default-click-outline" size={18} color="#555" />
                            <Text style={styles.manualEntryText}>O CARGAR MANUALMENTE</Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView >
            </SafeAreaView >
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    background: { ...StyleSheet.absoluteFillObject },
    safe: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingVertical: 20, position: 'relative' },
    neonHeaderLine: { position: 'absolute', bottom: 0, left: 25, right: 25, height: 1, backgroundColor: '#d4af37', shadowColor: '#d4af37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 10, elevation: 5 },
    brandName: { color: '#d4af37', fontSize: 24, fontWeight: '900', letterSpacing: 3, textShadowColor: '#ffcc00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 20 },
    headerRole: { color: '#444', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', marginTop: 2 },

    scroll: { paddingBottom: 0 },

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
    commissionBox: { padding: 25, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.4)', alignItems: 'center', backgroundColor: '#020202' },
    commissionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15 },
    commissionLab: { color: '#d4af37', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    commissionVal: { color: '#fff', fontSize: 36, fontWeight: '900', textShadowColor: '#ffcc00', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 15 },
    monthBadgeSmall: { backgroundColor: 'rgba(212, 175, 55, 0.15)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, marginTop: 10, borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.5)' },
    monthBadgeText: { color: '#d4af37', fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
    commissionSub: { color: '#666', fontSize: 12, fontWeight: '600', marginTop: 15, textAlign: 'center' },

    sectionLabel: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 15, paddingHorizontal: 25, marginTop: 20 },

    actionGrid: { paddingHorizontal: 25, gap: 12 },
    actionSubGrid: { flexDirection: 'row', gap: 10, marginTop: 5 },
    fullWidthCard: { width: '100%', paddingVertical: 20 },
    miniCard: { flex: 1, backgroundColor: '#080808', padding: 15, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#151515', shadowColor: '#d4af37', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.1, shadowRadius: 5 },
    miniIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 0, marginBottom: 10 },
    miniTitle: { color: '#888', fontSize: 10, fontWeight: '800', textAlign: 'center' },
    miniBadge: { position: 'absolute', top: 15, right: 15, width: 8, height: 8, borderRadius: 4, backgroundColor: '#d4af37', shadowColor: '#d4af37', shadowRadius: 5, shadowOpacity: 1 },

    scannerCenter: { alignItems: 'center', marginTop: 40 },
    scannerTap: {
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: '#000', // Essential for shadows to render properly on some devices
        shadowColor: '#d4af37',
        shadowOpacity: 0.7,
        shadowRadius: 30,
        // Remove high elevation which causes square artifacts on many Android versions
        elevation: 10,
        justifyContent: 'center',
        alignItems: 'center'
    },
    scannerCircle: {
        width: 176,
        height: 176,
        borderRadius: 88,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        borderWidth: 1,
        borderColor: '#d4af3750'
    },
    scannerLabel: { color: '#000', fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 10, letterSpacing: 1 },
    manualEntryBtn: { marginTop: 25, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 15 },
    manualEntryText: { color: '#555', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },

    scannerFull: { flex: 1, backgroundColor: '#000' },
    closeBtn: { position: 'absolute', top: 50, right: 30 },

    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
    aiModalContent: { backgroundColor: '#080808', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
    aiModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    aiModalTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    aiModalSubtitle: { color: '#aaa', fontSize: 11, fontWeight: '600', marginTop: 3 },
    modalBody: { marginBottom: 20 },

    urgencyBanner: { padding: 15, borderRadius: 12, borderWidth: 1, marginBottom: 15 },
    urgencyDot: { width: 10, height: 10, borderRadius: 5 },
    urgencyLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    urgencyReason: { color: '#eee', fontSize: 13, fontWeight: '600', marginTop: 8 },

    coachCard: { backgroundColor: '#111', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
    coachCardRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    coachCardText: { color: '#bbb', fontSize: 13, flex: 1, lineHeight: 20 },

    planTitle: { color: '#888', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 10 },
    planStep: { color: '#ddd', fontSize: 14, fontWeight: '700', marginBottom: 8, lineHeight: 20 },

    predictionBox: { flexDirection: 'row', backgroundColor: '#9b59b615', padding: 15, borderRadius: 12, gap: 12, alignItems: 'center', borderColor: '#9b59b640', borderWidth: 1, marginBottom: 20 },

    predictionText: { color: '#e0bbf3', fontSize: 13, fontWeight: '800', flex: 1, lineHeight: 20 },
    coachActionBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, minHeight: 60 },
    coachActionBtnText: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
    aiAdviceBox: { backgroundColor: '#111', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d4af3740' },
    aiAdviceText: { color: '#ccc', fontSize: 14, lineHeight: 22 },

    simulatorContainer: { backgroundColor: '#181818', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    simulatorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    simulatorTitle: { color: '#9b59b6', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
    simulatorInputRow: { flexDirection: 'row', gap: 10 },
    simulatorInput: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#444', borderRadius: 8, paddingHorizontal: 12, color: '#fff', fontSize: 13, minHeight: 40 },
    simulatorBtn: { backgroundColor: '#9b59b6', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, borderRadius: 8 },

    // New Coach Components
    trendRadarBox: { flexDirection: 'row', backgroundColor: '#00ff8815', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: '#00ff8840', marginBottom: 15, gap: 10, alignItems: 'center' },
    trendRadarText: { color: '#00ff88', fontSize: 13, fontWeight: '800', flex: 1, lineHeight: 20, letterSpacing: 0.5 },
    tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#333', paddingBottom: 8, marginBottom: 8 },
    tableColTitle: { flex: 1, color: '#666', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', marginBottom: 8, alignItems: 'center' },
    tableCell: { flex: 1, color: '#bbb', fontSize: 11, fontWeight: '500' },

    closeModalBtn: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 12, alignItems: 'center' },
    closeModalBtnText: { color: '#aaa', fontSize: 12, fontWeight: '900', letterSpacing: 1 },

    // Scanner Overlay Styles
    scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
    scannerOutline: { width: 250, height: 250, borderWidth: 2, borderColor: '#d4af37', borderRadius: 30, borderStyle: 'dashed' },
    scannerText: { color: '#fff', marginTop: 25, fontWeight: '900', letterSpacing: 2, fontSize: 11, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 10 },
    resetBtn: { marginTop: 30, backgroundColor: '#d4af37', paddingHorizontal: 25, paddingVertical: 15, borderRadius: 12 },
    resetText: { color: '#000', fontWeight: '900', fontSize: 12, letterSpacing: 1 }
});
