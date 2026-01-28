import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, StatusBar, Dimensions, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { supabase } from '../services/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
    const [dateFilter, setDateFilter] = useState('month'); // 'week', 'month', 'year'
    const [currentDate, setCurrentDate] = useState(new Date()); // For specific month navigation
    const [viewAllMonths, setViewAllMonths] = useState(false); // Toggle for General View
    const [tooltip, setTooltip] = useState({ visible: false, value: 0, x: 0, y: 0 });
    const [deviceData, setDeviceData] = useState([]);
    const [profitSplit, setProfitSplit] = useState({ imperio: 70, vendedores: 30 });
    const [totalDebt, setTotalDebt] = useState(0);
    const [nextMonthlyPayment, setNextMonthlyPayment] = useState(0);

    useEffect(() => {
        const checkRole = async () => {
            const role = await AsyncStorage.getItem('user_role');
            if (role !== 'admin') {
                Alert.alert('Acceso Denegado', 'No tienes permisos para ver esta sección.');
                navigation.replace('Main');
            }
        };
        checkRole();
        fetchData();
    }, [dateFilter, currentDate, viewAllMonths]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Prepare Date Range
            const now = new Date();
            let startDate, endDate;

            if (dateFilter === 'day') {
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            } else if (dateFilter === 'week') {
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (dateFilter === 'month') {
                if (viewAllMonths) {
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), 11, 31);
                } else {
                    startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
                    endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
                }
            } else if (dateFilter === 'year') {
                startDate = new Date(now.getFullYear() - 4, 0, 1);
            }

            const startISO = startDate.toISOString();
            const endISO = endDate ? endDate.toISOString() : null;

            // 2. Parallel Fetch
            const [
                { data: settingsData },
                salesRes,
                expensesRes,
                { data: histSales },
                { data: histExp },
                supplierOrdersRes
            ] = await Promise.all([
                supabase.from('settings').select('*'),
                supabase.from('sales').select('id, created_at, total_amount, profit_generated, commission_amount, status, device_sig').gte('created_at', startISO).lte('created_at', endISO || '9999-12-31').order('created_at', { ascending: false }),
                supabase.from('expenses').select('amount, created_at').gte('created_at', startISO).lte('created_at', endISO || '9999-12-31'),
                supabase.from('sales').select('total_amount, status').lt('created_at', startISO),
                supabase.from('expenses').select('amount').lt('created_at', startISO),
                supabase.from('supplier_orders').select('*')
            ]);

            // Supplier Debt Calculation
            if (supplierOrdersRes.data) {
                let debt = 0;
                let monthly = 0;
                supplierOrdersRes.data.forEach(order => {
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
            }

            // Handle Settings
            if (settingsData) {
                const comm = settingsData.find(s => s.key === 'commission_rate');
                const key = settingsData.find(s => s.key === 'google_api_key');
                if (comm) setCommissionRate((parseFloat(comm.value) * 100).toString());
                if (key) setGoogleKey(key.value);

                const splitImp = settingsData.find(s => s.key === 'profit_split_imperio');
                const splitVend = settingsData.find(s => s.key === 'profit_split_vendedores');
                if (splitImp && splitVend) {
                    setProfitSplit({ imperio: parseInt(splitImp.value), vendedores: parseInt(splitVend.value) });
                }
            }

            let sales = salesRes.data;
            let salesError = salesRes.error;

            // Fallback for missing device_sig
            if (salesError && salesError.message.includes('device_sig')) {
                const retry = await supabase.from('sales').select('id, created_at, total_amount, profit_generated, commission_amount, status').gte('created_at', startISO).lte('created_at', endISO || '9999-12-31').order('created_at', { ascending: false });
                sales = retry.data;
                salesError = retry.error;
            }
            if (salesError) throw salesError;

            const expenses = expensesRes.data || [];
            if (expensesRes.error) throw expensesRes.error;

            // ROI HISTORY
            const prevIncome = (histSales || []).filter(s => {
                const st = (s.status || '').toLowerCase();
                return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
            }).reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);

            const prevExpenses = (histExp || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
            const historicalBalance = prevIncome - prevExpenses;

            // Fetch sale items (Still separate because it depends on sales)
            let saleItems = [];
            if (sales && sales.length > 0) {
                const { data: items } = await supabase
                    .from('sale_items')
                    .select('quantity, products(name)')
                    .in('sale_id', sales.map(s => s.id));
                saleItems = items || [];
            }

            // Process data for charts and stats
            // FILTER: Only count finalized sales for financial metrics
            const finalSales = (sales || []).filter(s => {
                const status = (s.status || '').toLowerCase();
                return status === 'completed' || status === 'exitosa' || status === 'vended' || status === '';
            });

            // Process data for charts and stats
            processChartData(finalSales);
            processProgressData(finalSales, expenses || [], historicalBalance);
            calculateStats(finalSales, expenses || [], historicalBalance);
            processDeviceData(finalSales);

            if (saleItems && saleItems.length > 0) {
                processProductData(saleItems);
            }
        } catch (error) {
            console.log('Error fetching admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    const generateTimeline = (filter) => {
        const timeline = [];
        const now = new Date();

        if (filter === 'day') {
            for (let i = 0; i < 24; i++) {
                timeline.push({
                    key: i,
                    label: i % 4 === 0 ? `${i}:00` : '',
                    dateMatch: (date) => {
                        const d = new Date(date);
                        return d.getHours() === i && d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
                    },
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
                    dateMatch: (date) => new Date(date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) === dayStr,
                    total: 0, income: 0, expense: 0
                });
            }
        } else if (filter === 'month') {
            if (viewAllMonths) {
                // General View: Full Current Year (Jan-Dec)
                const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
                months.forEach((m, index) => {
                    timeline.push({
                        key: index,
                        label: m,
                        dateMatch: (date) => new Date(date).getMonth() === index && new Date(date).getFullYear() === now.getFullYear(),
                        total: 0, income: 0, expense: 0
                    });
                });
            } else {
                // Specific Month View: Daily breakdown (1-30/31)
                const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    // For spacing labels, show every 5 days
                    const label = (i === 1 || i % 5 === 0) ? `${i}` : '';
                    timeline.push({
                        key: i,
                        label: label,
                        dateMatch: (date) => {
                            const d = new Date(date);
                            return d.getDate() === i && d.getMonth() === currentDate.getMonth() && d.getFullYear() === currentDate.getFullYear();
                        },
                        total: 0, income: 0, expense: 0
                    });
                }
            }
        } else if (filter === 'year') {
            // Last 5 Years
            for (let i = 4; i >= 0; i--) {
                const year = now.getFullYear() - i;
                timeline.push({
                    key: year,
                    label: year.toString(),
                    dateMatch: (date) => new Date(date).getFullYear() === year,
                    total: 0, income: 0, expense: 0
                });
            }
        }
        return timeline;
    };

    const processChartData = (sales) => {
        const timeline = generateTimeline(dateFilter);

        sales.forEach(sale => {
            const saleDate = new Date(sale.created_at);
            const item = timeline.find(t => t.dateMatch(saleDate));
            if (item) {
                item.total += (parseFloat(sale.total_amount) || 0);
            }
        });

        // Ensure we always have data to render, even if empty
        const labels = timeline.length > 0 ? timeline.map(t => t.label) : ['No Data'];
        const data = timeline.length > 0 ? timeline.map(t => t.total) : [0];

        setSalesData({ labels, data });
    };

    const processProgressData = (sales, expenses, historicalBalance = 0) => {
        const timeline = generateTimeline(dateFilter);

        sales.forEach(s => {
            const d = new Date(s.created_at);
            const item = timeline.find(t => t.dateMatch(d));
            if (item) item.income += (parseFloat(s.total_amount) || 0);
        });

        expenses.forEach(e => {
            const d = new Date(e.created_at);
            const item = timeline.find(t => t.dateMatch(d));
            if (item) item.expense += parseFloat(e.amount);
        });

        // Calculate ROI Balance (Cumulative / Running Total starting from historical balance)
        let runningTotal = historicalBalance;
        const netData = timeline.map(t => {
            const dailyNet = t.income - t.expense;
            runningTotal += dailyNet;
            return runningTotal;
        });

        setProgressData({
            labels: timeline.map(t => t.label),
            datasets: [
                {
                    data: netData.length > 0 ? netData : [0],
                    color: (opacity = 1) => runningTotal >= 0 ? `rgba(46, 204, 113, ${opacity})` : `rgba(231, 76, 60, ${opacity})`,
                    strokeWidth: 2
                }
            ],
            legend: ["Balance ROI (Progreso Acumulado)"]
        });
    };

    const calculateStats = (sales, expenses, historicalBalance = 0) => {
        const currentSales = (sales || []).reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
        const grossProfit = (sales || []).reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);
        const totalCommissions = (sales || []).reduce((sum, s) => sum + (parseFloat(s.commission_amount) || 0), 0);
        const currentExpenses = (expenses || []).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);

        // All-Time ROI Balance = History + Current Period
        const netProfit = historicalBalance + currentSales - currentExpenses;

        setStats({
            totalSales: currentSales,
            totalProfit: grossProfit,
            totalCommissions,
            totalExpenses: currentExpenses,
            netProfit,
            sellerCount: 1
        });
    };

    const processProductData = (saleItems) => {
        const productMap = {};

        saleItems.forEach(item => {
            const productName = item.products?.name || 'Desconocido';
            if (!productMap[productName]) {
                productMap[productName] = 0;
            }
            productMap[productName] += item.quantity;
        });

        // Convert to array and sort by quantity
        const sortedProducts = Object.entries(productMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5); // Top 5 products

        // Generate colors for pie chart
        const colors = ['#d4af37', '#2ecc71', '#e74c3c', '#a29bfe', '#fd79a8'];

        const chartData = sortedProducts.map(([name, quantity], index) => ({
            name,
            quantity,
            color: colors[index],
            legendFontColor: '#888',
            legendFontSize: 12
        }));

        setProductData(chartData);
    };

    const processDeviceData = (sales) => {
        const deviceMap = {};
        sales.forEach(s => {
            const sig = s.device_sig || 'Otros / Manual';
            if (!deviceMap[sig]) deviceMap[sig] = { total: 0, commissions: 0 };

            const status = (s.status || '').toLowerCase();
            if (status === 'completed' || status === 'exitosa' || status === '' || status === 'vended') {
                deviceMap[sig].total += (parseFloat(s.total_amount) || 0);
                deviceMap[sig].commissions += (parseFloat(s.commission_amount) || 0);
            }
        });

        const data = Object.keys(deviceMap).map(sig => ({
            sig,
            total: deviceMap[sig].total,
            commissions: deviceMap[sig].commissions
        })).sort((a, b) => b.total - a.total);

        setDeviceData(data);
    };

    const updateCommissionRate = async () => {
        const rate = parseFloat(commissionRate);
        if (isNaN(rate) || rate < 0 || rate > 100) {
            Alert.alert('Error', 'Ingresa un porcentaje válido entre 0 y 100');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase
                .from('settings')
                .upsert(
                    { key: 'commission_rate', value: (rate / 100).toString() },
                    { onConflict: 'key' }
                );

            if (error) throw error;

            Alert.alert('✅ Actualizado', `La comisión ahora es del ${rate}%`);
        } catch (error) {
            Alert.alert('Error', 'No se pudo actualizar la comisión');
            console.log(error);
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
            const { error } = await supabase
                .from('settings')
                .upsert(
                    { key: 'google_api_key', value: googleKey.trim() },
                    { onConflict: 'key' }
                );

            if (error) throw error;

            Alert.alert('✅ Desbloqueado', 'Google Gemini está listo para trabajar 🧠⚡');
        } catch (error) {
            Alert.alert('Error', 'No se pudo guardar la API Key');
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const progressChart = useMemo(() => {
        if (!progressData?.datasets || progressData.datasets.length === 0) return null;
        const statusColor = stats.netProfit >= 0 ? '#2ecc71' : '#e74c3c';

        // Check if data is just single 0 to avoid render error or ugly chart
        const isDataEmpty = progressData.datasets[0].data.length === 1 && progressData.datasets[0].data[0] === 0;

        return (
            <LineChart
                data={progressData}
                width={screenWidth - 60}
                height={220}
                yAxisLabel="$"
                chartConfig={{
                    backgroundColor: '#1e1e1e',
                    backgroundGradientFrom: '#1e1e1e',
                    backgroundGradientTo: '#1e1e1e',
                    decimalPlaces: 0,
                    color: (opacity = 1) => statusColor, // Line color
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '6', strokeWidth: '2', stroke: statusColor },
                    fillShadowGradient: statusColor, // This is the "franja" (fill)
                    fillShadowGradientOpacity: 0.2
                }}
                bezier
                style={styles.chart}
                onDataPointClick={({ value, x, y }) => {
                    setTooltip({ visible: true, value, x, y });
                }}
            />
        );
    }, [progressData, stats.netProfit]);

    const changeMonth = (increment) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(newDate.getMonth() + increment);
        setCurrentDate(newDate);
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />

            {/* Header */}
            <LinearGradient colors={['#000000', '#1a1a1a']} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>PANEL DE CONTROL</Text>
                    <View style={{ width: 24 }} />
                </View>

                {/* Date Filter Buttons */}
                <View style={styles.filterContainer}>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateFilter === 'day' && styles.filterBtnActive]}
                        onPress={() => { setDateFilter('day'); setViewAllMonths(false); }}
                    >
                        <Text style={[styles.filterText, dateFilter === 'day' && styles.filterTextActive]}>DÍA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateFilter === 'week' && styles.filterBtnActive]}
                        onPress={() => { setDateFilter('week'); setViewAllMonths(false); }}
                    >
                        <Text style={[styles.filterText, dateFilter === 'week' && styles.filterTextActive]}>SEMANA</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateFilter === 'month' && styles.filterBtnActive]}
                        onPress={() => setDateFilter('month')} // Keep current month view state
                    >
                        <Text style={[styles.filterText, dateFilter === 'month' && styles.filterTextActive]}>MES</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.filterBtn, dateFilter === 'year' && styles.filterBtnActive]}
                        onPress={() => { setDateFilter('year'); setViewAllMonths(false); }}
                    >
                        <Text style={[styles.filterText, dateFilter === 'year' && styles.filterTextActive]}>AÑO</Text>
                    </TouchableOpacity>
                </View>

                {/* MONTH NAVIGATION CONTROLS */}
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

                        <TouchableOpacity
                            style={styles.generalToggle}
                            onPress={() => setViewAllMonths(!viewAllMonths)}
                        >
                            <MaterialCommunityIcons
                                name={viewAllMonths ? "checkbox-marked" : "checkbox-blank-outline"}
                                size={24}
                                color="#d4af37"
                            />
                            <Text style={styles.generalToggleText}>Ver Año Completo</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </LinearGradient>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchData} tintColor="#d4af37" />}
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

                    {/* Financial Management */}
                    <Text style={styles.categoryLabel}>💰 Gestión Financiera</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('Expenses')}
                        >
                            <MaterialCommunityIcons name="cash-minus" size={32} color="#e74c3c" />
                            <Text style={styles.quickAccessTitle}>Gastos</Text>
                            <Text style={styles.quickAccessSubtitle}>Operativos</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('SupplierOrders')}
                        >
                            <MaterialCommunityIcons name="cube-send" size={32} color="#3498db" />
                            <Text style={styles.quickAccessTitle}>Pedidos</Text>
                            <Text style={styles.quickAccessSubtitle}>Proveedores</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('ShippingPackages')}
                        >
                            <MaterialCommunityIcons name="package-variant" size={32} color="#f39c12" />
                            <Text style={styles.quickAccessTitle}>Paquetes</Text>
                            <Text style={styles.quickAccessSubtitle}>Envíos</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('ShippingRates')}
                        >
                            <MaterialCommunityIcons name="currency-usd" size={32} color="#16a085" />
                            <Text style={styles.quickAccessTitle}>Tarifas</Text>
                            <Text style={styles.quickAccessSubtitle}>Transporte</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Business Intelligence */}
                    <Text style={styles.categoryLabel}>📊 Inteligencia de Negocio</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('Analytics')}
                        >
                            <MaterialCommunityIcons name="google-analytics" size={32} color="#9b59b6" />
                            <Text style={styles.quickAccessTitle}>Analytics</Text>
                            <Text style={styles.quickAccessSubtitle}>Productos</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('RestockAdvisor')}
                        >
                            <MaterialCommunityIcons name="truck-delivery" size={32} color="#1abc9c" />
                            <Text style={styles.quickAccessTitle}>Restock</Text>
                            <Text style={styles.quickAccessSubtitle}>Advisor</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('Promotions')}
                        >
                            <MaterialCommunityIcons name="sale" size={32} color="#e91e63" />
                            <Text style={styles.quickAccessTitle}>Promociones</Text>
                            <Text style={styles.quickAccessSubtitle}>Activas</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Security & Audit */}
                    <Text style={styles.categoryLabel}>🔒 Seguridad</Text>
                    <View style={styles.quickAccessGrid}>
                        <TouchableOpacity
                            style={styles.quickAccessCard}
                            onPress={() => navigation.navigate('ActivityLog')}
                        >
                            <MaterialCommunityIcons name="shield-account" size={32} color="#d4af37" />
                            <Text style={styles.quickAccessTitle}>Auditoría</Text>
                            <Text style={styles.quickAccessSubtitle}>Actividad</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Debt Projection Card */}
                {totalDebt > 0 && (
                    <TouchableOpacity
                        style={[styles.chartCard, { borderLeftWidth: 5, borderLeftColor: '#e74c3c' }]}
                        onPress={() => navigation.navigate('SupplierOrders')}
                    >
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
                            data={{
                                labels: salesData.labels,
                                datasets: [{ data: salesData.data }]
                            }}
                            width={screenWidth - 60}
                            height={220}
                            chartConfig={{
                                backgroundColor: '#1e1e1e',
                                backgroundGradientFrom: '#1e1e1e',
                                backgroundGradientTo: '#1e1e1e',
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(212, 175, 55, ${opacity})`,
                                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                style: { borderRadius: 16 },
                                propsForDots: {
                                    r: '6',
                                    strokeWidth: '2',
                                    stroke: '#d4af37'
                                }
                            }}
                            bezier
                            style={styles.chart}
                        />
                    ) : (
                        <Text style={styles.noDataText}>No hay datos suficientes para mostrar</Text>
                    )}
                </View>

                {/* Business Progress Chart (Net Balance) */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>RECUPERACIÓN DE INVERSIÓN (ROI)</Text>
                    {progressData.datasets?.length > 0 ? (
                        <View>
                            {progressChart}
                            {tooltip.visible && (
                                <View style={{
                                    position: 'absolute',
                                    top: tooltip.y - 20,
                                    left: (tooltip.index === (progressData.labels.length - 1) || tooltip.x > (screenWidth - 100)) ? tooltip.x - 50 : tooltip.x - 30,
                                    backgroundColor: '#333',
                                    padding: 8,
                                    borderRadius: 8,
                                    zIndex: 100,
                                    borderWidth: 1,
                                    borderColor: Number(tooltip.value) >= 0 ? '#2ecc71' : '#e74c3c'
                                }}>
                                    <Text style={{ color: Number(tooltip.value) >= 0 ? '#2ecc71' : '#e74c3c', fontWeight: 'bold' }}>
                                        ${Number(tooltip.value).toFixed(2)}
                                    </Text>
                                </View>
                            )}
                        </View>
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
                            width={screenWidth - 60}
                            height={220}
                            chartConfig={{
                                color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                            }}
                            accessor="quantity"
                            backgroundColor="transparent"
                            paddingLeft="15"
                            absolute
                        />
                    ) : (
                        <Text style={styles.noDataText}>No hay datos de productos disponibles</Text>
                    )}
                </View>

                {/* Hardware (Aliados) Performance Breakdown */}
                <View style={styles.chartCard}>
                    <Text style={styles.sectionTitle}>DESEMPEÑO POR ALIADO (HARDWARE)</Text>
                    <Text style={[styles.settingsDesc, { marginTop: -5, marginBottom: 15 }]}>
                        Ventas totales atribuidas a cada dispositivo físico autorizado.
                    </Text>
                    {deviceData.length > 0 ? (
                        <View>
                            {deviceData.map((d, i) => (
                                <View key={i} style={{
                                    flexDirection: 'row',
                                    justifyContent: 'space-between',
                                    paddingVertical: 12,
                                    borderBottomWidth: i === deviceData.length - 1 ? 0 : 1,
                                    borderBottomColor: '#222'
                                }}>
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
                    <Text style={styles.settingsDesc}>
                        Define el porcentaje de ganancia que reciben los vendedores por cada venta
                    </Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={commissionRate}
                            onChangeText={setCommissionRate}
                            keyboardType="numeric"
                            placeholder="10"
                            placeholderTextColor="#666"
                        />
                        <Text style={styles.inputSuffix}>%</Text>
                    </View>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={updateCommissionRate}
                        disabled={loading}
                    >
                        <MaterialCommunityIcons name="content-save" size={20} color="black" />
                        <Text style={styles.saveButtonText}>GUARDAR CAMBIOS</Text>
                    </TouchableOpacity>
                </View>


                {/* AI Settings */}
                <View style={styles.settingsCard}>
                    <Text style={styles.sectionTitle}>GEMINI AI (Google API Key)</Text>
                    <Text style={styles.settingsDesc}>
                        Pega aquí tu llave de Google (gratis) para activar el Asistente de Marketing y el Escáner de Recibos.
                    </Text>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={[styles.input, { fontSize: 14, textAlign: 'left' }]}
                            value={googleKey}
                            onChangeText={setGoogleKey}
                            placeholder="AIzaSy..."
                            placeholderTextColor="#666"
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        style={styles.saveButton}
                        onPress={updateGoogleKey}
                        disabled={loading}
                    >
                        <MaterialCommunityIcons name="google" size={20} color="black" />
                        <Text style={styles.saveButtonText}>ACTIVAR GEMINI ♊</Text>
                    </TouchableOpacity>
                </View>

                {/* Profit Split & Monthly Closing */}
                <View style={styles.settingsCard}>
                    <Text style={styles.sectionTitle}>REPARTO DE GANANCIAS (CIERRE)</Text>
                    <Text style={styles.settingsDesc}>
                        Configura cómo se divide la Ganancia Neta (después de gastos y comisiones).
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>IMPERIO %</Text>
                            <TextInput
                                style={[styles.input, { fontSize: 18 }]}
                                value={profitSplit.imperio.toString()}
                                onChangeText={(v) => setProfitSplit({ ...profitSplit, imperio: parseInt(v) || 0 })}
                                keyboardType="numeric"
                            />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.miniLabel}>VENDEDORES %</Text>
                            <TextInput
                                style={[styles.input, { fontSize: 18 }]}
                                value={profitSplit.vendedores.toString()}
                                onChangeText={(v) => setProfitSplit({ ...profitSplit, vendedores: parseInt(v) || 0 })}
                                keyboardType="numeric"
                            />
                        </View>
                    </View>

                    <View style={styles.closingSummary}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Ganancia Neta:</Text>
                            <Text style={styles.summaryValue}>${stats.netProfit.toFixed(0)}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Para el Imperio ({profitSplit.imperio}%):</Text>
                            <Text style={[styles.summaryValue, { color: '#2ecc71' }]}>
                                ${(stats.netProfit * (profitSplit.imperio / 100)).toFixed(0)}
                            </Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryText}>Para Vendedores ({profitSplit.vendedores}%):</Text>
                            <Text style={[styles.summaryValue, { color: '#3498db' }]}>
                                ${(stats.netProfit * (profitSplit.vendedores / 100)).toFixed(0)}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={[styles.saveButton, { backgroundColor: '#25D366' }]}
                        onPress={() => {
                            const msg = `📊 *CIERRE MENSUAL - DB EMPIRE*\n\n` +
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

    // Month Navigation Styles
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

    // Quick Access Styles
    quickAccessSection: { marginBottom: 20 },
    categoryLabel: { color: '#999', fontSize: 13, fontWeight: 'bold', marginTop: 15, marginBottom: 10, letterSpacing: 0.5 },
    quickAccessGrid: { flexDirection: 'row', gap: 12, marginBottom: 10, flexWrap: 'wrap' },
    quickAccessCard: {
        flex: 1,
        minWidth: '30%',
        backgroundColor: '#1e1e1e',
        padding: 18,
        borderRadius: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#333',
        gap: 8
    },
    quickAccessTitle: { color: '#fff', fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
    quickAccessSubtitle: { color: '#666', fontSize: 10, textAlign: 'center' }
});
