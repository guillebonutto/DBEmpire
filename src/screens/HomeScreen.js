import React, { useState, useCallback, useEffect } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    StatusBar, Dimensions, Animated, ScrollView, Alert, ActivityIndicator
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

const { width } = Dimensions.get('window');

export default function HomeScreen({ navigation }) {
    const { userRole, setUserRole } = useAuthStore();
    const { sales, fetchAllData } = useFinanceStore();
    const [isScanning, setIsScanning] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [aiAdvice, setAiAdvice] = useState(null);
    const [loadingAI, setLoadingAI] = useState(false);

    const loadDashboardData = useCallback(async () => {
        try {
            await fetchAllData();
            
            setLoadingAI(true);
            const insights = await EmpireAIService.getInsights(false, userRole || 'seller');
            setAiAdvice(insights);
        } catch (error) {
            console.error('Dashboard load error:', error);
        } finally {
            setLoadingAI(false);
        }
    }, [fetchAllData]);

    useFocusEffect(
        useCallback(() => {
            loadDashboardData();
        }, [loadDashboardData])
    );

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
                    <TouchableOpacity onPress={() => navigation.navigate('AIDashboard')} style={styles.miniAiBtn}>
                        <MaterialCommunityIcons name="brain" size={22} color="#d4af37" />
                    </TouchableOpacity>
                    
                    <View style={styles.brandContainer}>
                        <Text style={styles.brandName}>EMPIRE 👑</Text>
                        <Text style={styles.headerRole}>{userRole === 'admin' ? 'Líder Supremo' : 'SOCIO ESTRATÉGICO'}</Text>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {/* BOTÓN OJO (MODO ESPÍA) - Solo para el dueño */}
                        {(userRole === 'admin' || userRole === 'seller' || !userRole) && (
                            <TouchableOpacity 
                                onPress={async () => {
                                    const nextRole = userRole === 'admin' ? 'seller' : 'admin';
                                    setUserRole(nextRole);
                                    await AsyncStorage.setItem('user_role', nextRole);
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
                        {userRole === 'admin' ? (
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
                        onPress={() => navigation.navigate('AIDashboard')}
                        activeOpacity={0.8}
                    >
                        <LinearGradient 
                            colors={['rgba(212, 175, 55, 0.15)', 'rgba(212, 175, 55, 0.02)']} 
                            style={styles.aiInsightGrad}
                        >
                            <View style={styles.aiHeader}>
                                <MaterialCommunityIcons name="lightning-bolt" size={18} color="#d4af37" />
                                <Text style={styles.aiTitle}>INTELIGENCIA TÁCTICA</Text>
                                {loadingAI && <ActivityIndicator size="small" color="#d4af37" style={{ marginLeft: 'auto' }} />}
                            </View>
                            <Text style={styles.aiText} numberOfLines={2}>
                                {aiAdvice?.summary || aiAdvice?.prediction || 'Sincronizando con el Oráculo...'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* AI DUAL PLANS (A/B) & MISSIONS */}
                    <View style={styles.missionsContainer}>
                        <Text style={styles.sectionLabel}>PLAN ESTRATÉGICO {userRole === 'admin' ? 'DE CAMPO' : 'DE REDES'}</Text>
                        
                        {/* Plan A & B Row */}
                        <View style={styles.plansRow}>
                            <TouchableOpacity style={styles.planCard} onPress={() => navigation.navigate('AIDashboard')}>
                                <Text style={styles.planTag}>PLAN A</Text>
                                <Text style={styles.planName} numberOfLines={1}>{aiAdvice?.strategyA?.name || 'Cargando'}</Text>
                                <Text style={styles.planDesc} numberOfLines={2}>{aiAdvice?.strategyA?.plan || 'Buscando estrategia viral...'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.planCard} onPress={() => navigation.navigate('AIDashboard')}>
                                <Text style={[styles.planTag, { color: '#3498db' }]}>PLAN B</Text>
                                <Text style={styles.planName} numberOfLines={1}>{aiAdvice?.strategyB?.name || 'Cargando'}</Text>
                                <Text style={styles.planDesc} numberOfLines={2}>{aiAdvice?.strategyB?.plan || 'Buscando estrategia de cierre...'}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Today's Specific Plan for Admin or Mission for Seller */}
                        {userRole === 'admin' && aiAdvice?.today_plan && (
                            <TouchableOpacity 
                                style={styles.missionCard} 
                                onPress={() => {
                                    Alert.alert(
                                        '📜 GUION TÁCTICO',
                                        `${aiAdvice.today_plan.script}\n\n📍 Lugares: ${aiAdvice.today_plan.location}`,
                                        [{ text: 'Copiar Guion', onPress: () => console.log('COPY:', aiAdvice.today_plan.script) }, { text: 'Cerrar' }]
                                    );
                                }}
                            >
                                <View style={[styles.missionIcon, { backgroundColor: '#d4af3720' }]}>
                                    <MaterialCommunityIcons name="map-marker-radius" size={24} color="#d4af37" />
                                </View>
                                <View style={styles.missionInfo}>
                                    <Text style={styles.missionTitle}>HORARIOS: {aiAdvice.today_plan.schedule}</Text>
                                    <Text style={styles.missionDesc} numberOfLines={2}>
                                        {aiAdvice.today_plan.location} - {aiAdvice.today_plan.reason}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}

                        {aiAdvice?.missions?.map((mission, idx) => (
                            <TouchableOpacity key={idx} style={styles.missionCard} onPress={() => navigation.navigate('AIDashboard')}>
                                <View style={[styles.missionIcon, { backgroundColor: '#9b59b620' }]}>
                                    <MaterialCommunityIcons 
                                        name={mission.type === 'online' ? 'web' : 'lightning-bolt'} 
                                        size={24} 
                                        color="#9b59b6" 
                                    />
                                </View>
                                <View style={styles.missionInfo}>
                                    <Text style={[styles.missionTitle, { color: '#9b59b6' }]}>MISIÓN: {mission.type?.toUpperCase()}</Text>
                                    <Text style={styles.missionDesc} numberOfLines={2}>{mission.action}</Text>
                                </View>
                            </TouchableOpacity>
                        )).slice(0, 1)}
                    </View>

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
    closeBtn: { position: 'absolute', top: 50, right: 30 }
});
