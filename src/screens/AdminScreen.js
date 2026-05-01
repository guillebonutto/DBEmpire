import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar, Dimensions, RefreshControl, Platform, Linking, InteractionManager, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomProgressChart from '../components/CustomProgressChart';
import { useProductStore } from '../store/useProductStore';
import { useFinanceStore } from '../store/useFinanceStore';
import { supabase } from '../services/supabase';
import * as Clipboard from 'expo-clipboard';
import NetInfo from '@react-native-community/netinfo';

const screenWidth = Dimensions.get('window').width;

// 🛡️ Silence React Native Web Chart warnings
if (Platform.OS === 'web') {
    const originalWarn = console.error;
    console.error = (...args) => {
        if (args[0] && typeof args[0] === 'string' &&
            (args[0].includes('Invalid DOM property `transform-origin`') ||
                args[0].includes('Unknown event handler property `onStartShouldSetResponder`'))) {
            return;
        }
        originalWarn(...args);
    };
}

export default function AdminScreen({ navigation }) {
    const [userRole, setUserRole] = useState('seller');
    const [commissionRate, setCommissionRate] = useState('10');
    const [googleKey, setGoogleKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [salesData, setSalesData] = useState({ labels: [], data: [] });
    const [progressData, setProgressData] = useState({ labels: [], datasets: [] });
    const [productData, setProductData] = useState([]);
    const [stats, setStats] = useState({
        totalSales: 0,
        totalProfit: 0,
        totalCommissions: 0,
        totalExpenses: 0,
        netProfit: 0,
        sellerCount: 0,
        debtPayments: 0,
        netCaja: 0,
    });
    const [dateFilter, setDateFilter] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewAllMonths, setViewAllMonths] = useState(false);
    const [deviceData, setDeviceData] = useState([]);
    const [profitSplit, setProfitSplit] = useState({ imperio: 70, vendedores: 30 });
    const [totalDebt, setTotalDebt] = useState(0);
    const [nextMonthlyPayment, setNextMonthlyPayment] = useState(0);
    const [aiPerformance, setAiPerformance] = useState({
        total_profit: 0,
        successful_actions: 0,
        failed_actions: 0,
        top_type: 'N/A'
    });
    const [screenReady, setScreenReady] = useState(false);

    const { sales, expenses, supplierOrders, saleItems, settings, isLoading: storeLoading, fetchAllData } = useFinanceStore();

    // ── Keep a ref copy of filter state so processLocalData can read them sync ─
    const dateFilterRef = useRef('month');
    const currentDateRef = useRef(new Date());
    const viewAllMonthsRef = useRef(false);

    // ── On mount: check role once, then let it fetch finance ──────────────────
    useEffect(() => {
        const checkRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role) setUserRole(role);
            
            // AHORA TANTO ADMIN COMO SELLER (SOCIO) TIENEN ACCESO TOTAL
            if (role !== 'admin' && role !== 'seller') {
                Alert.alert('Acceso Denegado', 'No tienes permisos de administrador.');
                navigation.replace('Main');
            }
        };
        checkRole();

        // 🚀 INSTANT READY: No esperar a que el internet responda
        setScreenReady(true);
        
        InteractionManager.runAfterInteractions(() => {
            fetchAllData(); 
            useProductStore.getState().fetchProducts();
            fetchAIPerformance();
        });
    }, []);

    const fetchAIPerformance = async () => {
        try {
            const netInfo = await NetInfo.fetch();
            if (!netInfo.isConnected) return; // Skip if offline

            // Read from our new SQL View
            const { data, error } = await supabase.from('ai_action_performance').select('*').limit(100);
            if (error) throw error;
            if (data && data.length > 0) {
                let totalProfit = 0, success = 0, fail = 0;
                let topProfit = -999999, topType = 'Ninguna';

                data.forEach(row => {
                    totalProfit += (parseFloat(row.total_profit_generated) || 0);
                    success += (parseInt(row.successful_actions) || 0);
                    fail += (parseInt(row.failed_actions) || 0);
                    if ((parseFloat(row.total_profit_generated) || 0) > topProfit) {
                        topProfit = parseFloat(row.total_profit_generated);
                        topType = row.action_type || 'Desconocida';
                    }
                });

                setAiPerformance({
                    total_profit: totalProfit,
                    successful_actions: success,
                    failed_actions: fail,
                    top_type: topType
                });
            }
        } catch (e) {
            console.log("No se pudo cargar la vista de rendimiento IA (tal vez falte crearla).", e.message);
        }
    };

    // ── Generate timeline (pure, no state reads — uses params) ─────────────────
    const generateTimeline = (filter, date, allMonths) => {
        const timeline = [];
        const now = new Date();

        if (filter === 'day') {
            for (let i = 0; i < 24; i++) {
                timeline.push({
                    key: i,
                    label: i % 4 === 0 ? `${i}:00` : '',
                    total: 0, income: 0, expense: 0
                });
            }
        } else if (filter === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const dayStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                timeline.push({
                    key: dayStr,
                    label: dayStr,
                    total: 0, income: 0, expense: 0
                });
            }
        } else if (filter === 'month') {
            if (allMonths) {
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                const tgtYear = now.getFullYear();
                months.forEach((m, index) => {
                    timeline.push({
                        key: index,
                        label: m,
                        total: 0, income: 0, expense: 0
                    });
                });
            } else {
                const tgtMonth = date.getMonth();
                const tgtYear = date.getFullYear();
                const daysInMonth = new Date(tgtYear, tgtMonth + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    const label = (i === 1 || i % 5 === 0) ? `${i}` : '';
                    timeline.push({
                        key: i,
                        label,
                        total: 0, income: 0, expense: 0
                    });
                }
            }
        } else if (filter === 'year') {
            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i;
                timeline.push({
                    key: year,
                    label: year.toString(),
                    total: 0, income: 0, expense: 0
                });
            }
        }
        return timeline;
    };

    // ── Get date range for a given filter/date combo ───────────────────────────
    const getDateRange = (filter, date, allMonths) => {
        const now = new Date();
        let startMs, endMs;

        if (filter === 'day') {
            startMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        } else if (filter === 'week') {
            startMs = now.getTime() - 7 * 24 * 60 * 60 * 1000;
        } else if (filter === 'month') {
            if (allMonths) {
                startMs = new Date(now.getFullYear(), 0, 1).getTime();
                // End of Dec 31st, 23:59:59.999
                endMs = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
            } else {
                startMs = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
                endMs = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
            }
        } else if (filter === 'year') {
            startMs = new Date(now.getFullYear(), 0, 1).getTime();
            endMs = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999).getTime();
        } else {
            startMs = 0; // All time
            endMs = now.getTime();
        }
        return { startMs, endMs };
    };

    // ── Settings + Deuda (top-level, no depende del filtro de fecha) ─────────
    const calculateTopLevelStats = useCallback(() => {
        if (!settings || !supplierOrders) return;
        
        const comm = settings.find(s => s.key === 'commission_rate');
        const key = settings.find(s => s.key === 'google_api_key');
        if (comm) setCommissionRate((parseFloat(comm.value) * 100).toString());
        if (key) setGoogleKey(key.value);
        
        const splitImp = settings.find(s => s.key === 'profit_split_imperio');
        const splitVend = settings.find(s => s.key === 'profit_split_vendedores');
        if (splitImp && splitVend) {
            setProfitSplit({ imperio: parseInt(splitImp.value) || 70, vendedores: parseInt(splitVend.value) || 30 });
        }

        let debt = 0, monthly = 0;
        supplierOrders.forEach(order => {
            const isConsignment = (order.status || '').toLowerCase().includes('consign');
            
            // Consignments are full debts until paid/received
            if (isConsignment && order.status !== 'received') {
                debt += (parseFloat(order.total_cost) || 0);
                return;
            }

            const totalCost = parseFloat(order.total_amount || order.total_cost || 0);
            const totalInst = parseInt(order.installments_total || 1);
            const paidInst = parseInt(order.installments_paid || 0);

            if (paidInst < totalInst) {
                const perIns = totalCost / totalInst;
                debt += perIns * (totalInst - paidInst);
                monthly += perIns;
            }
        });
        setTotalDebt(debt);
        setNextMonthlyPayment(monthly);
    }, [settings, supplierOrders]);

    // ── Process charts/stats from local cache — SYNCHRONOUS ───────────────────
    const processAndCalculateAllData = useCallback((currentFilter, currentDateObj, currentViewAllMonths) => {
        if (!sales || !expenses || !saleItems || !supplierOrders || !settings) return;
        const { startMs, endMs } = getDateRange(currentFilter, currentDateObj, currentViewAllMonths);

        // Split sales/expenses into prev (before period) and current (in period)
        let prevIncome = 0, prevExpCaja = 0, prevExpROI = 0;
        const currentSales = [];
        const currentExpenses = [];

        for (const s of (sales || [])) {
            const sMs = new Date(s.created_at).getTime();
            if (sMs < startMs) {
                const st = (s.status || '').toLowerCase();
                if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
                    prevIncome += (parseFloat(s.total_amount) || 0);
                }
            } else if (!endMs || sMs <= endMs) {
                currentSales.push(s);
            }
        }

        for (const e of (expenses || [])) {
            const eMs = new Date(e.created_at).getTime();
            const val = parseFloat(e.amount) || 0;
            const isDebtPayment = e.category === 'Pago de Deuda';
            const desc = (e.description || '').toLowerCase();
            const isInitialCreditStock = desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado');

            if (eMs < startMs) {
                if (!isInitialCreditStock) prevExpCaja += val;
                // ROI histórico: incluye el costo de compras (consolidado) pero no las cuotas (deuda)
                if (!isDebtPayment) prevExpROI += val;
            } else if (!endMs || eMs <= endMs) {
                currentExpenses.push(e);
            }
        }

        const histBalCaja = prevIncome - prevExpCaja;
        // ROI usa el ingreso total para recuperar la gigantesca inversión de stock inicial
        const histBalROI = prevIncome - prevExpROI;

        // Finalized sales only
        const finalSales = currentSales.filter(s => {
            const st = (s.status || '').toLowerCase();
            return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
        });

        // ── Charts — build index Map for O(1) bucket lookup ────────────────────
        const timeline = generateTimeline(currentFilter, currentDateObj, currentViewAllMonths);
        const bucketIndex = new Map();
        timeline.forEach((t, i) => bucketIndex.set(t.key, i));

        finalSales.forEach(sale => {
            const d = new Date(sale.created_at);
            const key = getBucketKey(d, currentFilter, currentViewAllMonths);
            const idx = bucketIndex.get(key);
            if (idx !== undefined) {
                const amount = parseFloat(sale.total_amount) || 0;
                timeline[idx].total += amount;
                timeline[idx].income += amount; // ROI chart usa ingresos totales (revenue) para matar los gastos de stock
            }
        });

        currentExpenses.forEach(e => {
            const d = new Date(e.created_at);
            const key = getBucketKey(d, currentFilter, currentViewAllMonths);
            const idx = bucketIndex.get(key);
            // Exclude debt payments AND bank yields from the ROI expense chart bars (stock expenses are included)
            const skip = e.category === 'Pago de Deuda' || e.category === 'Rendimiento Bancario';
            if (idx !== undefined && !skip) timeline[idx].expense += (parseFloat(e.amount) || 0);
        });

        setSalesData({
            labels: timeline.map(t => t.label),
            data: timeline.map(t => t.total)
        });

        let runningTotal = histBalROI;
        const netData = timeline.map(t => {
            runningTotal += t.income - t.expense;
            return runningTotal;
        });
        setProgressData({
            labels: timeline.map(t => t.label),
            datasets: [{
                data: netData.length > 0 ? netData : [0],
                color: (opacity = 1) => runningTotal >= 0 ? `rgba(46, 204, 113, ${opacity})` : `rgba(231, 76, 60, ${opacity})`,
                strokeWidth: 2
            }],
            legend: ["Balance ROI (Progreso Acumulado)"]
        });

        // ── Stats ──────────────────────────────────────────────────────────────
        const totalSales = finalSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
        const grossProfit = finalSales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);
        const totalCommissions = finalSales.reduce((sum, s) => sum + (parseFloat(s.commission_amount) || 0), 0);

        // ── Expense split ──────────────────────────────────────────────
        // Rules:
        //   'Pago de Deuda'       -> Caja only (not ROI)
        //   'Rendimiento Bancario'-> Caja positive income (not ROI, not an expense)
        //   everything else       -> both Caja AND ROI
        const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
        const isBankYield     = (e) => e.category === 'Rendimiento Bancario';

        const operatingExpenses = currentExpenses.reduce((sum, e) =>
            isDebtPayment(e) || isBankYield(e) ? sum : sum + (parseFloat(e.amount) || 0), 0);
        const debtPayments      = currentExpenses.reduce((sum, e) =>
            isDebtPayment(e) ? sum + (parseFloat(e.amount) || 0) : sum, 0);
        const bankYields        = currentExpenses.reduce((sum, e) =>
            isBankYield(e) ? sum + (parseFloat(e.amount) || 0) : sum, 0);
        const totalExpensesCaja = operatingExpenses + debtPayments; // yields are income, not expense

        // ROI balance: histórico (ingresos - gastos incl. stock) + current ingresos - current operatingExp
        const netCaja   = histBalCaja + totalSales + bankYields - totalExpensesCaja;
        const netProfit = histBalROI  + totalSales - operatingExpenses;

        // ── Advanced metrics ───────────────────────────────────────────────────
        const margin = totalSales > 0 ? (grossProfit / totalSales) * 100 : 0;
        const operatingRatio = grossProfit > 0 ? (operatingExpenses / grossProfit) * 100 : 0;

        // ── Smart alert flags ──────────────────────────────────────────────────
        const alerts = [];
        if (operatingExpenses > grossProfit && grossProfit > 0)
            alerts.push({ type: 'critical', msg: '💣 Gastos operativos superan el margen bruto. El negocio está en pérdida operativa.' });
        if (margin > 0 && margin < 20)
            alerts.push({ type: 'warning', msg: `⚠️ Margen bruto bajo (${margin.toFixed(1)}%). Revisá precios de venta o costos.` });
        if (operatingRatio > 80 && grossProfit > 0)
            alerts.push({ type: 'warning', msg: `🔥 Los gastos operativos consumen el ${operatingRatio.toFixed(0)}% de tu margen. ¿Podés reducir alguno?` });
        if (netCaja < 0 && netProfit > 0)
            alerts.push({ type: 'info', msg: '💡 Tu ROI es positivo pero la Caja está en rojo. Estás pagando deudas más rápido de lo que cobrás.' });
        if (netCaja < 0 && netProfit < 0)
            alerts.push({ type: 'critical', msg: '🚨 Tanto el ROI como la Caja están en negativo. Prioridad máxima: reducir egresos.' });
        if (bankYields > 0)
            alerts.push({ type: 'info', msg: `💰 Rendimientos bancarios del período: $${bankYields.toFixed(2)} (no afectan ROI, suman a Caja).` });

        setStats({ totalSales, totalProfit: grossProfit, totalCommissions, totalExpenses: operatingExpenses, debtPayments, bankYields, netCaja, netProfit, margin, operatingRatio, alerts, sellerCount: 1 });

        // ── Device breakdown ───────────────────────────────────────────────────
        const deviceMap = {};
        finalSales.forEach(s => {
            const sig = s.device_sig || 'Otros / Manual';
            if (!deviceMap[sig]) deviceMap[sig] = { total: 0, commissions: 0 };
            deviceMap[sig].total += (parseFloat(s.total_amount) || 0);
            deviceMap[sig].commissions += (parseFloat(s.commission_amount) || 0);
        });
        setDeviceData(Object.keys(deviceMap).map(sig => ({
            sig, total: deviceMap[sig].total, commissions: deviceMap[sig].commissions
        })).sort((a, b) => b.total - a.total));

        // ── Products ───────────────────────────────────────────────────────────
        const currentSaleItems = saleItems.filter(item => finalSales.some(s => s.id === item.sale_id));
        if (currentSaleItems.length > 0) {
            const productMap = {};
            currentSaleItems.forEach(item => {
                const name = item.products?.name || 'Desconocido';
                if (!productMap[name]) productMap[name] = 0;
                productMap[name] += item.quantity;
            });
            const colors = ['#d4af37', '#2ecc71', '#e74c3c', '#a29bfe', '#fd79a8'];
            setProductData(Object.entries(productMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, quantity], i) => ({ name, quantity, color: colors[i], legendFontColor: '#888', legendFontSize: 12 }))
            );
        } else {
            setProductData([]);
        }
    }, [sales, expenses, saleItems, supplierOrders, settings]);

    // ── Watch store data changes to process derivatives automatically ──────────
    useEffect(() => {
        if (!sales || !expenses || !saleItems || !supplierOrders || !settings) return;
        calculateTopLevelStats();
        processAndCalculateAllData(dateFilterRef.current, currentDateRef.current, viewAllMonthsRef.current);
    }, [sales, expenses, saleItems, supplierOrders, settings]);

    const getBucketKey = (date, filter, allMonths) => {
        if (filter === 'day') {
            return date.getHours();
        } else if (filter === 'week') {
            return date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        } else if (filter === 'month') {
            if (allMonths) {
                return date.getMonth();
            }
            return date.getDate();
        } else if (filter === 'year') {
            return date.getFullYear();
        }
        return null;
    };

    const changeFilter = (newFilter, resetDate = false) => {
        setDateFilter(newFilter);
        dateFilterRef.current = newFilter;
        if (resetDate) {
            setCurrentDate(new Date());
            currentDateRef.current = new Date();
        }
        processAndCalculateAllData(newFilter, resetDate ? new Date() : currentDateRef.current, viewAllMonthsRef.current);
    };

    const changeMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + direction);
        setCurrentDate(newDate);
        currentDateRef.current = newDate;
        processAndCalculateAllData(dateFilterRef.current, newDate, viewAllMonthsRef.current);
    };

    const toggleAllMonths = () => {
        const newState = !viewAllMonths;
        setViewAllMonths(newState);
        viewAllMonthsRef.current = newState;
        processAndCalculateAllData(dateFilterRef.current, currentDateRef.current, newState);
    };

    const forceRefresh = useCallback(() => {
        setLoading(true);
        fetchAllData(true);
        fetchAIPerformance();
        // processAndCalculateAllData will be called by the useEffect after fetchAllData updates the store
    }, [fetchAllData]);

    const handleWhatsAppPress = async (text) => {
        const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(text)}`;
        try {
            const supported = await Linking.canOpenURL(whatsappUrl);
            if (supported) {
                await Linking.openURL(whatsappUrl);
            } else {
                await Clipboard.setStringAsync(text);
                Alert.alert('Copiado al portapapeles', 'WhatsApp no está instalado. El mensaje ha sido copiado al portapapeles.');
            }
        } catch (error) {
            console.error('Error al abrir WhatsApp o copiar al portapapeles:', error);
            await Clipboard.setStringAsync(text);
            Alert.alert('Copiado al portapapeles', 'Ocurrió un error. El mensaje ha sido copiado al portapapeles.');
        }
    };

    const formatCurrency = (value) => {
        if (value === null || value === undefined) return '$0';
        return `$${Number(value).toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
    };

    const getProfitColor = (value) => value >= 0 ? '#2ecc71' : '#e74c3c';

    const chartConfig = {
        backgroundColor: '#1e2923',
        backgroundGradientFrom: '#1e2923',
        backgroundGradientTo: '#08130D',
        decimalPlaces: 0, // optional, defaults to 2dp
        color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
        style: {
            borderRadius: 16
        },
        propsForDots: {
            r: '6',
            strokeWidth: '2',
            stroke: '#d4af37'
        }
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="light-content" backgroundColor="#1a1a1a" />
            <LinearGradient
                colors={['#1a1a1a', '#333333']}
                style={styles.headerContainer}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Panel de Administración</Text>
                    <View style={{ width: 24 }} />

                </View>

                <View style={styles.filterContainer}>
                    <TouchableOpacity style={[styles.filterBtn, dateFilter === 'day' && styles.filterBtnActive]} onPress={() => changeFilter('day', true)}>
                        <Text style={[styles.filterText, dateFilter === 'day' && styles.filterTextActive]}>DÍA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.filterBtn, dateFilter === 'week' && styles.filterBtnActive]} onPress={() => changeFilter('week', true)}>
                        <Text style={[styles.filterText, dateFilter === 'week' && styles.filterTextActive]}>SEMANA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.filterBtn, dateFilter === 'month' && styles.filterBtnActive]} onPress={() => changeFilter('month')}>
                        <Text style={[styles.filterText, dateFilter === 'month' && styles.filterTextActive]}>MES</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.filterBtn, dateFilter === 'year' && styles.filterBtnActive]} onPress={() => changeFilter('year', true)}>
                        <Text style={[styles.filterText, dateFilter === 'year' && styles.filterTextActive]}>AÑO</Text>
                    </TouchableOpacity>
                </View>

                {dateFilter === 'month' && (
                    <View style={styles.monthNavContainer}>
                        {!viewAllMonths && (
                            <View style={styles.monthSelector}>
                                <TouchableOpacity onPress={() => changeMonth(-1)} style={styles.navArrow}>
                                    <MaterialCommunityIcons name="chevron-left" size={30} color="#d4af37" />
                                </TouchableOpacity>
                                <Text style={styles.monthLabel}>
                                    {currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase()}
                                </Text>
                                <TouchableOpacity onPress={() => changeMonth(1)} style={styles.navArrow}>
                                    <MaterialCommunityIcons name="chevron-right" size={30} color="#d4af37" />
                                </TouchableOpacity>
                            </View>
                        )}
                        <TouchableOpacity style={styles.generalToggle} onPress={toggleAllMonths}>
                            <MaterialCommunityIcons name={viewAllMonths ? "checkbox-marked" : "checkbox-blank-outline"} size={24} color="#d4af37" />
                            <Text style={styles.generalToggleText}>Ver Año Completo</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={loading || storeLoading} onRefresh={forceRefresh} tintColor="#d4af37" />}
            >
                {!screenReady ? (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 }}>
                        <ActivityIndicator size="large" color="#d4af37" />
                        <Text style={{ color: '#888', marginTop: 15, fontWeight: 'bold' }}>CARGANDO INTELIGENCIA FINANCIERA...</Text>
                    </View>
                ) : (
                    <>
                        {/* Stats Cards */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="cash-multiple" size={28} color="#d4af37" />
                        <Text style={styles.statValue}>{formatCurrency(stats.totalSales)}</Text>
                        <Text style={styles.statLabel}>Ventas</Text>
                    </View>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="currency-usd" size={28} color="#2ecc71" />
                        <Text style={styles.statValue}>{formatCurrency(stats.totalProfit)}</Text>
                        <Text style={styles.statLabel}>Margen Productos</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="cash-minus" size={28} color="#e74c3c" />
                        <Text style={styles.statValue}>{formatCurrency(stats.totalExpenses)}</Text>
                        <Text style={styles.statLabel}>Gastos Operativos</Text>
                    </View>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="credit-card-minus" size={28} color="#f39c12" />
                        <Text style={[styles.statValue, { color: '#f39c12' }]}>
                            {formatCurrency(stats.debtPayments)}
                        </Text>
                        <Text style={[styles.statLabel, { color: '#f39c12' }]}>Deudas Pagadas</Text>
                    </View>
                </View>

                <View style={[styles.statsGrid, { marginTop: 5 }]}>
                    <View style={[styles.statCard, { borderColor: '#3498db' }]}>
                        <MaterialCommunityIcons name="safe" size={28} color="#3498db" />
                        <Text style={[styles.statValue, { color: '#3498db' }]}>
                            {formatCurrency(stats.netCaja)}
                        </Text>
                        <Text style={[styles.statLabel, { color: '#3498db' }]}>Caja Fuerte (Liquidez)</Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: getProfitColor(stats.netProfit) }]}>
                        <MaterialCommunityIcons name="scale-balance" size={28} color={getProfitColor(stats.netProfit)} />
                        <Text style={[styles.statValue, { color: getProfitColor(stats.netProfit) }]}>
                            {formatCurrency(stats.netProfit)}
                        </Text>
                        <Text style={[styles.statLabel, { color: getProfitColor(stats.netProfit) }]}>Rentabilidad (ROI)</Text>
                    </View>
                </View>

                {/* ── Smart Alert Panel ───────────────────────────────────── */}
                {stats.alerts && stats.alerts.length > 0 && (
                    <View style={{ marginHorizontal: 15, marginBottom: 15, gap: 8 }}>
                        <Text style={[styles.sectionTitle, { marginBottom: 4 }]}>⚡ ALERTAS DEL IMPERIO</Text>
                        {stats.alerts.map((alert, idx) => (
                            <View key={idx} style={[
                                styles.alertBanner,
                                alert.type === 'critical' ? styles.alertCritical :
                                alert.type === 'warning' ? styles.alertWarning :
                                styles.alertInfo
                            ]}>
                                <Text style={[
                                    styles.alertText,
                                    alert.type === 'critical' ? { color: '#ff6b6b' } :
                                    alert.type === 'warning' ? { color: '#f39c12' } :
                                    { color: '#74b9ff' }
                                ]}>{alert.msg}</Text>
                            </View>
                        ))}
                    </View>
                )}

                {/* ── Margin & Efficiency row ─────────────────────────────── */}
                {stats.totalSales > 0 && (
                    <View style={[styles.statsGrid, { marginTop: 5, marginBottom: 5 }]}>
                        <View style={[styles.statCard, { borderColor: stats.margin >= 30 ? '#2ecc71' : stats.margin >= 15 ? '#f39c12' : '#e74c3c' }]}>
                            <MaterialCommunityIcons name="percent" size={28} color={stats.margin >= 30 ? '#2ecc71' : stats.margin >= 15 ? '#f39c12' : '#e74c3c'} />
                            <Text style={[styles.statValue, { color: stats.margin >= 30 ? '#2ecc71' : stats.margin >= 15 ? '#f39c12' : '#e74c3c' }]}>
                                {stats.margin?.toFixed(1)}%
                            </Text>
                            <Text style={[styles.statLabel, { color: '#888' }]}>Margen Bruto</Text>
                        </View>
                        <View style={[styles.statCard, { borderColor: stats.operatingRatio <= 50 ? '#2ecc71' : stats.operatingRatio <= 80 ? '#f39c12' : '#e74c3c' }]}>
                            <MaterialCommunityIcons name="gauge" size={28} color={stats.operatingRatio <= 50 ? '#2ecc71' : stats.operatingRatio <= 80 ? '#f39c12' : '#e74c3c'} />
                            <Text style={[styles.statValue, { color: stats.operatingRatio <= 50 ? '#2ecc71' : stats.operatingRatio <= 80 ? '#f39c12' : '#e74c3c' }]}>
                                {stats.operatingRatio?.toFixed(0)}%
                            </Text>
                            <Text style={[styles.statLabel, { color: '#888' }]}>Eficiencia Op.</Text>
                        </View>
                    </View>
                )}

                {/* Quick Access Section */}
                <View style={styles.quickAccessSection}>
                    <Text style={styles.sectionTitle}>ACCESO RÁPIDO</Text>

                    <Text style={styles.categoryLabel}>👑 Operaciones del Imperio</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('NewSale', { autoSearch: true })}>
                            <MaterialCommunityIcons name="text-search" size={32} color="#d4af37" />
                            <Text style={styles.quickAccessTitle}>Venta</Text>
                            <Text style={styles.quickAccessSubtitle}>Manual</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Sales')}>
                            <MaterialCommunityIcons name="history" size={32} color="#bdc3c7" />
                            <Text style={styles.quickAccessTitle}>Historial</Text>
                            <Text style={styles.quickAccessSubtitle}>Ventas</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Inventario')}>
                            <MaterialCommunityIcons name="package-variant-closed" size={32} color="#e67e22" />
                            <Text style={styles.quickAccessTitle}>Inventario</Text>
                            <Text style={styles.quickAccessSubtitle}>Stock</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.categoryLabel}>💰 Gestión Financiera</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Expenses')}>
                            <MaterialCommunityIcons name="cash-minus" size={32} color="#e74c3c" />
                            <Text style={styles.quickAccessTitle}>Gastos</Text>
                            <Text style={styles.quickAccessSubtitle}>Operativos</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('SupplierOrders')}>
                            <MaterialCommunityIcons name="cube-send" size={32} color="#3498db" />
                            <Text style={styles.quickAccessTitle}>Compras</Text>
                            <Text style={styles.quickAccessSubtitle}>Proveedores</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Suppliers')}>
                            <MaterialCommunityIcons name="factory" size={32} color="#d4af37" />
                            <Text style={styles.quickAccessTitle}>Proveedores</Text>
                            <Text style={styles.quickAccessSubtitle}>Contactos</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.categoryLabel}>📊 Inteligencia de Negocio</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Reports')}>
                            <MaterialCommunityIcons name="chart-bar" size={32} color="#f1c40f" />
                            <Text style={styles.quickAccessTitle}>Reportes</Text>
                            <Text style={styles.quickAccessSubtitle}>Métricas</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Analytics')}>
                            <MaterialCommunityIcons name="google-analytics" size={32} color="#9b59b6" />
                            <Text style={styles.quickAccessTitle}>Analíticas</Text>
                            <Text style={styles.quickAccessSubtitle}>Generales</Text>
                        </TouchableOpacity>
                        {userRole === 'admin' && (
                            <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('ProductTester')}>
                                <MaterialCommunityIcons name="flask" size={32} color="#e74c3c" />
                                <Text style={styles.quickAccessTitle}>Testing</Text>
                                <Text style={styles.quickAccessSubtitle}>Productos</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('RestockAdvisor')}>
                            <MaterialCommunityIcons name="truck-delivery" size={32} color="#1abc9c" />
                            <Text style={styles.quickAccessTitle}>Restock</Text>
                            <Text style={styles.quickAccessSubtitle}>Advisor</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Promotions')}>
                            <MaterialCommunityIcons name="sale" size={32} color="#e91e63" />
                            <Text style={styles.quickAccessTitle}>Promociones</Text>
                            <Text style={styles.quickAccessSubtitle}>Activas</Text>
                        </TouchableOpacity>
                        {userRole === 'admin' && (
                            <TouchableOpacity style={[styles.quickAccessCard, { borderColor: '#d4af37', borderWidth: 1.5 }]} onPress={() => navigation.navigate('AIDashboard')}>
                                <MaterialCommunityIcons name="brain" size={32} color="#d4af37" />
                                <Text style={[styles.quickAccessTitle, { color: '#d4af37' }]}>Empire AI</Text>
                                <Text style={styles.quickAccessSubtitle}>Dashboard</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.categoryLabel}>⚙️ Configuración y Herramientas</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Settings')}>
                            <MaterialCommunityIcons name="cog" size={32} color="#d4af37" />
                            <Text style={styles.quickAccessTitle}>Ajustes</Text>
                            <Text style={styles.quickAccessSubtitle}>Generales</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Users')}>
                            <MaterialCommunityIcons name="account-group" size={32} color="#95a5a6" />
                            <Text style={styles.quickAccessTitle}>Usuarios</Text>
                            <Text style={styles.quickAccessSubtitle}>Roles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('Backup')}>
                            <MaterialCommunityIcons name="cloud-upload" size={32} color="#3498db" />
                            <Text style={styles.quickAccessTitle}>Backup</Text>
                            <Text style={styles.quickAccessSubtitle}>Datos</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* AI Performance Section - ADMIN ONLY */}
                {userRole === 'admin' && (
                    <View style={styles.aiPerformanceSection}>
                        <Text style={styles.sectionTitle}>RENDIMIENTO EMPIRE AI</Text>
                        <View style={styles.aiStatsGrid}>
                            <View style={styles.aiStatCard}>
                                <MaterialCommunityIcons name="robot-happy" size={24} color="#d4af37" />
                                <Text style={styles.aiStatValue}>{formatCurrency(aiPerformance.total_profit)}</Text>
                                <Text style={styles.aiStatLabel}>Ganancia Generada</Text>
                            </View>
                            <View style={styles.aiStatCard}>
                                <MaterialCommunityIcons name="check-circle-outline" size={24} color="#2ecc71" />
                                <Text style={styles.aiStatValue}>{aiPerformance.successful_actions}</Text>
                                <Text style={styles.aiStatLabel}>Acciones Exitosas</Text>
                            </View>
                            <View style={styles.aiStatCard}>
                                <MaterialCommunityIcons name="close-circle-outline" size={24} color="#e74c3c" />
                                <Text style={styles.aiStatValue}>{aiPerformance.failed_actions}</Text>
                                <Text style={styles.aiStatLabel}>Acciones Fallidas</Text>
                            </View>
                            <View style={styles.aiStatCard}>
                                <MaterialCommunityIcons name="star-four-points-outline" size={24} color="#f1c40f" />
                                <Text style={styles.aiStatValue}>{aiPerformance.top_type}</Text>
                                <Text style={styles.aiStatLabel}>Acción Más Rentable</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Charts Section */}
                <View style={styles.chartSection}>
                    <Text style={styles.sectionTitle}>GRÁFICOS Y ANÁLISIS</Text>

                    <Text style={styles.chartTitle}>TENDENCIA DE VENTAS</Text>
                    {salesData.data && salesData.data.length > 0 && salesData.data.some(d => d > 0) ? (
                        <LineChart
                            data={{ labels: salesData.labels, datasets: [{ data: salesData.data }] }}
                            width={screenWidth - 80}
                            height={250}
                            chartConfig={{
                                backgroundColor: '#1e1e1e',
                                backgroundGradientFrom: '#1e1e1e',
                                backgroundGradientTo: '#1e1e1e',
                                backgroundGradientFromOpacity: 0,
                                backgroundGradientToOpacity: 0,
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(212, 175, 55, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(150, 150, 150, ${opacity})`,
                                style: { borderRadius: 16 },
                                propsForDots: { r: '4', strokeWidth: '2', stroke: '#d4af37' },
                                fillShadowGradient: '#d4af37',
                                fillShadowGradientOpacity: 0.4,
                                useShadowColorFromDataset: false,
                                paddingRight: 35,
                                propsForBackgroundLines: { strokeDasharray: '', stroke: '#222' }
                            }}
                            bezier
                            style={styles.chart}
                        />
                    ) : (
                        <Text style={styles.noDataText}>No hay datos suficientes para mostrar</Text>
                    )}

                    <Text style={styles.chartTitle}>RECUPERACIÓN DE INVERSIÓN (ROI)</Text>
                    {progressData.datasets?.length > 0 ? (
                        <CustomProgressChart progressData={progressData} />
                    ) : (
                        <Text style={styles.noDataText}>No hay datos suficientes</Text>
                    )}

                    <Text style={styles.chartTitle}>TOP 5 PRODUCTOS MÁS VENDIDOS</Text>
                    {productData.length > 0 ? (
                        <PieChart
                            data={productData}
                            width={screenWidth - 100}
                            height={220}
                            chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
                            accessor="quantity"
                            backgroundColor="transparent"
                            paddingLeft="0"
                            absolute
                            style={{ alignSelf: 'center' }}
                        />
                    ) : (
                        <Text style={styles.noDataText}>No hay datos de productos disponibles</Text>
                    )}

                    <Text style={styles.chartTitle}>DESEMPEÑO POR ALIADO (HARDWARE)</Text>
                    {deviceData.length > 0 ? (
                        <View>
                            {deviceData.map((d, i) => (
                                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i === deviceData.length - 1 ? 0 : 1, borderBottomColor: '#222' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="cellphone-check" size={18} color="#d4af37" style={{ marginRight: 10 }} />
                                        <View>
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{d.sig}</Text>
                                            <Text style={{ color: '#666', fontSize: 11 }}>Comisión: {formatCurrency(d.commissions)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: '#d4af37', fontWeight: '900' }}>{formatCurrency(d.total)}</Text>
                                        <Text style={{ color: '#444', fontSize: 10, fontWeight: '700' }}>VENTAS</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.noDataText}>Sin datos de dispositivos</Text>
                    )}


                </View>

                {/* Settings Section */}
                <View style={styles.settingsSection}>
                    <Text style={styles.sectionTitle}>AJUSTES RÁPIDOS</Text>
                    <View style={styles.settingItem}>
                        <Text style={styles.settingLabel}>Tasa de Comisión (%)</Text>
                        <TextInput
                            style={styles.settingInput}
                            value={commissionRate}
                            onChangeText={setCommissionRate}
                            keyboardType="numeric"
                            placeholder="Ej: 10"
                            placeholderTextColor="#888"
                        />
                    </View>
                    <View style={styles.settingItem}>
                        <Text style={styles.settingLabel}>Google API Key</Text>
                        <TextInput
                            style={styles.settingInput}
                            value={googleKey}
                            onChangeText={setGoogleKey}
                            placeholder="Ingresa tu clave de API de Google"
                            placeholderTextColor="#888"
                        />
                    </View>
                    <TouchableOpacity style={styles.saveButton} onPress={async () => {
                        await supabase.from('settings').upsert({ key: 'commission_rate', value: (parseFloat(commissionRate) / 100).toString() }, { onConflict: 'key' });
                        await supabase.from('settings').upsert({ key: 'google_api_key', value: googleKey }, { onConflict: 'key' });
                        Alert.alert('Guardado', 'Configuración actualizada correctamente.');
                        fetchAllData(true); // Refresh settings
                    }}>
                        <Text style={styles.saveButtonText}>Guardar Ajustes</Text>
                    </TouchableOpacity>
                </View>

                {/* Closing Summary */}
                <View style={styles.closingSummarySection}>
                    <Text style={styles.sectionTitle}>RESUMEN DE CIERRE</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Ventas Totales:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(stats.totalSales)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Margen de Productos:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(stats.totalProfit)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Gastos Operativos:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(stats.totalExpenses)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Comisiones:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(stats.totalCommissions)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Deudas Pagadas:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(stats.debtPayments)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Caja Fuerte (Liquidez):</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(stats.netCaja)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Rentabilidad Neta (ROI):</Text>
                        <Text style={[styles.summaryValue, { color: getProfitColor(stats.netProfit) }]}>{formatCurrency(stats.netProfit)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Deuda Total a Proveedores:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(totalDebt)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Próximo Pago Mensual:</Text>
                        <Text style={styles.summaryValue}>{formatCurrency(nextMonthlyPayment)}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>División de Ganancias (Imperio/Vendedores):</Text>
                        <Text style={styles.summaryValue}>{profitSplit.imperio}% / {profitSplit.vendedores}%</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.whatsappButton}
                        onPress={() => handleWhatsAppPress(
                            `*Resumen de Cierre - ${currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).toUpperCase()}*

` +
                            `*Ventas Totales:* ${formatCurrency(stats.totalSales)}
` +
                            `*Margen de Productos:* ${formatCurrency(stats.totalProfit)}
` +
                            `*Gastos Operativos:* ${formatCurrency(stats.totalExpenses)}
` +
                            `*Comisiones:* ${formatCurrency(stats.totalCommissions)}
` +
                            `*Deudas Pagadas:* ${formatCurrency(stats.debtPayments)}
` +
                            `*Caja Fuerte (Liquidez):* ${formatCurrency(stats.netCaja)}
` +
                            `*Rentabilidad Neta (ROI):* ${formatCurrency(stats.netProfit)}
` +
                            `*Deuda Total a Proveedores:* ${formatCurrency(totalDebt)}
` +
                            `*Próximo Pago Mensual:* ${formatCurrency(nextMonthlyPayment)}
` +
                            `*División de Ganancias:* Imperio ${profitSplit.imperio}% / Vendedores ${profitSplit.vendedores}%

` +
                            `_Generado por EmpireOS_`
                        )}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
                        <Text style={styles.whatsappButtonText}>Compartir por WhatsApp</Text>
                    </TouchableOpacity>
                </View>
            </>
        )}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#000000',
    },
    headerContainer: {
        padding: 20,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 20,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        elevation: 5,
    },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: {
        color: '#d4af37',
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    backBtn: { padding: 5 },
    filterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 5,
        marginBottom: 15,
    },
    filterBtn: {
        paddingVertical: 8,
        paddingHorizontal: 15,
        borderRadius: 8,
    },
    filterBtnActive: {
        backgroundColor: '#d4af37',
    },
    filterText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    filterTextActive: {
        color: '#1a1a1a',
    },
    monthNavContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    monthSelector: { flexDirection: 'row', alignItems: 'center' },
    navArrow: {
        padding: 5,
    },
    monthLabel: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
        marginHorizontal: 10,
    },
    generalToggle: { flexDirection: 'row', alignItems: 'center' },
    generalToggleText: {
        color: '#d4af37',
        marginLeft: 5,
        fontSize: 14,
    },
    scrollView: {
        flex: 1,
    },
    content: {
        padding: 20,
        paddingBottom: 100, // Espacio extra para el scroll
    },
    statsGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    statCard: {
        backgroundColor: '#2a2a2a',
        borderRadius: 15,
        padding: 15,
        width: '48%',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#333',
    },
    statValue: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 5,
    },
    statLabel: {
        fontSize: 12,
        color: '#ccc',
        marginTop: 3,
        textAlign: 'center',
    },
    quickAccessSection: {
        marginTop: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#d4af37',
        marginBottom: 15,
        textAlign: 'center',
    },
    categoryLabel: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 15,
        marginBottom: 10,
    },
    quickAccessGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    quickAccessCard: {
        backgroundColor: '#2a2a2a',
        borderRadius: 15,
        padding: 15,
        width: '31%', // Aproximadamente 1/3 del ancho con espacio
        alignItems: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    quickAccessTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 5,
        textAlign: 'center',
    },
    quickAccessSubtitle: {
        fontSize: 10,
        color: '#ccc',
        textAlign: 'center',
    },
    aiPerformanceSection: {
        marginTop: 20,
    },
    aiStatsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    aiStatCard: {
        backgroundColor: '#2a2a2a',
        borderRadius: 15,
        padding: 10,
        width: '48%',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#333',
    },
    aiStatValue: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginTop: 5,
    },
    aiStatLabel: {
        fontSize: 10,
        color: '#ccc',
        marginTop: 3,
        textAlign: 'center',
    },
    chartSection: {
        marginTop: 20,
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 10,
        marginTop: 15,
        textAlign: 'center',
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    noDataText: {
        color: '#ccc',
        textAlign: 'center',
        marginTop: 20,
        fontSize: 14,
    },
    settingsSection: {
        marginTop: 20,
    },
    settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    settingLabel: {
        color: '#fff',
        fontSize: 16,
    },
    settingInput: {
        backgroundColor: '#333',
        color: '#fff',
        borderRadius: 8,
        padding: 8,
        width: '50%',
        textAlign: 'right',
    },
    saveButton: {
        backgroundColor: '#d4af37',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#1a1a1a',
        fontWeight: 'bold',
        fontSize: 16,
    },
    closingSummarySection: {
        marginTop: 20,
        backgroundColor: '#2a2a2a',
        borderRadius: 15,
        padding: 20,
        marginBottom: 20,
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    summaryLabel: {
        color: '#ccc',
        fontSize: 15,
    },
    summaryValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    whatsappButton: {
        flexDirection: 'row',
        backgroundColor: '#25D366',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
    },
    whatsappButtonText: {
        color: 'white',
        fontWeight: 'bold',
        marginLeft: 10,
        fontSize: 16,
    },
    // Estilos reutilizables
    rowSpaceBetweenCenter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    rowAlignCenter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    // ── Alert banner styles ───────────────────────────────────────────
    alertBanner: {
        padding: 12,
        borderRadius: 10,
        borderLeftWidth: 3,
    },
    alertCritical: {
        backgroundColor: '#ff6b6b18',
        borderLeftColor: '#ff6b6b',
    },
    alertWarning: {
        backgroundColor: '#f39c1218',
        borderLeftColor: '#f39c12',
    },
    alertInfo: {
        backgroundColor: '#74b9ff18',
        borderLeftColor: '#74b9ff',
    },
    alertText: {
        fontSize: 13,
        fontWeight: '600',
        lineHeight: 18,
    },
});
