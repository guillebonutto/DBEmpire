import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, StatusBar, Alert, Dimensions, ActivityIndicator, Modal, TextInput } from 'react-native';
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
                supabase.from('products').select('id, name, current_stock, sale_price').eq('active', true).lte('current_stock', 5),
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
            const lockedCapital = lowStockData ? lowStockData.reduce((sum, p) => sum + ((p.current_stock || 0) * (parseFloat(p.sale_price) || 0)), 0) : 0;

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
                lowStockCount: lowStockData ? lowStockData.length : 0,
                lowStockProducts: lowStockData || [],
                recentRestockCount: recentRestocks ? recentRestocks.length : 0
            };
            setStats(newStats);

            // --- MISSION GENERATION (Only for Sellers) ---
            if (currentRole === 'seller') {
                const dailyMissions = [];

                // Parallel mission data fetching
                const [inactive, { data: randomProduct }] = await Promise.all([
                    CRMService.getInactiveClients(20),
                    supabase.from('products').select('name').eq('active', true).limit(1).single()
                ]);

                // 1. Client Recovery Mission
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
                    desc: totalSales > 0 ? '¡Sigue así! Supera tu récord hoy.' : '¡Hoy es el día! Logra tu primera venta.',
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

    // ── DYNAMIC AI BUSINESS COACH & DECISION SIMULATOR ──
    const generateAiInsights = async (customQuery = null) => {
        setIsAiLoading(true);
        if (!customQuery) setAiAdvice(null);
        try {
            // 1. Fetch Top Products sold this week to give AI context
            const now = new Date();
            const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
            
            const { data: recentItems } = await supabase
                .from('sale_items')
                .select('quantity, products(name, current_stock, sale_price)')
                .gte('created_at', startOfWeek);

            const productStats = {};
            let topProductsText = "Aún no hay ventas esta semana.";

            if (recentItems && recentItems.length > 0) {
                recentItems.forEach(item => {
                    if (!item.products) return;
                    const name = item.products.name;
                    if (!productStats[name]) {
                        productStats[name] = { 
                            qty: 0, 
                            stock: item.products.current_stock || 0,
                            price: item.products.sale_price || 0
                        };
                    }
                    productStats[name].qty += item.quantity;
                });
                
                topProductsText = Object.entries(productStats)
                    .sort((a, b) => b[1].qty - a[1].qty)
                    .slice(0, 5)
                    .map(([name, data]) => `- ${name}: ${data.qty} vendidos (Stock restante: ${data.stock}, Precio $${data.price})`)
                    .join('\n');
            }

            const getEmpireLevel = (sales) => {
                if (sales < 1000) return 'Nivel 1: Emprendedor 🌱';
                if (sales < 5000) return 'Nivel 2: Comerciante 🏪';
                if (sales < 20000) return 'Nivel 3: Mercader 🚢';
                return 'Nivel 4: Imperio 👑';
            };

            const empLevel = getEmpireLevel(stats.monthSales);
            const dailyAvg = stats.weekSales / 7;
            const diffPct = dailyAvg > 0 ? (((stats.todaySales - dailyAvg) / dailyAvg) * 100).toFixed(0) : 0;
            const trend = diffPct > 0 ? `+${diffPct}% arriba` : `${diffPct}% debajo`;
            // 2. Build JSON Prompt
            let prompt = `
            Eres el "Empire AI Coach", un asesor táctico de élite integrado en "Digital Boost Empire" (App de punto de venta).
            CONTEXTO DEL NEGOCIO: Es una tiendita/emprendimiento dedicado a vender GADGETS PARA EL USO COTIDIANO, artículos prácticos, curiosos y tecnología útil para el día a día (novedades, accesorios hogar/oficina, etc.).
            Tu objetivo es generar estrategias de alta rotación, armar combos estratégicos, detectar "capital dormido" y SUGERIR NUEVOS PRODUCTOS.
            
            Analiza los datos y devuelve una ESTRATEGIA INMEDIATA formateada SOLO COMO UN OBJETO JSON válido (sin código markdown \`\`\`json).

            DATOS ACTUALES DEL NEGOCIO:
            - Nivel del Imperio: ${empLevel}
            - Rol: ${userRole === 'admin' ? 'Admin' : 'Vendedor'}
            - Ventas Hoy: $${stats.todaySales} (Tendencia: ${trend} del promedio semanal de $${dailyAvg.toFixed(2)}/día)
            - Proyección Semanal Actual: $${stats.weekSales}
            - Inventario Crítico o Dormido: ${stats.lowStockCount} productos
            - Capital Retenido (Valor aprox): $${stats.lockedCapital}
            
            TOP PRODUCTOS DE LA SEMANA:
            ${topProductsText}
            `;

            if (customQuery) {
                prompt += `
                ATENCIÓN: EL USUARIO HA LANZADO EL SIMULADOR DE DECISIONES CON ESTA PREGUNTA: "${customQuery}"
                Debes responder ESPECÍFICAMENTE simulando matemáticamente y logísticamente qué pasaría si hace eso.
                Calcula si mantiene márgenes, cuánto capital compromete, o cuántas unidades extra tiene que vender.
                `;
            } else {
                prompt += `
                INSTRUCCIONES PARA EL DIAGNÓSTICO LIBRE:
                Detecta oportunidades ocultas. Si hay productos estrella sin stock, sugiere reponer.
                IMPORTANTE: Analiza su historial y el nicho para sugerir QUÉ NUEVOS PRODUCTOS DEBERÍA COMPRAR mañana para expandir su catálogo (productos de tendencia o complementarios que aún no tiene pero que sus clientes comprarían).
                Si hay capital bloqueado, sugiere crear "Combos Relámpago". 
                `;
            }

            prompt += `
            Debes devolver EXACTAMENTE este objeto JSON con las claves exactas (reemplaza los valores con tu análisis de alto impacto enfocado en tecnología/accesorios):
            {
              "empireLevel": "${empLevel}",
              "urgency": "${customQuery ? "Simulación" : "Estable"}" | "Atención" | "Crítico",
              "urgencyReason": "${customQuery ? "Resultado simulado en proceso..." : "Razón corta de la urgencia (ej: 'Tienes 18k retenidos en capital muerto. Usa combos para accesorios.')"}",
              "impact": "Explica el impacto en dinero (ej: 'Si reduces un 10%, necesitas vender 3 fundas extra para mantener ganancia.')",
              "trend": "Comparación temporal o análisis de mercado tech (ej: 'Tus cables USB-C bajaron rotación. Combínalos con cargadores.')",
              "prediction": "Predicción financiera brutal (ej: 'Si inviertes $5,000 extra en los top 2 gadgets hoy, la proyección de la semana se dispara a $42,000 en ventas.')",
              "plan": [
                "1️⃣ Acción específica (Ej: 'Crea Combo Cargador+Cable 15% OFF')",
                "2️⃣ Segunda acción concreta"
              ],
              "actionId": "create_promo" | "restock" | "close_budgets",
              "actionText": "${customQuery ? "APLICAR ESTRATEGIA" : "CREAR COMBO O REPONER"}"
            }
            IMPORTANTE: Solo devuelve el JSON puro, nada de texto antes o después.
            `;

            const adviceJsonStr = await GeminiService.handleGeneralRequest(prompt);
            let adviceData;
            try {
                adviceData = JSON.parse(adviceJsonStr.replace(/```json/g, '').replace(/```/g, '').trim());
            } catch (e) {
                console.error("Error parsing AI JSON", e);
                throw new Error("Formato de respuesta IA inválido");
            }
            setAiAdvice(adviceData);

        } catch (error) {
            console.error('Error generating AI coach insight:', error);
            setAiAdvice("error");
        } finally {
            setIsAiLoading(false);
        }
    };

    useEffect(() => {
        if (aiModalVisible && !aiAdvice && !isAiLoading) {
            generateAiInsights();
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
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={styles.modalTitle}>EMPIRE AI COACH</Text>
                            {aiAdvice && aiAdvice !== "error" && (
                                <Text style={styles.empireLevelText}>{aiAdvice.empireLevel}</Text>
                            )}
                        </View>
                        <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                            <MaterialCommunityIcons name="close" size={24} color="#666" />
                        </TouchableOpacity>
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
                                    aiAdvice.urgency === 'Crítico' ? { borderColor: '#e74c3c', backgroundColor: '#e74c3c20' } :
                                    aiAdvice.urgency === 'Atención' ? { borderColor: '#f39c12', backgroundColor: '#f39c1220' } :
                                    { borderColor: '#2ecc71', backgroundColor: '#2ecc7120' }
                                ]}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={[
                                            styles.urgencyDot, 
                                            aiAdvice.urgency === 'Crítico' ? { backgroundColor: '#e74c3c' } :
                                            aiAdvice.urgency === 'Atención' ? { backgroundColor: '#f39c12' } :
                                            { backgroundColor: '#2ecc71' }
                                        ]} />
                                        <Text style={[
                                            styles.urgencyLabel,
                                            aiAdvice.urgency === 'Crítico' ? { color: '#e74c3c' } :
                                            aiAdvice.urgency === 'Atención' ? { color: '#f39c12' } :
                                            { color: '#2ecc71' }
                                        ]}>{aiAdvice.urgency.toUpperCase()}</Text>
                                    </View>
                                    <Text style={styles.urgencyReason}>{aiAdvice.urgencyReason}</Text>
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

                                {/* Impact & Trend */}
                                <View style={styles.coachCard}>
                                    <View style={styles.coachCardRow}>
                                        <MaterialCommunityIcons name="chart-bell-curve-cumulative" size={20} color="#d4af37" />
                                        <Text style={styles.coachCardText}>{aiAdvice.trend}</Text>
                                    </View>
                                    <View style={[styles.coachCardRow, { marginTop: 10, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 10 }]}>
                                        <MaterialCommunityIcons name="currency-usd" size={20} color="#2ecc71" />
                                        <Text style={styles.coachCardText}>{aiAdvice.impact}</Text>
                                    </View>
                                </View>

                                {/* Priority Plan */}
                                <View style={styles.coachCard}>
                                    <Text style={styles.planTitle}>PLAN TÁCTICO INMEDIATO</Text>
                                    {aiAdvice.plan && aiAdvice.plan.map((step, idx) => (
                                        <Text key={idx} style={styles.planStep}>{step}</Text>
                                    ))}
                                </View>

                                {/* Prediction */}
                                <View style={styles.predictionBox}>
                                    <MaterialCommunityIcons name="crystal-ball" size={24} color="#9b59b6" />
                                    <Text style={styles.predictionText}>{aiAdvice.prediction}</Text>
                                </View>

                                {/* Action Action */}
                                <TouchableOpacity 
                                    style={styles.coachActionBtn}
                                    onPress={() => {
                                        setAiModalVisible(false);
                                        if (aiAdvice.actionId === 'create_promo') navigation.navigate('Catalog');
                                        else if (aiAdvice.actionId === 'restock') navigation.navigate('Stock');
                                        else if (aiAdvice.actionId === 'close_budgets') navigation.navigate('Orders');
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

    if (isScanning) {
        return (
            <View style={styles.scannerFull}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                    barcodeScannerSettings={{
                        barcodeTypes: ['qr', 'ean13', 'ean8', 'code128'],
                    }}
                />
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
                    <View>
                        <Text style={styles.brandName}>EMPIRE 👑</Text>
                        <Text style={styles.headerRole}>{userRole === 'admin' ? 'Líder Supremo' : 'Aliado (Power User)'}</Text>
                    </View>
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
                            <Text style={styles.statLab}>{userRole === 'admin' ? 'Balance Neto' : 'Mi Comisión'}</Text>
                            <Text style={[styles.statVal, { color: (userRole === 'admin' ? (stats.todayNetProfit >= 0 ? '#00ff88' : '#ff4444') : '#00ff88') }]}>
                                ${userRole === 'admin' ? stats.todayNetProfit.toFixed(0) : stats.monthCommissions.toFixed(0)}
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

                    {/* DAILY MISSIONS - SELLER ONLY */}
                    {
                        userRole === 'seller' && missions.length > 0 && (
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
                        )
                    }

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
                            onPress={() => navigation.navigate('NewSale', { autoSearch: true })}
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
    modalContent: { backgroundColor: '#080808', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, maxHeight: '85%', borderTopWidth: 1, borderTopColor: '#1a1a1a' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 2 },
    empireLevelText: { color: '#aaa', fontSize: 11, fontWeight: '600', marginTop: 3 },
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
    coachActionBtn: { backgroundColor: '#d4af37', padding: 18, borderRadius: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
    coachActionBtnText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 1.5 },
    aiAdviceBox: { backgroundColor: '#111', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#d4af3740' },
    aiAdviceText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
    
    simulatorContainer: { backgroundColor: '#181818', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    simulatorHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    simulatorTitle: { color: '#9b59b6', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
    simulatorInputRow: { flexDirection: 'row', gap: 10 },
    simulatorInput: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#444', borderRadius: 8, paddingHorizontal: 12, color: '#fff', fontSize: 13, minHeight: 40 },
    simulatorBtn: { backgroundColor: '#9b59b6', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 15, borderRadius: 8 },

    closeModalBtn: { backgroundColor: '#1a1a1a', padding: 15, borderRadius: 12, alignItems: 'center' },
    closeModalBtnText: { color: '#aaa', fontSize: 12, fontWeight: '900', letterSpacing: 1 }
});
