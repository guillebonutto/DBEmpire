import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CustomProgressChart from '../components/CustomProgressChart';

const screenWidth = Dimensions.get('window').width;

export default function AdminScreen({ navigation }) {
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
        sellerCount: 0
    });
    const [dateFilter, setDateFilter] = useState('month');
    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewAllMonths, setViewAllMonths] = useState(false);
    const [deviceData, setDeviceData] = useState([]);
    const [profitSplit, setProfitSplit] = useState({ imperio: 70, vendedores: 30 });
    const [totalDebt, setTotalDebt] = useState(0);
    const [nextMonthlyPayment, setNextMonthlyPayment] = useState(0);

    // ── In-memory cache ────────────────────────────────────────────────────────
    const cachedSettings = useRef(null);
    const cachedDebt = useRef(null);
    const cachedAllSales = useRef(null);
    const cachedAllExpenses = useRef(null);
    const cachedAllSaleItems = useRef(null);

    // ── Keep a ref copy of filter state so processLocalData can read them sync ─
    const dateFilterRef = useRef('month');
    const currentDateRef = useRef(new Date());
    const viewAllMonthsRef = useRef(false);

    // ── On mount: check role once, then load all data ──────────────────────────
    useEffect(() => {
        const checkRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role !== 'admin') {
                Alert.alert('Acceso Denegado', 'No tienes permisos para ver esta sección.');
                navigation.replace('Main');
            }
        };
        checkRole();
        fetchAllData();
    }, []);

    // ── Generate timeline (pure, no state reads — uses params) ─────────────────
    const generateTimeline = (filter, date, allMonths) => {
        const timeline = [];
        const now = new Date();

        if (filter === 'day') {
            const tgtDay = now.getDate();
            const tgtMonth = now.getMonth();
            for (let i = 0; i < 24; i++) {
                timeline.push({
                    key: i,
                    label: i % 4 === 0 ? `${i}:00` : '',
                    dateMatch: (d) => d.getHours() === i && d.getDate() === tgtDay && d.getMonth() === tgtMonth,
                    total: 0, income: 0, expense: 0
                });
            }
        } else if (filter === 'week') {
            for (let i = 6; i >= 0; i--) {
                const d = new Date(now);
                d.setDate(d.getDate() - i);
                const tgtDay = d.getDate();
                const tgtMonth = d.getMonth();
                const dayStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
                timeline.push({
                    key: dayStr,
                    label: dayStr,
                    dateMatch: (dt) => dt.getDate() === tgtDay && dt.getMonth() === tgtMonth,
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
                        dateMatch: (dt) => dt.getMonth() === index && dt.getFullYear() === tgtYear,
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
                        dateMatch: (dt) => dt.getDate() === i && dt.getMonth() === tgtMonth && dt.getFullYear() === tgtYear,
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
                    dateMatch: (dt) => dt.getFullYear() === year,
                    total: 0, income: 0, expense: 0
                });
            }
        }
        return timeline;
    };

    // ── Get date range for a given filter/date combo ───────────────────────────
    const getDateRange = (filter, date, allMonths) => {
        const now = new Date();
        let startDate, endDate;

        if (filter === 'day') {
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (filter === 'week') {
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (filter === 'month') {
            if (allMonths) {
                startDate = new Date(now.getFullYear(), 0, 1);
                endDate = new Date(now.getFullYear(), 11, 31);
            } else {
                startDate = new Date(date.getFullYear(), date.getMonth(), 1);
                endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            }
        } else if (filter === 'year') {
            startDate = new Date(now.getFullYear() - 4, 0, 1);
        }

        return { startISO: startDate.toISOString(), endISO: endDate ? endDate.toISOString() : null };
    };

    // ── Helper: get timeline bucket key for a date (O(1) lookup) ───────────────
    const getBucketKey = (filter, date, allMonths, d) => {
        if (filter === 'day') return d.getHours();
        if (filter === 'week') return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
        if (filter === 'month') {
            if (allMonths) return d.getMonth();
            return d.getDate();
        }
        if (filter === 'year') return d.getFullYear();
        return null;
    };

    // ── Process all charts/stats from local cache — SYNCHRONOUS, no await ─────
    const processLocalData = useCallback((filter, date, allMonths) => {
        if (!cachedAllSales.current) return;

        const { startISO, endISO } = getDateRange(filter, date, allMonths);

        // Single-pass: split into current/prev in one loop
        let prevIncome = 0, prevExp = 0;
        const currentSales = [];
        const currentExpenses = [];

        for (const s of cachedAllSales.current) {
            if (s.created_at < startISO) {
                const st = (s.status || '').toLowerCase();
                if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
                    prevIncome += (parseFloat(s.total_amount) || 0);
                }
            } else if (!endISO || s.created_at <= endISO) {
                currentSales.push(s);
            }
        }
        for (const e of cachedAllExpenses.current) {
            if (e.created_at < startISO) {
                prevExp += (parseFloat(e.amount) || 0);
            } else if (!endISO || e.created_at <= endISO) {
                currentExpenses.push(e);
            }
        }

        const histBal = prevIncome - prevExp;

        // Finalized sales only
        const finalSales = currentSales.filter(s => {
            const st = (s.status || '').toLowerCase();
            return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
        });

        // ── Charts — build index Map for O(1) bucket lookup ────────────────────
        const timeline = generateTimeline(filter, date, allMonths);
        // Map from bucket key → timeline index
        const bucketIndex = new Map();
        timeline.forEach((t, i) => bucketIndex.set(t.key, i));

        finalSales.forEach(sale => {
            const d = new Date(sale.created_at);
            const key = getBucketKey(filter, date, allMonths, d);
            const idx = bucketIndex.get(key);
            if (idx !== undefined) {
                const amount = parseFloat(sale.total_amount) || 0;
                timeline[idx].total += amount;
                timeline[idx].income += amount;
            }
        });
        currentExpenses.forEach(e => {
            const d = new Date(e.created_at);
            const key = getBucketKey(filter, date, allMonths, d);
            const idx = bucketIndex.get(key);
            if (idx !== undefined) timeline[idx].expense += (parseFloat(e.amount) || 0);
        });

        setSalesData({
            labels: timeline.map(t => t.label),
            data: timeline.map(t => t.total)
        });

        let runningTotal = histBal;
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
        const totalExpenses = currentExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
        const netProfit = histBal + totalSales - totalExpenses;

        setStats({ totalSales, totalProfit: grossProfit, totalCommissions, totalExpenses, netProfit, sellerCount: 1 });

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
        const currentSaleItems = cachedAllSaleItems.current.filter(item =>
            finalSales.some(s => s.id === item.sale_id)
        );
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
    }, []);

    // ── Fetch ALL data from Supabase once ──────────────────────────────────────
    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [settingsRes, debtRes, salesRes, expensesRes, itemsRes] = await Promise.all([
                supabase.from('settings').select('*'),
                supabase.from('supplier_orders').select('*'),
                supabase.from('sales')
                    .select('id, created_at, total_amount, profit_generated, commission_amount, status, device_sig')
                    .order('created_at', { ascending: false }),
                supabase.from('expenses')
                    .select('amount, created_at')
                    .order('created_at', { ascending: false }),
                supabase.from('sale_items').select('sale_id, quantity, products(name)')
            ]);

            // Settings
            cachedSettings.current = settingsRes.data || [];
            const settingsData = cachedSettings.current;
            const comm = settingsData.find(s => s.key === 'commission_rate');
            const key = settingsData.find(s => s.key === 'google_api_key');
            if (comm) setCommissionRate((parseFloat(comm.value) * 100).toString());
            if (key) setGoogleKey(key.value);
            const splitImp = settingsData.find(s => s.key === 'profit_split_imperio');
            const splitVend = settingsData.find(s => s.key === 'profit_split_vendedores');
            if (splitImp && splitVend) {
                setProfitSplit({ imperio: parseInt(splitImp.value), vendedores: parseInt(splitVend.value) });
            }

            // Supplier debt
            cachedDebt.current = debtRes.data || [];
            let debt = 0, monthly = 0;
            cachedDebt.current.forEach(order => {
                const totalInst = order.installments_total || 1;
                const paidInst = order.installments_paid || 0;
                if (paidInst < totalInst) {
                    const effectiveTotal = (parseFloat(order.total_cost) || 0) - (parseFloat(order.discount) || 0);
                    const perIns = effectiveTotal / totalInst;
                    debt += perIns * (totalInst - paidInst);
                    monthly += perIns;
                }
            });
            setTotalDebt(debt);
            setNextMonthlyPayment(monthly);

            // Sales (with device_sig fallback)
            let fetchedSales = salesRes.data || [];
            if (salesRes.error && salesRes.error.message.includes('device_sig')) {
                const retry = await supabase.from('sales')
                    .select('id, created_at, total_amount, profit_generated, commission_amount, status')
                    .order('created_at', { ascending: false });
                fetchedSales = retry.data || [];
            }
            cachedAllSales.current = fetchedSales;
            cachedAllExpenses.current = expensesRes.data || [];
            cachedAllSaleItems.current = itemsRes.data || [];

            // Process with current filter state
            processLocalData(dateFilterRef.current, currentDateRef.current, viewAllMonthsRef.current);

        } catch (error) {
            console.log('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Force full refresh (pull-to-refresh) ───────────────────────────────────
    const forceRefresh = () => {
        cachedSettings.current = null;
        cachedDebt.current = null;
        cachedAllSales.current = null;
        cachedAllExpenses.current = null;
        cachedAllSaleItems.current = null;
        fetchAllData();
    };

    // ── Change month: update ref + state + process immediately ────────────────
    const changeMonth = (increment) => {
        const newDate = new Date(currentDateRef.current);
        newDate.setMonth(newDate.getMonth() + increment);
        currentDateRef.current = newDate;
        setCurrentDate(newDate); // triggers re-render for the label
        processLocalData(dateFilterRef.current, newDate, viewAllMonthsRef.current);
    };

    // ── Change filter ──────────────────────────────────────────────────────────
    const changeFilter = (newFilter, resetAllMonths = false) => {
        dateFilterRef.current = newFilter;
        if (resetAllMonths) viewAllMonthsRef.current = false;
        setDateFilter(newFilter);
        if (resetAllMonths) setViewAllMonths(false);
        processLocalData(newFilter, currentDateRef.current, resetAllMonths ? false : viewAllMonthsRef.current);
    };

    // ── Toggle "Ver Año Completo" ──────────────────────────────────────────────
    const toggleAllMonths = () => {
        const newVal = !viewAllMonthsRef.current;
        viewAllMonthsRef.current = newVal;
        setViewAllMonths(newVal);
        processLocalData(dateFilterRef.current, currentDateRef.current, newVal);
    };

    const updateCommissionRate = async () => {
        const rate = parseFloat(commissionRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
            Alert.alert('Error', 'Ingresa un porcentaje válido entre 0 y 100');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.from('settings').upsert({ key: 'commission_rate', value: (rate / 100).toString() }, { onConflict: 'key' });
            if (error) throw error;
            cachedSettings.current = null;
            Alert.alert('✅ Actualizado', `La comisión ahora es del ${rate}%`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la comisión');
        } finally {
            setLoading(false);
        }
    };

    const updateGoogleKey = async () => {
        if (!googleKey.trim()) {
            Alert.alert('Error', 'Ingresa una API Key válida');
            return;
        }
        setLoading(true);
        try {
            const { error } = await supabase.from('settings').upsert({ key: 'google_api_key', value: googleKey.trim() }, { onConflict: 'key' });
            if (error) throw error;
            cachedSettings.current = null;
            Alert.alert('✅ Desbloqueado', 'Google Gemini está listo para trabajar 🧠⚡');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar la API Key');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>PANEL DE CONTROL</Text>
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
                refreshControl={<RefreshControl refreshing={loading} onRefresh={forceRefresh} tintColor="#d4af37" />}
            >
                {/* Stats Cards */}
                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="cash-multiple" size={28} color="#d4af37" />
                        <Text style={styles.statValue}>${stats.totalSales.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Ventas</Text>
                    </View>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="currency-usd" size={28} color="#2ecc71" />
                        <Text style={styles.statValue}>${stats.totalProfit.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Margen Productos</Text>
                    </View>
                </View>

                <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                        <MaterialCommunityIcons name="cash-minus" size={28} color="#e74c3c" />
                        <Text style={styles.statValue}>${stats.totalExpenses.toFixed(0)}</Text>
                        <Text style={styles.statLabel}>Gastos Operativos</Text>
                    </View>
                    <View style={[styles.statCard, { borderColor: stats.netProfit >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                        <MaterialCommunityIcons name="scale-balance" size={28} color={stats.netProfit >= 0 ? '#2ecc71' : '#e74c3c'} />
                        <Text style={[styles.statValue, { color: stats.netProfit >= 0 ? '#2ecc71' : '#e74c3c' }]}>
                            ${stats.netProfit.toFixed(0)}
                        </Text>
                        <Text style={[styles.statLabel, { color: stats.netProfit >= 0 ? '#2ecc71' : '#e74c3c' }]}>Estado ROI / Balance</Text>
                    </View>
                </View>

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
                            <Text style={styles.quickAccessSubtitle}>Productos</Text>
                        </TouchableOpacity>
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
                    </View>

                    <Text style={styles.categoryLabel}>📦 Logística & Envíos</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('ShippingPackages')}>
                            <MaterialCommunityIcons name="package-variant" size={32} color="#f39c12" />
                            <Text style={styles.quickAccessTitle}>Paquetes</Text>
                            <Text style={styles.quickAccessSubtitle}>Tracking</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('ShippingRates')}>
                            <MaterialCommunityIcons name="currency-usd" size={32} color="#16a085" />
                            <Text style={styles.quickAccessTitle}>Tarifas</Text>
                            <Text style={styles.quickAccessSubtitle}>Fletes</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.categoryLabel}>🔒 Seguridad</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity style={styles.quickAccessCard} onPress={() => navigation.navigate('ActivityLog')}>
                            <MaterialCommunityIcons name="shield-account" size={32} color="#d4af37" />
                            <Text style={styles.quickAccessTitle}>Auditoría</Text>
                            <Text style={styles.quickAccessSubtitle}>Actividad</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Debt Projection Card */}
                {totalDebt > 0 && (
                    <TouchableOpacity style={[styles.chartCard, { borderLeftWidth: 5, borderLeftColor: '#e74c3c' }]} onPress={() => navigation.navigate('SupplierOrders')}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={[styles.sectionTitle, { marginBottom: 5 }]}>DEUDA TOTAL A PROVEEDORES</Text>
                                <Text style={{ color: '#e74c3c', fontSize: 24, fontWeight: '900' }}>
                                    ${totalDebt.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: '#666', fontSize: 10, fontWeight: 'bold' }}>ESTE MES:</Text>
                                <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>
                                    ${nextMonthlyPayment.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                                </Text>
                            </View>
                        </View>
                        <Text style={{ color: '#555', fontSize: 11, marginTop: 10, fontStyle: 'italic' }}>
                            Monto pendiente de todas las importaciones en cuotas.
                        </Text>
                    </TouchableOpacity>
                )}

                {/* Sales Chart */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>TENDENCIA DE VENTAS</Text>
                    {salesData.data.length > 0 && salesData.data.some(d => d > 0) ? (
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
                </View>

                {/* ROI Chart */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>RECUPERACIÓN DE INVERSIÓN (ROI)</Text>
                    {progressData.datasets?.length > 0 ? (
                        <CustomProgressChart progressData={progressData} />
                    ) : (
                        <Text style={styles.noDataText}>No hay datos suficientes</Text>
                    )}
                </View>

                {/* Top Products Pie Chart */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>TOP 5 PRODUCTOS MÁS VENDIDOS</Text>
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
                </View>

                {/* Hardware Performance */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>DESEMPEÑO POR ALIADO (HARDWARE)</Text>
                    <Text style={[styles.settingsDesc, { marginTop: -5, marginBottom: 15 }]}>
                        Ventas totales atribuidas a cada dispositivo físico autorizado.
                    </Text>
                    {deviceData.length > 0 ? (
                        <View>
                            {deviceData.map((d, i) => (
                                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i === deviceData.length - 1 ? 0 : 1, borderBottomColor: '#222' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <MaterialCommunityIcons name="cellphone-check" size={18} color="#d4af37" style={{ marginRight: 10 }} />
                                        <View>
                                            <Text style={{ color: '#fff', fontWeight: 'bold' }}>{d.sig}</Text>
                                            <Text style={{ color: '#666', fontSize: 11 }}>Comisión: ${d.commissions.toFixed(2)}</Text>
                                        </View>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ color: '#d4af37', fontWeight: '900' }}>${d.total.toFixed(0)}</Text>
                                        <Text style={{ color: '#444', fontSize: 10, fontWeight: '700' }}>VENTAS</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <Text style={styles.noDataText}>Sin datos de dispositivos</Text>
                    )}
                </View>

                {/* Commission Settings */}
                <View style={styles.settingsCard}>
                    <Text style={styles.sectionTitle}>CONFIGURACIÓN DE COMISIONES</Text>
                    <Text style={styles.settingsDesc}>Define el porcentaje de ganancia que reciben los vendedores por cada venta</Text>
                    <View style={styles.inputContainer}>
                        <TextInput style={styles.input} value={commissionRate} onChangeText={setCommissionRate} keyboardType="numeric" placeholder="10" placeholderTextColor="#666" />
                        <Text style={styles.inputSuffix}>%</Text>
                    </View>
                    <TouchableOpacity style={styles.saveButton} onPress={updateCommissionRate} disabled={loading}>
                        <MaterialCommunityIcons name="content-save" size={20} color="black" />
                        <Text style={styles.saveButtonText}>GUARDAR CAMBIOS</Text>
                    </TouchableOpacity>
                </View>

                {/* AI Settings */}
                <View style={styles.settingsCard}>
                    <Text style={styles.sectionTitle}>GEMINI AI (Google API Key)</Text>
                    <Text style={styles.settingsDesc}>Pega aquí tu llave de Google (gratis) para activar el Asistente de Marketing y el Escáner de Recibos.</Text>
                    <View style={styles.inputContainer}>
                        <TextInput style={[styles.input, { fontSize: 14, textAlign: 'left' }]} value={googleKey} onChangeText={setGoogleKey} placeholder="AIzaSy..." placeholderTextColor="#666" secureTextEntry />
                    </View>
                    <TouchableOpacity style={styles.saveButton} onPress={updateGoogleKey} disabled={loading}>
                        <MaterialCommunityIcons name="google" size={20} color="black" />
                        <Text style={styles.saveButtonText}>ACTIVAR GEMINI ♊</Text>
                    </TouchableOpacity>
                </View>

                {/* Profit Split & Monthly Closing */}
                <View style={styles.settingsCard}>
                    <Text style={styles.sectionTitle}>REPARTO DE GANANCIAS (CIERRE)</Text>
                    <Text style={styles.settingsDesc}>Configura cómo se divide la Ganancia Neta (después de gastos y comisiones).</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>IMPERIO %</Text>
                            <TextInput style={[styles.input, { fontSize: 18 }]} value={profitSplit.imperio.toString()} onChangeText={(v) => setProfitSplit({ ...profitSplit, imperio: parseInt(v) || 0 })} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>VENDEDORES %</Text>
                            <TextInput style={[styles.input, { fontSize: 18 }]} value={profitSplit.vendedores.toString()} onChangeText={(v) => setProfitSplit({ ...profitSplit, vendedores: parseInt(v) || 0 })} keyboardType="numeric" />
                        </View>
                    </View>
                    <View style={styles.closingSummary}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Ganancia Neta:</Text>
                            <Text style={styles.summaryValue}>${stats.netProfit.toFixed(0)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Para el Imperio ({profitSplit.imperio}%):</Text>
                            <Text style={[styles.summaryValue, { color: '#2ecc71' }]}>${(stats.netProfit * (profitSplit.imperio / 100)).toFixed(0)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Para Vendedores ({profitSplit.vendedores}%):</Text>
                            <Text style={[styles.summaryValue, { color: '#3498db' }]}>${(stats.netProfit * (profitSplit.vendedores / 100)).toFixed(0)}</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: '#25D366' }]}
                        onPress={() => {
                            const msg =
                                `📊 *CIERRE MENSUAL - DB EMPIRE*\n\n` +
                                `💰 Ventas Totales: $${stats.totalSales.toFixed(0)}\n` +
                                `📉 Gastos: $${stats.totalExpenses.toFixed(0)}\n` +
                                `🤝 Comisiones: $${stats.totalCommissions.toFixed(0)}\n` +
                                `--------------------------\n` +
                                `✨ *GANANCIA NETA: $${stats.netProfit.toFixed(0)}*\n\n` +
                                `🏰 Imperio (${profitSplit.imperio}%): $${(stats.netProfit * (profitSplit.imperio / 100)).toFixed(0)}\n` +
                                `👥 Vendedores (${profitSplit.vendedores}%): $${(stats.netProfit * (profitSplit.vendedores / 100)).toFixed(0)}\n\n` +
                                `_Generado automáticamente por DB Empire_`;
                            require('react-native').Linking.openURL(`whatsapp://send?text=${encodeURIComponent(msg)}`);
                        }}
                    >
                        <MaterialCommunityIcons name="whatsapp" size={24} color="white" />
                        <Text style={[styles.saveButtonText, { color: 'white' }]}>ENVIAR RESUMEN CIERRE</Text>
                    </TouchableOpacity>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    header: { paddingTop: 10, paddingBottom: 20, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#333' },
    headerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { color: '#d4af37', fontSize: 18, fontWeight: '900', letterSpacing: 2 },
    backBtn: { padding: 5 },
    expenseBtn: { padding: 5 },
    scrollView: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    filterContainer: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    filterBtn: { flex: 1, backgroundColor: '#1e1e1e', padding: 12, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    filterBtnActive: { backgroundColor: '#d4af37', borderColor: '#d4af37' },
    filterText: { color: '#888', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
    filterTextActive: { color: '#000' },
    statsGrid: { flexDirection: 'row', gap: 15, marginBottom: 15 },
    statCard: { flex: 1, backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
    statValue: { fontSize: 24, fontWeight: '900', color: '#fff', marginTop: 10 },
    statLabel: { fontSize: 10, color: '#888', marginTop: 5, textAlign: 'center', letterSpacing: 1 },
    chartCard: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    sectionTitle: { fontSize: 14, fontWeight: '900', color: '#d4af37', marginBottom: 15, letterSpacing: 1 },
    chart: { marginVertical: 8, borderRadius: 16 },
    noDataText: { color: '#666', textAlign: 'center', padding: 40, fontStyle: 'italic' },
    settingsCard: { backgroundColor: '#1e1e1e', padding: 20, borderRadius: 15, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
    settingsDesc: { color: '#888', fontSize: 13, marginBottom: 20, lineHeight: 20 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    input: { flex: 1, backgroundColor: '#000', color: '#fff', padding: 18, borderRadius: 12, fontSize: 24, fontWeight: 'bold', borderWidth: 1, borderColor: '#d4af37', textAlign: 'center' },
    inputSuffix: { fontSize: 24, fontWeight: 'bold', color: '#d4af37', marginLeft: 10 },
    saveButton: { backgroundColor: '#d4af37', padding: 18, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
    saveButtonText: { color: 'black', fontWeight: '900', fontSize: 16, letterSpacing: 1 },
    monthNavContainer: { paddingHorizontal: 20, paddingBottom: 15 },
    monthSelector: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 15, gap: 20 },
    navArrow: { padding: 5 },
    monthLabel: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 1, minWidth: 150, textAlign: 'center' },
    generalToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#1e1e1e', padding: 10, borderRadius: 8, alignSelf: 'center', borderWidth: 1, borderColor: '#333' },
    generalToggleText: { color: '#d4af37', fontWeight: 'bold' },
    miniLabel: { color: '#666', fontSize: 10, fontWeight: 'bold', marginBottom: 5, textAlign: 'center' },
    closingSummary: { backgroundColor: '#000', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    summaryText: { color: '#888', fontSize: 12 },
    summaryValue: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
    quickAccessSection: { marginBottom: 20 },
    categoryLabel: { color: '#999', fontSize: 13, fontWeight: 'bold', marginTop: 15, marginBottom: 10, letterSpacing: 0.5 },
    quickAccessGrid: { flexDirection: 'row', gap: 12, marginBottom: 10, flexWrap: 'wrap' },
    quickAccessCard: { flex: 1, minWidth: '30%', backgroundColor: '#1e1e1e', padding: 18, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#333', gap: 8 },
    quickAccessTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
    quickAccessSubtitle: { color: '#666', fontSize: 10, textAlign: 'center' }
});
