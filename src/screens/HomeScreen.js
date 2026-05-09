import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    StatusBar, Dimensions, ScrollView, Alert, ActivityIndicator, TextInput, Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFinanceStore } from '../store/useFinanceStore';
import { EmpireAIService } from '../services/empireAIService';
import { useAuthStore } from '../store/useAuthStore';
import { DeviceAuthService } from '../services/deviceAuth';

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const { userRole, setUserRole } = useAuthStore();
    const { sales, fetchAllData } = useFinanceStore();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [aiAdvice, setAiAdvice] = useState(null);
    const [loadingAI, setLoadingAI] = useState(false);
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [simulatorQuery, setSimulatorQuery] = useState('');
    const [hardwareRole, setHardwareRole] = useState(null);

    const loadDashboardData = useCallback(async () => {
        try {
            await fetchAllData();
            
            const hRole = await DeviceAuthService.checkAuthorization();
            setHardwareRole(hRole);

            // Get fresh role directly from state or storage to avoid hydration race conditions
            let currentRole = useAuthStore.getState().userRole;
            if (!currentRole) {
                currentRole = await AsyncStorage.getItem('user_role');
            }

            // AUTO-SYNC ROLE: If they are the leader/admin, always boot them into leader mode by default
            if ((hRole === 'admin' || hRole === 'leader') && (!currentRole || currentRole === 'admin')) {
                currentRole = 'leader';
                setUserRole('leader');
                await AsyncStorage.setItem('user_role', 'leader');
            } else if (!currentRole) {
                currentRole = 'seller';
                setUserRole('seller');
            }

            setLoadingAI(true);
            const insights = await EmpireAIService.getInsights(false, currentRole);
            setAiAdvice(insights);
        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoadingAI(false);
        }
    }, [fetchAllData]);

    const refreshAI = async (force = true) => {
        setLoadingAI(true);
        try {
            const insights = await EmpireAIService.getInsights(force, userRole || 'seller');
            setAiAdvice(insights);
        } catch (e) { console.log('AI refresh error:', e); }
        finally { setLoadingAI(false); }
    };

    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [loadDashboardData])
    );

    const renderAIModal = () => {
        const a = aiAdvice;
        const urgency = a?.urgency || 'Estable';
        const urgColor = urgency === 'Crítico' ? '#e74c3c' : urgency === 'Atención' ? '#f39c12' : '#2ecc71';
        return (
            <Modal visible={aiModalVisible} transparent animationType="slide" onRequestClose={() => setAiModalVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalBox}>
                        {/* Header */}
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <MaterialCommunityIcons name="robot" size={28} color="#d4af37" />
                                <View>
                                    <Text style={styles.modalTitle}>EMPIRE AI COACH</Text>
                                    <Text style={styles.modalSubtitle}>Nivel 4: Imperio 👑</Text>
                                </View>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                                {a && !loadingAI && (
                                    <TouchableOpacity onPress={() => {
                                        const txt = `💎 EMPIRE AI COACH\n\n📍 ${a.urgency?.toUpperCase()}: ${a.urgencyReason}\n\n⚡ PLAN A: ${a.strategyA?.plan}\n\n💰 PLAN B: ${a.strategyB?.plan}`;
                                        Linking.openURL(`whatsapp://send?text=${encodeURIComponent(txt)}`);
                                    }}>
                                        <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                                    <MaterialCommunityIcons name="close" size={22} color="#666" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                            {loadingAI ? (
                                <View style={{ alignItems: 'center', paddingVertical: 50 }}>
                                    <ActivityIndicator size="large" color="#d4af37" />
                                    <Text style={{ color: '#666', marginTop: 15, fontSize: 13 }}>Analizando el Imperio...</Text>
                                </View>
                            ) : !a ? (
                                <TouchableOpacity style={styles.initBtn} onPress={() => refreshAI(true)}>
                                    <MaterialCommunityIcons name="robot-excited" size={32} color="#d4af37" />
                                    <Text style={styles.initBtnText}>INICIALIZAR COACH IA</Text>
                                    <Text style={{ color: '#555', fontSize: 12 }}>Analiza tus datos y genera el plan</Text>
                                </TouchableOpacity>
                            ) : (
                                <View style={{ gap: 14, paddingBottom: 30 }}>
                                    {/* Urgency */}
                                    <View style={[styles.urgencyBanner, { borderColor: urgColor, backgroundColor: urgColor + '18' }]}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <View style={[styles.urgDot, { backgroundColor: urgColor }]} />
                                            <Text style={[styles.urgLabel, { color: urgColor }]}>{urgency.toUpperCase()}</Text>
                                        </View>
                                        <Text style={styles.urgReason}>{a.urgencyReason}</Text>
                                    </View>

                                    {/* Simulador */}
                                    <View style={styles.simBox}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                            <MaterialCommunityIcons name="brain" size={16} color="#9b59b6" />
                                            <Text style={{ color: '#9b59b6', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>SIMULADOR DE DECISIONES</Text>
                                        </View>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                            <TextInput
                                                style={styles.simInput}
                                                placeholder="Ej: 'Si bajo 10% el precio de fundas...'"
                                                placeholderTextColor="#444"
                                                value={simulatorQuery}
                                                onChangeText={setSimulatorQuery}
                                            />
                                            <TouchableOpacity style={styles.simBtn} onPress={() => { setSimulatorQuery(''); refreshAI(true); }}>
                                                <MaterialCommunityIcons name="send" size={18} color="#000" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    {/* Misión Cero */}
                                    {a.today_plan && (
                                        <View style={styles.misionCero}>
                                            <Text style={styles.misionCeroTitle}>🔥 MISIÓN CERO: EL PLAN DE HOY</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <MaterialCommunityIcons name="star-shooting" size={14} color="#d4af37" />
                                                <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{a.today_plan.product}</Text>
                                            </View>
                                            {/* ADMIN: Offline Plan (No Video Direction) */}
                                            {a.today_plan.schedule && (
                                                <View style={styles.scheduleBox}>
                                                    <Text style={styles.scheduleLabel}>⏰ HORARIO</Text>
                                                    <Text style={styles.scheduleText}>{a.today_plan.schedule}</Text>
                                                </View>
                                            )}
                                            {a.today_plan.location && (
                                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, alignItems: 'flex-start' }}>
                                                    <Text style={{ color: '#e74c3c', fontSize: 14 }}>📍</Text>
                                                    <Text style={{ color: '#ddd', fontSize: 13, flex: 1, lineHeight: 18 }}>{a.today_plan.location}</Text>
                                                </View>
                                            )}
                                            {a.today_plan.target && !a.today_plan.video_direction && (
                                                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, alignItems: 'flex-start' }}>
                                                    <Text style={{ color: '#e74c3c', fontSize: 14 }}>🎯</Text>
                                                    <Text style={{ color: '#ddd', fontSize: 13, flex: 1, lineHeight: 18 }}>{a.today_plan.target}{a.today_plan.expected_sales ? ` → ${a.today_plan.expected_sales}` : ''}</Text>
                                                </View>
                                            )}

                                            {/* SELLER: Online Plan (Video Direction) */}
                                            {a.today_plan.video_direction && (
                                                <View style={styles.videoDirBox}>
                                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8}}>
                                                        <Text style={{ fontSize: 14 }}>🎬</Text>
                                                        <Text style={{ color: '#3498db', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>DIRECCIÓN DE VIDEO VIRAL</Text>
                                                    </View>
                                                    
                                                    <Text style={{ color: '#fff', fontSize: 12, marginBottom: 6, lineHeight: 18 }}>
                                                        <Text style={{ fontSize: 14 }}>👀</Text> <Text style={{fontWeight: 'bold', color: '#c8a8f0'}}>GANCHO VISUAL (0-3s):</Text> {a.today_plan.video_direction.visual_hook}
                                                    </Text>
                                                    
                                                    <Text style={{ color: '#fff', fontSize: 12, marginBottom: 8, lineHeight: 18 }}>
                                                        <Text style={{ fontSize: 14 }}>🗣️</Text> <Text style={{fontWeight: 'bold', color: '#c8a8f0'}}>GANCHO TEXTUAL (0-3s):</Text> {a.today_plan.video_direction.verbal_hook}
                                                    </Text>
                                                    
                                                    <Text style={{ color: '#bbb', fontSize: 11, fontStyle: 'italic', marginBottom: 12, lineHeight: 16 }}>
                                                        📝 {a.today_plan.video_direction.structure}
                                                    </Text>

                                                    {a.today_plan.video_direction.spoken_script && (
                                                        <View style={{ backgroundColor: '#111', borderRadius: 8, padding: 12, marginTop: 4 }}>
                                                            <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6}}>
                                                                <MaterialCommunityIcons name="microphone-variant" size={14} color="#f39c12" />
                                                                <Text style={{ color: '#f39c12', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>QUÉ DECIR (GUIÓN PALABRA POR PALABRA):</Text>
                                                            </View>
                                                            <Text style={{ color: '#fff', fontSize: 13, fontStyle: 'italic', lineHeight: 20 }}>
                                                                "{a.today_plan.video_direction.spoken_script}"
                                                            </Text>
                                                        </View>
                                                    )}
                                                </View>
                                            )}

                                            {a.today_plan.best_copy && (
                                                <View style={[styles.scriptBox, { backgroundColor: '#2ecc7115', borderLeftColor: '#2ecc71', borderLeftWidth: 3 }]}>
                                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6}}>
                                                        <Text style={{ fontSize: 14 }}>✍️</Text>
                                                        <Text style={[styles.scriptLabel, { color: '#2ecc71', marginBottom: 0 }]}>COPY / CAPTION VIRAL (Listo para pegar):</Text>
                                                    </View>
                                                    <Text style={styles.scriptText}>{a.today_plan.best_copy}</Text>
                                                </View>
                                            )}

                                            {/* AMBOS: Guión Offline */}
                                            {a.today_plan.script && (
                                                <View style={styles.scriptBox}>
                                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6}}>
                                                        <MaterialCommunityIcons name="comment-text-outline" size={14} color="#e74c3c" />
                                                        <Text style={[styles.scriptLabel, { marginBottom: 0 }]}>GUIÓN OFFLINE (DECILO ASÍ):</Text>
                                                    </View>
                                                    <Text style={styles.scriptText}>"{a.today_plan.script}"</Text>
                                                </View>
                                            )}
                                            
                                            {a.today_plan.reason && !a.today_plan.video_direction && (
                                                <View style={{flexDirection: 'row', gap: 6, marginTop: 10, alignItems: 'flex-start'}}>
                                                    <Text style={{ fontSize: 14 }}>💡</Text>
                                                    <Text style={{ color: '#777', fontSize: 11, fontStyle: 'italic', flex: 1, lineHeight: 16 }}>{a.today_plan.reason}</Text>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Plan A */}
                                    {a.strategyA && (
                                        <View style={[styles.stratCard, { borderLeftColor: '#f39c12' }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <MaterialCommunityIcons name="lightning-bolt" size={16} color="#f39c12" />
                                                <Text style={[styles.stratTitle, { color: '#f39c12' }]}>{a.strategyA.name || 'PLAN A: TRACCIÓN'}</Text>
                                            </View>
                                            <Text style={styles.stratBody}>{a.strategyA.plan}</Text>
                                        </View>
                                    )}

                                    {/* Plan B */}
                                    {a.strategyB && (
                                        <View style={[styles.stratCard, { borderLeftColor: '#3498db' }]}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                                <MaterialCommunityIcons name="trending-up" size={16} color="#3498db" />
                                                <Text style={[styles.stratTitle, { color: '#3498db' }]}>{a.strategyB.name || 'PLAN B: INVERSIÓN'}</Text>
                                            </View>
                                            <Text style={styles.stratBody}>{a.strategyB.plan}</Text>
                                            {(a.strategyB.suggestedInvestment || a.strategyB.estimatedMargin) && (
                                                <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
                                                    {a.strategyB.suggestedInvestment && <Text style={styles.stratMeta}>💰 {a.strategyB.suggestedInvestment}</Text>}
                                                    {a.strategyB.estimatedMargin && <Text style={styles.stratMeta}>📈 {a.strategyB.estimatedMargin}</Text>}
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Missions */}
                                    {a.missions?.length > 0 && (
                                        <View>
                                            <Text style={styles.missionsLabel}>⚔️ MISIONES DEL DÍA</Text>
                                            {a.missions.slice(0, 3).map((m, i) => (
                                                <View key={i} style={styles.missionRow}>
                                                    <View style={[styles.mDot, { backgroundColor: m.priority === 'Alta' ? '#e74c3c' : m.priority === 'Media' ? '#f39c12' : '#2ecc71' }]} />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.mTitle}>{m.action || '—'}</Text>
                                                        <Text style={styles.mDesc}>{m.goal || ''}</Text>
                                                    </View>
                                                    <View style={styles.mBadge}><Text style={styles.mBadgeText}>{(m.type || 'general').toUpperCase()}</Text></View>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {/* Prediction */}
                                    {a.prediction && (
                                        <View style={styles.predBox}>
                                            <MaterialCommunityIcons name="crystal-ball" size={18} color="#9b59b6" />
                                            <Text style={styles.predText}>{a.prediction}</Text>
                                        </View>
                                    )}

                                    {/* Action button */}
                                    <TouchableOpacity style={styles.execBtn} onPress={() => { 
                                        setAiModalVisible(false); 
                                        const actionMap = {
                                            'create_promo': 'Promotions',
                                            'view_finances': 'Balance',
                                            'restock': 'Inventario',
                                            'manage_orders': 'Presupuestos'
                                        };
                                        const target = actionMap[a.actionId] || 'Balance';
                                        navigation.navigate(target);
                                    }}>
                                        <MaterialCommunityIcons name="lightning-bolt" size={20} color="#000" />
                                        <Text style={styles.execBtnText}>{a.actionText || 'EJECUTAR'}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.refreshBtn} onPress={() => refreshAI(true)} disabled={loadingAI}>
                                        <MaterialCommunityIcons name="refresh" size={16} color="#d4af37" />
                                        <Text style={{ color: '#d4af37', fontSize: 12, fontWeight: '700' }}>ACTUALIZAR ANÁLISIS</Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        );
    };

    const handleBarcodeScanned = ({ data }) => {
        setScanned(true);
        setIsScanning(false);
        setScanned(false);
        navigation.navigate('NewSale', { barcode: data });
    };

    const getStats = () => {
        // Get date in YYYY-MM-DD format using local time (Argentina GMT-3)
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISOTime = new Date(now.getTime() - offset).toISOString();
        const today = localISOTime.split('T')[0];
        const currentSales = (sales || []);
        
        const todaySales = currentSales.filter(s => {
            const st = (s.status || '').toLowerCase();
            return (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') && 
                   s.created_at && s.created_at.startsWith(today);
        });

        // Totals for Admin
        const revenueToday = todaySales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
        const profitToday = todaySales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);

        // Commission for Seller
        const commissionToday = todaySales.reduce((sum, s) => sum + (parseFloat(s.commission_amount) || 0), 0);
        const totalCommissionAccumulated = currentSales.reduce((sum, s) => {
            const st = (s.status || '').toLowerCase();
            if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
                return sum + (parseFloat(s.commission_amount) || 0);
            }
            return sum;
        }, 0);

        return { revenueToday, profitToday, commissionToday, totalCommissionAccumulated };
    };

    const stats = getStats();
    const formatCurrency = (val) => `$${Math.abs(val || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;

    if (isScanning) {
        return (
            <View style={styles.scannerFull}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
                />
                <View style={styles.scannerOverlay}>
                    <View style={styles.scannerOutline} />
                    <Text style={styles.scannerText}>APUNTA AL CÓDIGO DEL PRODUCTO</Text>
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
            
            <SafeAreaView style={styles.safe} edges={['top']}>
                {/* Header Superior */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => setAiModalVisible(true)} style={styles.miniAiBtn}>
                        <MaterialCommunityIcons name="brain" size={22} color="#d4af37" />
                    </TouchableOpacity>
                    
                    <View style={styles.brandContainer}>
                        <Text style={styles.brandName}>EMPIRE 👑</Text>
                        <Text style={styles.headerRole}>{(userRole === 'admin' || userRole === 'leader') ? 'Líder Supremo' : 'SOCIO ESTRATÉGICO'}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {/* BOTÓN OJO (MODO ESPÍA) - Solo para el dueño real basado en hardware */}
                        {(hardwareRole === 'admin' || hardwareRole === 'leader') && (
                            <TouchableOpacity 
                                onPress={async () => {
                                    const nextRole = (userRole === 'admin' || userRole === 'leader') ? 'seller' : 'leader';
                                    setUserRole(nextRole);
                                    await AsyncStorage.setItem('user_role', nextRole);
                                    
                                    // REFRESH AI WITH NEW ROLE IMMEDITATELY
                                    setLoadingAI(true);
                                    try {
                                        const insights = await EmpireAIService.getInsights(true, nextRole);
                                        setAiAdvice(insights);
                                    } catch (e) { console.log(e); }
                                    finally { setLoadingAI(false); }

                                    Alert.alert(
                                        nextRole === 'seller' ? '👁️ MODO SOCIO ACTIVADO' : '👑 MODO LÍDER RESTAURADO',
                                        nextRole === 'seller' ? 'Ahora ves la app exactamente como tu socio.' : 'Has recuperado el acceso total.'
                                    );
                                }} 
                                style={[
                                    styles.spyModeBtn, 
                                    userRole === 'seller' && { backgroundColor: '#d4af37', borderColor: '#fff' }
                                ]}
                            >
                                <MaterialCommunityIcons 
                                    name={userRole === 'seller' ? "eye" : "eye-outline"} 
                                    size={24} 
                                    color={userRole === 'seller' ? "#000" : "#d4af37"} 
                                />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity onPress={() => navigation.navigate('Balance')} style={styles.miniAdminBtn}>
                            <MaterialCommunityIcons name="chart-line" size={22} color="#d4af37" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    
                    {/* Stats Bricks DUAL MODE */}
                    <View style={styles.statsGrid}>
                        {(userRole === 'admin' || userRole === 'leader') ? (
                            <>
                                <View style={styles.statBrick}>
                                    <Text style={styles.statLab}>Ventas Hoy</Text>
                                    <Text style={styles.statVal}>{formatCurrency(stats.revenueToday)}</Text>
                                </View>
                                <View style={styles.statBrick}>
                                    <Text style={styles.statLab}>Ganancia Hoy</Text>
                                    <Text style={[styles.statVal, { color: '#00ff88' }]}>{formatCurrency(stats.profitToday)}</Text>
                                </View>
                            </>
                        ) : (
                            <>
                                <View style={styles.statBrick}>
                                    <Text style={styles.statLab}>Comisión Hoy</Text>
                                    <Text style={[styles.statVal, { color: '#00ff88' }]}>{formatCurrency(stats.commissionToday)}</Text>
                                </View>
                                <View style={styles.statBrick}>
                                    <Text style={styles.statLab}>Total Acumulado</Text>
                                    <Text style={styles.statVal}>{formatCurrency(stats.totalCommissionAccumulated)}</Text>
                                </View>
                            </>
                        )}
                    </View>

                    {/* AI Insight Summary */}
                    <TouchableOpacity
                        style={styles.aiInsightBox}
                        onPress={() => setAiModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.02)']}
                            style={styles.aiInsightGrad}
                        >
                            <View style={styles.aiHeader}>
                                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#d4af37" />
                                <Text style={styles.aiTitle}>EMPIRE AI COACH</Text>
                                {loadingAI
                                    ? <ActivityIndicator size="small" color="#d4af37" style={{ marginLeft: 'auto' }} />
                                    : <MaterialCommunityIcons name="chevron-right" size={18} color="#d4af3780" style={{ marginLeft: 'auto' }} />
                                }
                            </View>
                            <Text style={styles.aiText} numberOfLines={2}>
                                {aiAdvice?.summary || aiAdvice?.prediction || 'Tocá para activar el análisis estratégico...'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* AI DUAL PLANS (A/B) */}
                    <View style={styles.missionsContainer}>
                        <Text style={styles.sectionLabel}>PLAN ESTRATÉGICO {(userRole === 'admin' || userRole === 'leader') ? 'DE CAMPO' : 'DE REDES'}</Text>
                        <View style={styles.plansRow}>
                            <TouchableOpacity style={styles.planCard} onPress={() => setAiModalVisible(true)}>
                                <Text style={styles.planTag}>PLAN A</Text>
                                <Text style={styles.planName} numberOfLines={1}>{aiAdvice?.strategyA?.name || 'Cargando...'}</Text>
                                <Text style={styles.planDesc} numberOfLines={2}>{aiAdvice?.strategyA?.plan || 'Tocá para analizar'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.planCard} onPress={() => setAiModalVisible(true)}>
                                <Text style={[styles.planTag, { color: '#3498db' }]}>PLAN B</Text>
                                <Text style={styles.planName} numberOfLines={1}>{aiAdvice?.strategyB?.name || 'Cargando...'}</Text>
                                <Text style={styles.planDesc} numberOfLines={2}>{aiAdvice?.strategyB?.plan || 'Tocá para analizar'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {renderAIModal()}

                    {/* Scanner Center */}
                    <View style={styles.scannerCenter}>
                        <TouchableOpacity
                            style={styles.scannerTap}
                            onPress={async () => {
                                if (!permission || !permission.granted) {
                                    const res = await requestPermission();
                                    if (!res.granted) {
                                        Alert.alert('Permiso denegado', 'Se necesita acceso a la cámara.');
                                        return;
                                    }
                                }
                                setIsScanning(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <LinearGradient colors={['#000', '#0a0a0a']} style={styles.scannerCircle}>
                                <MaterialCommunityIcons name="qrcode-scan" size={60} color="#d4af37" />
                                <Text style={styles.scannerLabel}>LECTOR DE CÓDIGOS</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.manualEntryBtn} 
                            onPress={() => navigation.navigate('NewSale', { autoSearch: true })}
                        >
                            <MaterialCommunityIcons name="keyboard-outline" size={18} color="#555" />
                            <Text style={styles.manualEntryText}>VENTA MANUAL / BUSCADOR</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.onlineText}>EMPIRE OPERATIVE SYSTEM v2.5</Text>
                        <View style={styles.statusDot} />
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
    scroll: { flexGrow: 1, paddingHorizontal: 25, paddingBottom: 40 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, marginBottom: 20 },
    brandContainer: { alignItems: 'center' },
    brandName: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 3 },
    headerRole: { color: '#444', fontSize: 9, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    miniAiBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#151515' },
    spyModeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
    miniAdminBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#151515' },

    statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 15 },
    statBrick: { flex: 1, backgroundColor: '#080808', padding: 18, borderRadius: 18, borderWidth: 1, borderColor: '#151515' },
    statLab: { color: '#555', fontSize: 10, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
    statVal: { color: '#fff', fontSize: 22, fontWeight: '900' },

    aiInsightBox: { marginBottom: 20, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
    aiInsightGrad: { padding: 18 },
    aiHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    aiTitle: { color: '#d4af37', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },
    aiText: { color: '#ccc', fontSize: 14, lineHeight: 20, fontWeight: '500' },

    missionsContainer: { marginBottom: 30 },
    sectionLabel: { color: '#444', fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 15 },
    
    plansRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    planCard: { flex: 1, backgroundColor: '#080808', padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#151515' },
    planTag: { color: '#2ecc71', fontSize: 9, fontWeight: '900', marginBottom: 5 },
    planName: { color: '#fff', fontSize: 13, fontWeight: 'bold', marginBottom: 5 },
    planDesc: { color: '#666', fontSize: 11, lineHeight: 16 },

    missionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#080808', padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: '#151515' },
    missionIcon: { width: 45, height: 45, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    missionInfo: { flex: 1, marginLeft: 15 },
    missionTitle: { color: '#d4af37', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 2 },
    missionDesc: { color: '#eee', fontSize: 13, fontWeight: '600' },

    scannerCenter: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
    scannerTap: {
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: '#000',
        shadowColor: '#d4af37',
        shadowOpacity: 0.7,
        shadowRadius: 35,
        elevation: 15,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#d4af3730'
    },
    scannerCircle: { width: 210, height: 210, borderRadius: 105, justifyContent: 'center', alignItems: 'center', padding: 20 },
    scannerLabel: { color: '#d4af37', fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 15, letterSpacing: 1.5 },
    manualEntryBtn: { marginTop: 30, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 15, backgroundColor: '#050505', borderRadius: 15, borderWidth: 1, borderColor: '#111' },
    manualEntryText: { color: '#666', fontSize: 11, fontWeight: '900', letterSpacing: 1.5 },

    footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: 40 },
    onlineText: { color: '#222', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
    statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#2ecc71' },

    scannerFull: { flex: 1, backgroundColor: '#000' },
    scannerOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
    scannerOutline: { width: 250, height: 250, borderWidth: 2, borderColor: '#d4af37', borderRadius: 30, borderStyle: 'dashed' },
    scannerText: { color: '#fff', marginTop: 25, fontWeight: '900', fontSize: 11, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 10 },
    closeBtn: { position: 'absolute', top: 50, right: 30 },

    // ── AI Coach Modal ───────────────────────────────────────────────
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
    modalBox: { flex: 1, marginTop: 80, backgroundColor: '#0a0a0a', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 40, borderWidth: 1, borderColor: '#d4af3730', flexDirection: 'column' },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#d4af37', fontSize: 14, fontWeight: '900', letterSpacing: 2 },
    modalSubtitle: { color: '#555', fontSize: 11, marginTop: 2 },
    initBtn: { alignItems: 'center', paddingVertical: 40, gap: 10 },
    initBtnText: { color: '#d4af37', fontSize: 16, fontWeight: '700' },
    urgencyBanner: { borderRadius: 10, borderWidth: 1, padding: 12, gap: 6 },
    urgDot: { width: 10, height: 10, borderRadius: 5 },
    urgLabel: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    urgReason: { color: '#bbb', fontSize: 12, lineHeight: 18, marginLeft: 18 },
    simBox: { backgroundColor: '#0f0f0f', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#9b59b630' },
    simInput: { flex: 1, backgroundColor: '#1a1a1a', color: '#fff', borderRadius: 8, padding: 10, fontSize: 13, borderWidth: 1, borderColor: '#333' },
    simBtn: { backgroundColor: '#d4af37', borderRadius: 8, width: 42, alignItems: 'center', justifyContent: 'center' },
    misionCero: { backgroundColor: '#1a0505', borderRadius: 12, borderWidth: 1.5, borderColor: '#e74c3c50', padding: 14 },
    misionCeroTitle: { color: '#e74c3c', fontSize: 12, fontWeight: '900', letterSpacing: 1, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#e74c3c30', paddingBottom: 8 },
    scheduleBox: { backgroundColor: '#f39c1215', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#f39c12', padding: 12, marginBottom: 12 },
    scheduleLabel: { color: '#f39c12', fontSize: 10, fontWeight: '900', letterSpacing: 1, marginBottom: 4 },
    scheduleText: { color: '#fff', fontSize: 13, fontWeight: '600', lineHeight: 20 },
    videoDirBox: { backgroundColor: '#1a1b26', borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#3498db', padding: 14, marginBottom: 12 },
    scriptBox: { backgroundColor: '#e74c3c15', borderRadius: 12, padding: 14, marginTop: 0, marginBottom: 12 },
    scriptLabel: { color: '#e74c3c', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    scriptText: { color: '#fff', fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
    stratCard: { backgroundColor: '#050a0f', borderRadius: 12, borderLeftWidth: 3, padding: 14 },
    stratTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    stratBody: { color: '#bbb', fontSize: 12, lineHeight: 18 },
    stratMeta: { color: '#888', fontSize: 11, fontWeight: '600' },
    missionsLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
    missionRow: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#050505', borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a1a', gap: 10 },
    mDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
    mTitle: { color: '#fff', fontSize: 13, fontWeight: '700' },
    mDesc: { color: '#888', fontSize: 11, marginTop: 2, lineHeight: 16 },
    mBadge: { backgroundColor: '#d4af3718', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
    mBadgeText: { color: '#d4af37', fontSize: 9, fontWeight: '900' },
    predBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#1a0d2e', borderRadius: 10, padding: 12, gap: 10 },
    predText: { flex: 1, color: '#c8a8f0', fontSize: 12, fontStyle: 'italic', lineHeight: 18 },
    execBtn: { backgroundColor: '#d4af37', borderRadius: 12, padding: 16, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
    execBtnText: { color: '#000', fontSize: 15, fontWeight: '900', letterSpacing: 1 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#d4af3730' },
});
