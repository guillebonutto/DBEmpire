import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Modal,
    StatusBar, Dimensions, ScrollView, Alert, ActivityIndicator, TextInput, Linking, Platform
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
import * as Clipboard from 'expo-clipboard';
import CustomAlert from '../components/CustomAlert';
import { useAlert } from '../hooks/useAlert';
import { CampaignNotificationService } from '../services/CampaignNotificationService';

const getNthSunday = (year, month, n) => {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
        const date = new Date(year, month, day);
        if (date.getDay() === 0) {
            count++;
            if (count === n) return date;
        }
    }
    return new Date(year, month, 15);
};

const getSeasonalEvents = (year) => [
    { id: 'valentines', name: 'San Valentín 💖', month: 1, day: 14, isFixed: true },
    { id: 'hotsale', name: 'Hot Sale 🔥', month: 4, day: 15, isFixed: true },
    { id: 'father', name: 'Día del Padre 👔', month: 5, getNthSunday: (y) => getNthSunday(y, 5, 3), isFixed: false },
    { id: 'friend', name: 'Día del Amigo 🤝', month: 6, day: 20, isFixed: true },
    { id: 'child', name: 'Día del Niño 🎮', month: 7, getNthSunday: (y) => getNthSunday(y, 7, 3), isFixed: false },
    { id: 'mother', name: 'Día de la Madre 🌸', month: 9, getNthSunday: (y) => getNthSunday(y, 9, 3), isFixed: false },
    { id: 'cybermonday', name: 'CyberMonday ⚡', month: 10, day: 4, isFixed: true },
    { id: 'christmas', name: 'Navidad 🎄', month: 11, day: 25, isFixed: true }
];

const calculateEventDetails = (event, today, currentYear) => {
    let targetDate;
    if (event.isCustom) {
        targetDate = new Date(event.dateString + 'T00:00:00');
        if (targetDate < today) {
            targetDate.setFullYear(currentYear + 1);
        }
    } else {
        if (event.isFixed) {
            targetDate = new Date(currentYear, event.month, event.day);
        } else {
            targetDate = event.getNthSunday(currentYear);
        }
        if (targetDate < today) {
            const nextYear = currentYear + 1;
            if (event.isFixed) {
                targetDate = new Date(nextYear, event.month, event.day);
            } else {
                targetDate = event.getNthSunday(nextYear);
            }
        }
    }
    const diffTime = targetDate - today;
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return { ...event, date: targetDate, daysRemaining };
};

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
    const { showAlert, alertProps } = useAlert();
    const [completedTasks, setCompletedTasks] = useState([]);
    const [nextCampaign, setNextCampaign] = useState(null);

    const syncCompletedTasks = async (insights) => {
        if (!insights) return;
        const idsToCheck = [];
        if (insights.today_plan?.id) idsToCheck.push(insights.today_plan.id);
        if (insights.missions && Array.isArray(insights.missions)) {
            insights.missions.forEach(m => {
                if (m.id) idsToCheck.push(m.id);
            });
        }
        if (idsToCheck.length > 0) {
            const completed = await EmpireAIService.checkCompletedActions(idsToCheck);
            setCompletedTasks(completed);
        } else {
            setCompletedTasks([]);
        }
    };

    const handleToggleTask = async (id, title) => {
        if (!id) return;
        try {
            await EmpireAIService.markActionAsExecuted(id);
            setCompletedTasks(prev => [...prev, id]);
            showAlert({
                type: 'success',
                title: '¡Misión Completada!',
                message: `Completaste: "${title}"`
            });
        } catch (e) {
            console.error("Error marking task done:", e);
        }
    };

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

            // AUTO-SYNC ROLE: Solo promueve a 'leader' si el hardware lo autoriza
            // Y el rol guardado es admin/leader (nunca pisar un 'seller' elegido manualmente)
            if ((hRole === 'admin' || hRole === 'leader') && (currentRole === 'admin' || currentRole === 'leader' || !currentRole)) {
                currentRole = 'leader';
                setUserRole('leader');
                await AsyncStorage.setItem('user_role', 'leader');
            } else if (!currentRole) {
                // Sin rol guardado y sin hardware reconocido → seller por defecto
                currentRole = 'seller';
                setUserRole('seller');
            }
            // Si currentRole === 'seller', nunca lo pisamos, respetamos la elección manual

            setLoadingAI(true);
            const insights = await EmpireAIService.getInsights(false, currentRole);
            setAiAdvice(insights);
            await syncCompletedTasks(insights);

            // Cargar y calcular el evento más cercano
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const currentYear = today.getFullYear();
            let customEvents = [];
            try {
                const customData = await AsyncStorage.getItem('custom_campaign_events');
                if (customData) customEvents = JSON.parse(customData);
            } catch(e) {}
            
            const allEvents = [
                ...getSeasonalEvents(currentYear),
                ...customEvents.map(e => ({ ...e, isCustom: true }))
            ].map(e => calculateEventDetails(e, today, currentYear));
            
            allEvents.sort((a, b) => a.daysRemaining - b.daysRemaining);
            if (allEvents.length > 0) {
                setNextCampaign(allEvents[0]);
            }
            
            // Programar notificaciones locales
            CampaignNotificationService.scheduleCampaignReminders();
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
            await syncCompletedTasks(insights);
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
                                        <View style={[
                                            styles.misionCero,
                                            completedTasks.includes(a.today_plan.id) && { borderColor: '#2ecc71', backgroundColor: '#051a0b' }
                                        ]}>
                                            <Text style={[
                                                styles.misionCeroTitle,
                                                completedTasks.includes(a.today_plan.id) && { color: '#2ecc71', borderBottomColor: '#2ecc7130' }
                                            ]}>🔥 MISIÓN CERO: EL PLAN DE HOY</Text>
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

                                            {a.today_plan.id && (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.completeTaskBtn,
                                                        completedTasks.includes(a.today_plan.id) && styles.completedTaskBtnActive
                                                    ]}
                                                    onPress={() => handleToggleTask(a.today_plan.id, a.today_plan.product)}
                                                    disabled={completedTasks.includes(a.today_plan.id)}
                                                >
                                                    <MaterialCommunityIcons 
                                                        name={completedTasks.includes(a.today_plan.id) ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                                                        size={18} 
                                                        color={completedTasks.includes(a.today_plan.id) ? "#2ecc71" : "#888"} 
                                                    />
                                                    <Text style={[
                                                        styles.completeTaskBtnText,
                                                        completedTasks.includes(a.today_plan.id) && { color: '#2ecc71' }
                                                    ]}>
                                                        {completedTasks.includes(a.today_plan.id) ? "PLAN COMPLETADO" : "MARCAR PLAN COMO COMPLETADO"}
                                                    </Text>
                                                </TouchableOpacity>
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
                                                <View key={i} style={[
                                                    styles.missionRow,
                                                    completedTasks.includes(m.id) && { borderColor: '#2ecc7130', backgroundColor: '#020d05' }
                                                ]}>
                                                    <View style={[styles.mDot, { backgroundColor: m.priority === 'Alta' ? '#e74c3c' : m.priority === 'Media' ? '#f39c12' : '#2ecc71' }]} />
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[
                                                            styles.mTitle,
                                                            completedTasks.includes(m.id) && { textDecorationLine: 'line-through', color: '#666' }
                                                        ]}>{m.action || '—'}</Text>
                                                        <Text style={styles.mDesc}>{m.goal || ''}</Text>
                                                    </View>
                                                    <View style={styles.mBadge}><Text style={styles.mBadgeText}>{(m.type || 'general').toUpperCase()}</Text></View>
                                                    {m.id && (
                                                        <TouchableOpacity 
                                                            style={{ paddingLeft: 10, justifyContent: 'center' }}
                                                            onPress={() => handleToggleTask(m.id, m.action)}
                                                            disabled={completedTasks.includes(m.id)}
                                                        >
                                                            <MaterialCommunityIcons 
                                                                name={completedTasks.includes(m.id) ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"} 
                                                                size={20} 
                                                                color={completedTasks.includes(m.id) ? "#2ecc71" : "#444"} 
                                                            />
                                                        </TouchableOpacity>
                                                    )}
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

        // Get yesterday's date in local time
        const yesterdayDate = new Date(now.getTime() - offset - 86400000);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        const currentSales = (sales || []);
        
        const todaySales = currentSales.filter(s => {
            const st = (s.status || '').toLowerCase();
            const saleDate = s.paid_at || s.created_at;
            return (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') && 
                   saleDate && saleDate.startsWith(today);
        });

        const yesterdaySales = currentSales.filter(s => {
            const st = (s.status || '').toLowerCase();
            const saleDate = s.paid_at || s.created_at;
            return (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') && 
                   saleDate && saleDate.startsWith(yesterday);
        });

        // Totals for Admin/Leader Today
        const revenueToday = todaySales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
        const profitToday = todaySales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);

        // Totals for Admin/Leader Yesterday
        const revenueYesterday = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
        const profitYesterday = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);

        // Commission for Seller Today
        const commissionToday = todaySales.reduce((sum, s) => sum + (parseFloat(s.commission_amount) || 0), 0);
        // Commission for Seller Yesterday
        const commissionYesterday = yesterdaySales.reduce((sum, s) => sum + (parseFloat(s.commission_amount) || 0), 0);

        const totalCommissionAccumulated = currentSales.reduce((sum, s) => {
            const st = (s.status || '').toLowerCase();
            if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
                return sum + (parseFloat(s.commission_amount) || 0);
            }
            return sum;
        }, 0);

        // Helper to calculate percentage change
        const getPercentChange = (current, previous) => {
            if (previous === 0) {
                return current > 0 ? 100 : 0;
            }
            return Math.round(((current - previous) / previous) * 100);
        };

        const revenueChange = getPercentChange(revenueToday, revenueYesterday);
        const profitChange = getPercentChange(profitToday, profitYesterday);
        const commissionChange = getPercentChange(commissionToday, commissionYesterday);

        return { 
            revenueToday, 
            profitToday, 
            commissionToday, 
            totalCommissionAccumulated,
            revenueChange,
            profitChange,
            commissionChange
        };
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

                                    showAlert({
                                        type: 'info',
                                        title: nextRole === 'seller' ? '👁️ MODO SOCIO ACTIVADO' : '👑 MODO LÍDER RESTAURADO',
                                        message: nextRole === 'seller' ? 'Ahora ves la app exactamente como tu socio.' : 'Has recuperado el acceso total.'
                                    });
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

                        <TouchableOpacity onPress={() => navigation.navigate('Clientes')} style={styles.miniClientsBtn}>
                            <MaterialCommunityIcons name="account-group" size={22} color="#d4af37" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Combos')} style={styles.miniAdminBtn} title="Combos">
                            <MaterialCommunityIcons name="package-variant-closed" size={22} color="#d4af37" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Balance')} style={styles.miniAdminBtn}>
                            <MaterialCommunityIcons name="chart-line" size={22} color="#d4af37" />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.miniAdminBtn}>
                            <MaterialCommunityIcons name="account" size={22} color="#d4af37" />
                        </TouchableOpacity>
                    </View>
                </View>

                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    
                    {/* KPI Command Center (Bento style) */}
                    <View style={styles.kpiContainer}>
                        <View style={styles.kpiRow}>
                            <Text style={styles.kpiLabel}>{(userRole === 'admin' || userRole === 'leader') ? 'VENTAS' : 'COMISIÓN'}</Text>
                            <View style={styles.kpiRight}>
                                <Text style={styles.kpiValue}>
                                    {formatCurrency((userRole === 'admin' || userRole === 'leader') ? stats.revenueToday : stats.commissionToday)}
                                </Text>
                                <View style={[styles.trendBadge, { backgroundColor: ((userRole === 'admin' || userRole === 'leader') ? stats.revenueChange : stats.commissionChange) >= 0 ? 'rgba(0, 228, 117, 0.1)' : 'rgba(255, 71, 87, 0.1)' }]}>
                                    <MaterialCommunityIcons 
                                        name={((userRole === 'admin' || userRole === 'leader') ? stats.revenueChange : stats.commissionChange) >= 0 ? "arrow-up" : "arrow-down"} 
                                        size={10} 
                                        color={((userRole === 'admin' || userRole === 'leader') ? stats.revenueChange : stats.commissionChange) >= 0 ? "#00e475" : "#ff4757"} 
                                    />
                                    <Text style={[styles.trendText, { color: ((userRole === 'admin' || userRole === 'leader') ? stats.revenueChange : stats.commissionChange) >= 0 ? "#00e475" : "#ff4757" }]}>
                                        {Math.abs((userRole === 'admin' || userRole === 'leader') ? stats.revenueChange : stats.commissionChange)}%
                                    </Text>
                                </View>
                            </View>
                        </View>

                        <View style={styles.kpiDivider} />

                        <View style={styles.kpiRow}>
                            <Text style={styles.kpiLabel}>{(userRole === 'admin' || userRole === 'leader') ? 'GANANCIA' : 'TOTAL ACUMULADO'}</Text>
                            <View style={styles.kpiRight}>
                                <Text style={[styles.kpiValue, { color: ((userRole === 'admin' || userRole === 'leader') ? '#fff6df' : '#00ff88') }]}>
                                    {formatCurrency((userRole === 'admin' || userRole === 'leader') ? stats.profitToday : stats.totalCommissionAccumulated)}
                                </Text>
                                <View style={[styles.trendBadge, { backgroundColor: ((userRole === 'admin' || userRole === 'leader') ? stats.profitChange : 0) >= 0 ? 'rgba(0, 228, 117, 0.1)' : 'rgba(255, 71, 87, 0.1)' }]}>
                                    <MaterialCommunityIcons 
                                        name={((userRole === 'admin' || userRole === 'leader') ? stats.profitChange : 0) >= 0 ? "arrow-up" : "arrow-down"} 
                                        size={10} 
                                        color={((userRole === 'admin' || userRole === 'leader') ? stats.profitChange : 0) >= 0 ? "#00e475" : "#ff4757"} 
                                    />
                                    <Text style={[styles.trendText, { color: ((userRole === 'admin' || userRole === 'leader') ? stats.profitChange : 0) >= 0 ? "#00e475" : "#ff4757" }]}>
                                        {Math.abs((userRole === 'admin' || userRole === 'leader') ? stats.profitChange : 0)}%
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    {/* Financial Transfer Shortcut */}
                    <TouchableOpacity
                        onPress={async () => {
                            await Clipboard.setStringAsync('grb1m.uala');
                            showAlert({ type: 'success', title: '¡Alias Copiado!', message: 'El alias "grb1m.uala" se copió al portapapeles.' });
                        }}
                        style={styles.transferShortcut}
                        activeOpacity={0.7}
                    >
                        <View style={styles.transferLeft}>
                            <View style={styles.transferIconWrapper}>
                                <MaterialCommunityIcons name="bank" size={18} color="#ffe16d" />
                            </View>
                            <View style={{ marginLeft: 12 }}>
                                <Text style={styles.transferLabel}>CBU / ALIAS</Text>
                                <Text style={styles.transferValue}>grb1m.uala</Text>
                            </View>
                        </View>
                        <MaterialCommunityIcons name="content-copy" size={18} color="#aaa" />
                    </TouchableOpacity>

                    {/* AI Coach Banner */}
                    <TouchableOpacity
                        style={styles.aiCoachContainer}
                        onPress={() => setAiModalVisible(true)}
                        activeOpacity={0.8}
                    >
                        <View style={styles.aiCoachHeader}>
                            <MaterialCommunityIcons name="lightning-bolt" size={18} color="#ffe16d" />
                            <Text style={styles.aiCoachTitle}>AI COACH</Text>
                        </View>
                        <Text style={styles.aiCoachText} numberOfLines={1}>
                            {aiAdvice?.summary || aiAdvice?.prediction || 'CFO: Generando estrategias de alta fidelidad...'}
                        </Text>
                        {loadingAI ? (
                            <ActivityIndicator size="small" color="#ffe16d" style={{ marginLeft: 'auto' }} />
                        ) : (
                            <MaterialCommunityIcons name="chevron-right" size={18} color="#ffe16d" style={{ marginLeft: 'auto' }} />
                        )}
                    </TouchableOpacity>

                    {/* Campaign Banner */}
                    {nextCampaign && (
                        <TouchableOpacity
                            style={styles.campaignContainer}
                            onPress={() => navigation.navigate('CampaignPlanner')}
                            activeOpacity={0.8}
                        >
                            <View style={styles.campaignLeft}>
                                <MaterialCommunityIcons name="bell-ring" size={18} color="#ff4757" />
                                <Text style={styles.campaignTitle} numberOfLines={1}>{nextCampaign.name}</Text>
                                <View style={styles.campaignDaysBadge}>
                                    <Text style={styles.campaignDaysText}>{nextCampaign.daysRemaining}D</Text>
                                </View>
                            </View>
                            <View style={styles.campaignBtn}>
                                <Text style={styles.campaignBtnText}>LANZAR</Text>
                            </View>
                        </TouchableOpacity>
                    )}

                    {/* Field Strategic Plan (Bento style) */}
                    <View style={styles.bentoContainer}>
                        <TouchableOpacity style={styles.bentoCard} onPress={() => setAiModalVisible(true)}>
                            <View style={styles.bentoHeader}>
                                <Text style={[styles.bentoPlanTag, { color: '#00e475' }]}>PLAN A</Text>
                                <MaterialCommunityIcons name="google-analytics" size={14} color="#00e475" style={{ opacity: 0.5 }} />
                            </View>
                            <Text style={styles.bentoTitle} numberOfLines={1}>
                                {aiAdvice?.strategyA?.name?.toUpperCase() || 'LIQUIDACIÓN'}
                            </Text>
                            <View style={styles.bentoProgressBarBg}>
                                <View style={[styles.bentoProgressBar, { backgroundColor: '#00e475', width: '66%' }]} />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.bentoCard} onPress={() => setAiModalVisible(true)}>
                            <View style={styles.bentoHeader}>
                                <Text style={[styles.bentoPlanTag, { color: '#ffe16d' }]}>PLAN B</Text>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={14} color="#ffe16d" style={{ opacity: 0.5 }} />
                            </View>
                            <Text style={styles.bentoTitle} numberOfLines={1}>
                                {aiAdvice?.strategyB?.name?.toUpperCase() || 'DEMANDA'}
                            </Text>
                            <View style={styles.bentoProgressBarBg}>
                                <View style={[styles.bentoProgressBar, { backgroundColor: '#ffe16d', width: '33%' }]} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {renderAIModal()}

                    {/* QR Scanner Section (Breathing room) */}
                    <View style={styles.scannerRow}>
                        <TouchableOpacity
                            style={styles.qrCircleBtn}
                            onPress={async () => {
                                if (!permission || !permission.granted) {
                                    const res = await requestPermission();
                                    if (!res.granted) {
                                        showAlert({ type: 'error', title: 'Permiso denegado', message: 'Se necesita acceso a la cámara.' });
                                        return;
                                    }
                                }
                                setIsScanning(true);
                            }}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="qrcode-scan" size={28} color="#ffe16d" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.manualEntryRowBtn}
                            onPress={() => navigation.navigate('NewSale', { autoSearch: true })}
                            activeOpacity={0.8}
                        >
                            <MaterialCommunityIcons name="keyboard-outline" size={18} color="#ffe16d" />
                            <Text style={styles.manualEntryRowText}>VENTA MANUAL</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.footer}>
                        <Text style={styles.onlineText}>EMPIRE OPERATIVE SYSTEM v2.5</Text>
                        <View style={styles.statusDot} />
                    </View>
                </ScrollView>
                <CustomAlert {...alertProps} />
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    background: { ...StyleSheet.absoluteFillObject },
    safe: { flex: 1 },
    scroll: { flexGrow: 1, paddingHorizontal: 25, paddingBottom: 110 },

    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 20, marginBottom: 20 },
    brandContainer: { alignItems: 'center' },
    brandName: { color: '#d4af37', fontSize: 22, fontWeight: '900', letterSpacing: 3 },
    headerRole: { color: '#444', fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
    miniAiBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#151515' },
    spyModeBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(212, 175, 55, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' },
    miniClientsBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#151515' },
    miniAdminBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#080808', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#151515' },

    kpiContainer: {
        backgroundColor: '#1c1b1b',
        borderWidth: 1,
        borderColor: '#4d4732',
        borderRadius: 12,
        marginBottom: 16,
        overflow: 'hidden'
    },
    kpiRow: {
        paddingHorizontal: 16,
        paddingVertical: 18,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    kpiDivider: {
        height: 1,
        backgroundColor: '#4d4732',
        opacity: 0.8
    },
    kpiLabel: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#d0c6ab',
        letterSpacing: 1,
        textTransform: 'uppercase'
    },
    kpiRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    kpiValue: {
        color: '#fff6df',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 228, 117, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 4
    },
    trendText: {
        color: '#00e475',
        fontSize: 11,
        fontWeight: 'bold',
        marginLeft: 2
    },
    transferShortcut: {
        backgroundColor: '#1c1b1b',
        borderWidth: 1,
        borderColor: '#4d4732',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    transferLeft: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    transferIconWrapper: {
        backgroundColor: 'rgba(255, 230, 223, 0.05)',
        width: 36,
        height: 36,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    transferLabel: {
        fontSize: 12,
        fontWeight: '900',
        color: '#d0c6ab',
        letterSpacing: 1,
        opacity: 0.6
    },
    transferValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#ffe16d',
        marginTop: 1
    },
    aiCoachContainer: {
        backgroundColor: '#1a1a1a',
        borderLeftWidth: 4,
        borderLeftColor: '#ffe16d',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16
    },
    aiCoachHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: 10
    },
    aiCoachTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#ffe16d',
        letterSpacing: 1.5,
        marginLeft: 4
    },
    aiCoachText: {
        flex: 1,
        fontSize: 14,
        color: '#e5e2e1',
        fontWeight: '600'
    },
    campaignContainer: {
        backgroundColor: '#1d1212',
        borderWidth: 1,
        borderColor: 'rgba(255, 100, 100, 0.2)',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16
    },
    campaignLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10
    },
    campaignTitle: {
        color: '#ffe16d',
        fontWeight: 'bold',
        fontSize: 16,
        marginLeft: 8,
        marginRight: 8,
        flexShrink: 1
    },
    campaignDaysBadge: {
        backgroundColor: 'rgba(255, 100, 100, 0.1)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999
    },
    campaignDaysText: {
        color: '#ffb4ab',
        fontSize: 12,
        fontWeight: '900'
    },
    campaignBtn: {
        backgroundColor: '#ffe16d',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 6
    },
    campaignBtnText: {
        color: '#3a3000',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1
    },
    bentoContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 20
    },
    bentoCard: {
        flex: 1,
        backgroundColor: '#1c1b1b',
        borderWidth: 1,
        borderColor: '#4d4732',
        borderRadius: 12,
        padding: 12,
        flexDirection: 'column'
    },
    bentoHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    bentoPlanTag: {
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 1
    },
    bentoTitle: {
        color: '#e5e2e1',
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 10
    },
    bentoProgressBarBg: {
        height: 4,
        backgroundColor: '#353534',
        borderRadius: 2,
        overflow: 'hidden'
    },
    bentoProgressBar: {
        height: '100%',
        borderRadius: 2
    },
    scannerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        marginVertical: 15
    },
    qrCircleBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        borderWidth: 1,
        borderColor: 'rgba(255, 230, 223, 0.2)',
        backgroundColor: '#0e0e0e',
        justifyContent: 'center',
        alignItems: 'center',
        boxShadow: '0px 0px 15px rgba(255, 225, 109, 0.15)',
        elevation: 8
    },
    manualEntryRowBtn: {
        flex: 1,
        height: 52,
        backgroundColor: '#1c1b1b',
        borderWidth: 1,
        borderColor: '#4d4732',
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8
    },
    manualEntryRowText: {
        color: '#d0c6ab',
        fontSize: 14,
        fontWeight: 'bold',
        letterSpacing: 1.5
    },
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
    completeTaskBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
        backgroundColor: '#222',
        borderRadius: 8,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#333'
    },
    completedTaskBtnActive: {
        backgroundColor: '#0a2e16',
        borderColor: '#2ecc7150'
    },
    completeTaskBtnText: {
        color: '#aaa',
        fontSize: 11,
        letterSpacing: 1
    }
});
