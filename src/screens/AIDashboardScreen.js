import React, { useState, useEffect, useCallback } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    StatusBar, Dimensions, RefreshControl, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';

const { width } = Dimensions.get('window');

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (n) => `$${Math.abs(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
const fmtDelta = (n) => n >= 0 ? `+${fmt(n)}` : `-${fmt(n)}`;
const ACTION_META = {
    offline: { label: 'Calle / Físico', color: '#e67e22', icon: 'walk' },
    online:  { label: 'Redes / Content', color: '#3498db', icon: 'web' },
    hybrid:  { label: 'O2O / Callejero', color: '#9b59b6', icon: 'handshake' },
    general: { label: 'Táctico',       color: '#1abc9c', icon: 'lightning-bolt' },
};
const STATUS_META = {
    evaluated: { color: '#2ecc71', label: 'Evaluada',  icon: 'check-circle' },
    pending:   { color: '#f39c12', label: 'Pendiente', icon: 'clock-outline' },
    skipped:   { color: '#bdc3c7', label: 'Omitida',   icon: 'skip-next-circle' },
};

export default function AIDashboardScreen({ navigation }) {
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [summary, setSummary] = useState({
        total_profit: 0,
        successful: 0,
        failed: 0,
        pending: 0,
        top_type: null,
        avg_confidence: 0,
    });
    const [rankingData, setRankingData] = useState([]);  // Per action_type summary
    const [timeline, setTimeline] = useState([]);         // Recent ai_action_logs

    // ── Data Fetching ─────────────────────────────────────────────────────────
    const loadData = useCallback(async () => {
        try {
            // 1. Performance view (aggregated per action_type)
            const { data: perfData } = await supabase
                .from('ai_action_performance')
                .select('*');

            // 2. Recent action logs (timeline)
            const { data: logsData } = await supabase
                .from('ai_action_logs')
                .select('id, title, action_type, impact_predicted, executed, executed_at, evaluation_status, profit_delta, confidence_score, created_at')
                .order('created_at', { ascending: false })
                .limit(30);

            // 3. Pending actions count
            const { count: pendingCount } = await supabase
                .from('ai_action_logs')
                .select('id', { count: 'exact', head: true })
                .eq('evaluation_status', 'pending');

            // Compute summary
            if (perfData && perfData.length > 0) {
                let totalProfit = 0, totalSuccess = 0, totalFail = 0, totalConf = 0, cnt = 0;
                let topProfit = -Infinity, topType = null;

                perfData.forEach(row => {
                    const tp = parseFloat(row.total_profit_generated) || 0;
                    totalProfit += tp;
                    totalSuccess += parseInt(row.successful_actions) || 0;
                    totalFail += parseInt(row.failed_actions) || 0;
                    totalConf += parseFloat(row.avg_confidence) || 0;
                    cnt++;
                    if (tp > topProfit) { topProfit = tp; topType = row.action_type; }
                });

                setSummary({
                    total_profit: totalProfit,
                    successful: totalSuccess,
                    failed: totalFail,
                    pending: pendingCount || 0,
                    top_type: topType,
                    avg_confidence: cnt > 0 ? (totalConf / cnt).toFixed(1) : 0,
                });

                // Sort ranking by total_profit_generated DESC
                const sorted = [...perfData].sort(
                    (a, b) => (parseFloat(b.total_profit_generated) || 0) - (parseFloat(a.total_profit_generated) || 0)
                );
                setRankingData(sorted);
            } else {
                setSummary(s => ({ ...s, pending: pendingCount || 0 }));
                setRankingData([]);
            }

            setTimeline(logsData || []);
        } catch (e) {
            console.error('AIDashboard load error:', e.message);
        } finally {
            setIsLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => { loadData(); }, []));
    const onRefresh = () => { setRefreshing(true); loadData(); };

    // ── Win Rate ──────────────────────────────────────────────────────────────
    const total = summary.successful + summary.failed;
    const winRate = total > 0 ? Math.round((summary.successful / total) * 100) : null;
    const winColor = winRate >= 60 ? '#2ecc71' : winRate >= 40 ? '#f39c12' : '#e74c3c';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient colors={['#000000', '#0d0d1a']} style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>EMPIRE AI DASHBOARD</Text>
                    <Text style={styles.headerSub}>Motor de Inteligencia Adaptativa</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
                    <MaterialCommunityIcons name="refresh" size={22} color="#d4af37" />
                </TouchableOpacity>
            </LinearGradient>

            {isLoading ? (
                <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color="#d4af37" />
                    <Text style={styles.loadingText}>Analizando historial de decisiones...</Text>
                </View>
            ) : (
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={styles.scrollContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#d4af37" />}
                >
                    {/* ── KPI CARDS ─────────────────────────────────────────── */}
                    <Text style={styles.sectionLabel}>OVERVIEW DEL SISTEMA</Text>
                    <View style={styles.kpiRow}>
                        <View style={[styles.kpiCard, { borderColor: summary.total_profit >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                            <MaterialCommunityIcons name="cash-plus" size={22} color={summary.total_profit >= 0 ? '#2ecc71' : '#e74c3c'} />
                            <Text style={styles.kpiValue}>{fmtDelta(summary.total_profit)}</Text>
                            <Text style={styles.kpiLabel}>Ganancia IA Total</Text>
                        </View>
                        <View style={[styles.kpiCard, { borderColor: winColor }]}>
                            <MaterialCommunityIcons name="trophy" size={22} color={winColor} />
                            <Text style={[styles.kpiValue, { color: winColor }]}>
                                {winRate !== null ? `${winRate}%` : '—'}
                            </Text>
                            <Text style={styles.kpiLabel}>Tasa de Acierto</Text>
                        </View>
                    </View>

                    <View style={styles.kpiRow}>
                        <View style={[styles.kpiCard, { borderColor: '#3498db' }]}>
                            <MaterialCommunityIcons name="brain" size={22} color="#3498db" />
                            <Text style={styles.kpiValue}>{summary.avg_confidence}<Text style={{ fontSize: 12 }}>/10</Text></Text>
                            <Text style={styles.kpiLabel}>Confianza Media</Text>
                        </View>
                        <View style={[styles.kpiCard, { borderColor: '#f39c12' }]}>
                            <MaterialCommunityIcons name="clock-outline" size={22} color="#f39c12" />
                            <Text style={styles.kpiValue}>{summary.pending}</Text>
                            <Text style={styles.kpiLabel}>En Evaluación</Text>
                        </View>
                    </View>

                    {/* ── SCOREBOARD ────────────────────────────────────────── */}
                    <View style={styles.scoreRow}>
                        <View style={styles.scoreBox}>
                            <MaterialCommunityIcons name="arrow-up-circle" size={18} color="#2ecc71" />
                            <Text style={[styles.scoreNum, { color: '#2ecc71' }]}>{summary.successful}</Text>
                            <Text style={styles.scoreLabel}>Exitosas</Text>
                        </View>
                        <View style={styles.scoreDivider} />
                        <View style={styles.scoreBox}>
                            <MaterialCommunityIcons name="arrow-down-circle" size={18} color="#e74c3c" />
                            <Text style={[styles.scoreNum, { color: '#e74c3c' }]}>{summary.failed}</Text>
                            <Text style={styles.scoreLabel}>Fallidas</Text>
                        </View>
                        <View style={styles.scoreDivider} />
                        <View style={styles.scoreBox}>
                            <MaterialCommunityIcons name="sigma" size={18} color="#bdc3c7" />
                            <Text style={[styles.scoreNum, { color: '#bdc3c7' }]}>{summary.successful + summary.failed}</Text>
                            <Text style={styles.scoreLabel}>Total</Text>
                        </View>
                    </View>

                    {/* ── RANKING POR TIPO ──────────────────────────────────── */}
                    {rankingData.length > 0 && (
                        <>
                            <Text style={styles.sectionLabel}>RANKING DE ESTRATEGIAS</Text>
                            {rankingData.map((row, i) => {
                                const meta = ACTION_META[row.action_type] || ACTION_META.general;
                                const profit = parseFloat(row.total_profit_generated) || 0;
                                const maxProfit = parseFloat(rankingData[0].total_profit_generated) || 1;
                                const barWidth = Math.max(0, Math.min(1, profit / maxProfit));
                                return (
                                    <View key={row.action_type} style={styles.rankCard}>
                                        <View style={styles.rankHeader}>
                                            <View style={styles.rankLeft}>
                                                <Text style={styles.rankPosition}>#{i + 1}</Text>
                                                <View style={[styles.rankIcon, { backgroundColor: meta.color + '22' }]}>
                                                    <MaterialCommunityIcons name={meta.icon} size={18} color={meta.color} />
                                                </View>
                                                <Text style={styles.rankType}>{meta.label.toUpperCase()}</Text>
                                            </View>
                                            <Text style={[styles.rankProfit, { color: profit >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                                                {fmtDelta(profit)}
                                            </Text>
                                        </View>
                                        {/* Progress Bar */}
                                        <View style={styles.barTrack}>
                                            <View style={[styles.barFill, { width: `${barWidth * 100}%`, backgroundColor: meta.color }]} />
                                        </View>
                                        <View style={styles.rankStats}>
                                            <Text style={styles.rankStatText}>
                                                ✅ {row.successful_actions} exitosas  ❌ {row.failed_actions} fallidas
                                            </Text>
                                            <Text style={styles.rankStatText}>
                                                Confianza: {parseFloat(row.avg_confidence || 1).toFixed(1)}/10
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </>
                    )}

                    {/* ── TIMELINE DE ACCIONES ──────────────────────────────── */}
                    <Text style={styles.sectionLabel}>LÍNEA DE TIEMPO DE DECISIONES</Text>
                    {timeline.length === 0 ? (
                        <View style={styles.emptyCard}>
                            <MaterialCommunityIcons name="timeline-clock" size={40} color="#444" />
                            <Text style={styles.emptyText}>Aún no hay acciones registradas.</Text>
                            <Text style={styles.emptySubtext}>Ejecutá una misión desde el Home para comenzar.</Text>
                        </View>
                    ) : (
                        timeline.map((log, idx) => {
                            const meta = ACTION_META[log.action_type] || ACTION_META.general;
                            const statusMeta = STATUS_META[log.evaluation_status] || STATUS_META.pending;
                            const date = new Date(log.created_at);
                            const isLast = idx === timeline.length - 1;
                            return (
                                <View key={log.id} style={styles.timelineRow}>
                                    {/* Vertical line */}
                                    <View style={styles.timelineLineCol}>
                                        <View style={[styles.timelineDot, { backgroundColor: meta.color }]} />
                                        {!isLast && <View style={styles.timelineLineSeg} />}
                                    </View>
                                    {/* Content */}
                                    <View style={styles.timelineCard}>
                                        <View style={styles.timelineTop}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.timelineTitle} numberOfLines={1}>{log.title || '—'}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                                                    <View style={[styles.badgeTag, { backgroundColor: meta.color + '22' }]}>
                                                        <MaterialCommunityIcons name={meta.icon} size={10} color={meta.color} />
                                                        <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                                                    </View>
                                                    <View style={[styles.badgeTag, { backgroundColor: statusMeta.color + '22' }]}>
                                                        <MaterialCommunityIcons name={statusMeta.icon} size={10} color={statusMeta.color} />
                                                        <Text style={[styles.badgeText, { color: statusMeta.color }]}>{statusMeta.label}</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            {log.profit_delta !== null ? (
                                                <Text style={[styles.timelineDelta, { color: log.profit_delta >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                                                    {fmtDelta(log.profit_delta)}
                                                </Text>
                                            ) : (
                                                <Text style={styles.timelinePending}>En espera</Text>
                                            )}
                                        </View>
                                        <Text style={styles.timelineDate}>
                                            {date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            {log.confidence_score ? `  ·  Conf. ${log.confidence_score}/10` : ''}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })
                    )}

                    <View style={{ height: 40 }} />
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    header: { paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
    backBtn: { padding: 4 },
    refreshBtn: { padding: 4 },
    headerTitle: { color: '#d4af37', fontSize: 16, fontWeight: '900', letterSpacing: 1.5 },
    headerSub: { color: '#666', fontSize: 11, marginTop: 2 },

    loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 14 },
    loadingText: { color: '#666', fontSize: 13 },

    scroll: { flex: 1 },
    scrollContent: { padding: 16, paddingTop: 8 },

    sectionLabel: { color: '#555', fontSize: 11, fontWeight: '700', letterSpacing: 2, marginTop: 20, marginBottom: 12 },

    // KPI
    kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
    kpiCard: { flex: 1, backgroundColor: '#0d0d0d', borderWidth: 1, borderRadius: 12, padding: 14, alignItems: 'center', gap: 6, marginBottom: 12 },
    kpiValue: { color: 'white', fontSize: 22, fontWeight: '900' },
    kpiLabel: { color: '#666', fontSize: 11, textAlign: 'center' },

    // Scoreboard
    scoreRow: { flexDirection: 'row', backgroundColor: '#0d0d0d', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 4 },
    scoreBox: { flex: 1, alignItems: 'center', gap: 4 },
    scoreDivider: { width: 1, height: 36, backgroundColor: '#222' },
    scoreNum: { fontSize: 24, fontWeight: '900' },
    scoreLabel: { color: '#666', fontSize: 11 },

    // Ranking
    rankCard: { backgroundColor: '#0d0d0d', borderRadius: 12, padding: 14, marginBottom: 10 },
    rankHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
    rankLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    rankPosition: { color: '#444', fontSize: 13, fontWeight: 'bold', width: 20 },
    rankIcon: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
    rankType: { color: 'white', fontSize: 13, fontWeight: '700' },
    rankProfit: { fontSize: 16, fontWeight: '900' },
    barTrack: { height: 5, backgroundColor: '#1a1a1a', borderRadius: 3, marginBottom: 8 },
    barFill: { height: 5, borderRadius: 3 },
    rankStats: { flexDirection: 'row', justifyContent: 'space-between' },
    rankStatText: { color: '#555', fontSize: 11 },

    // Timeline
    timelineRow: { flexDirection: 'row', gap: 12, marginBottom: 0 },
    timelineLineCol: { width: 16, alignItems: 'center' },
    timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
    timelineLineSeg: { flex: 1, width: 2, backgroundColor: '#1a1a1a', marginTop: 4, marginBottom: -4 },
    timelineCard: { flex: 1, backgroundColor: '#0d0d0d', borderRadius: 10, padding: 12, marginBottom: 10 },
    timelineTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    timelineTitle: { color: 'white', fontSize: 13, fontWeight: '600' },
    timelineDelta: { fontSize: 14, fontWeight: '900' },
    timelinePending: { color: '#555', fontSize: 11, marginTop: 4 },
    timelineDate: { color: '#555', fontSize: 11, marginTop: 6 },
    badgeTag: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    badgeText: { fontSize: 10, fontWeight: '600' },

    // Empty
    emptyCard: { alignItems: 'center', justifyContent: 'center', padding: 40, gap: 10 },
    emptyText: { color: '#666', fontSize: 14, fontWeight: '600', textAlign: 'center' },
    emptySubtext: { color: '#444', fontSize: 12, textAlign: 'center' },
});
