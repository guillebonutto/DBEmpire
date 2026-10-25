import React, { useState, useMemo, useEffect } from 'react';
import { navigate as globalNavigate } from '../navigation/navigationRef';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Platform,
    Dimensions,
    ActivityIndicator,
    Alert,
    StatusBar,
    RefreshControl,
    KeyboardAvoidingView
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useReminderStore } from '../store/useReminderStore';
import { EmpireAIService } from '../services/empireAIService';
import {
    CATEGORIES,
    DEFAULT_STAGES,
    parseReminderMeta,
    generateMonthGrid
} from '../utils/agendaUtils';

// Color Palette & Design Tokens (Dark Imperial / Luxe Gold)
const COLORS = {
    background: '#121316',
    surface: '#121316',
    surfaceLowest: '#0d0e11',
    surfaceLow: '#1b1b1f',
    surfaceContainer: '#1f1f23',
    surfaceHigh: '#292a2d',
    surfaceHighest: '#343538',
    onSurface: '#e3e2e6',
    onSurfaceVariant: '#d4c4af',
    primary: '#d4af37',
    primaryContainer: '#b5952f',
    primaryFixedDim: '#c5a059',
    tertiary: '#8aedff',
    tertiaryContainer: '#00d6ee',
    secondary: '#e2e2e9',
    secondaryFixed: '#e2e2e9',
    surfaceTint: '#d4af37',
    error: '#ffb4ab',
    border: '#2a2b2f',
    goldGlow: 'rgba(212, 175, 55, 0.3)',
};

const SEED_DEMO_ITEMS = [];

export default function ImperialAgendaView({ onClose, isScreen = false }) {
    const insets = useSafeAreaInsets();
    const androidStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    const topInset = Math.max(insets.top, androidStatusBarHeight);
    const headerTopPadding = topInset > 0 ? topInset + 8 : (isScreen ? 34 : 20);
    const {
        reminders,
        loadingReminders,
        fetchReminders,
        initStore,
        addReminder,
        updateReminder,
        deleteReminder,
        toggleReminderCompleted
    } = useReminderStore();

    useEffect(() => {
        initStore();
        fetchReminders();
    }, []);

    // Active bottom sub-tab: 'calendario' | 'videos' | 'boveda' | 'stats'
    const [activeTab, setActiveTab] = useState('calendario');

    // Calendar navigation state: year & month (0-indexed)
    const today = new Date();
    const [viewDate, setViewDate] = useState(() => {
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });

    // Selected date for day view
    const [selectedDate, setSelectedDate] = useState(() => new Date());

    // Active category filter: null means "All"
    const [selectedCategory, setSelectedCategory] = useState(null);

    // Modal state for programming a new video
    const [modalVisible, setModalVisible] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [newTitle, setNewTitle] = useState('');
    const [newCategory, setNewCategory] = useState('educativo');
    const [newStage, setNewStage] = useState('Guión en proceso');
    const [newNotes, setNewNotes] = useState('');
    const [newTime, setNewTime] = useState('18:00');
    const [saving, setSaving] = useState(false);
    const [suggestingAI, setSuggestingAI] = useState(false);

    // Ref to detect double click on calendar day cells
    const lastDayClickRef = React.useRef({ dateKey: null, time: 0 });

    // Month navigation helpers
    const currentYear = viewDate.getFullYear();
    const currentMonth = viewDate.getMonth();

    const monthNames = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    const monthTitle = `${monthNames[currentMonth]} ${currentYear}`;

    const handlePrevMonth = () => {
        setViewDate(new Date(currentYear, currentMonth - 1, 1));
    };

    const handleNextMonth = () => {
        setViewDate(new Date(currentYear, currentMonth + 1, 1));
    };

    const handleSuggestContent = async () => {
        if (!newCategory) return;
        setSuggestingAI(true);
        try {
            const suggestion = await EmpireAIService.suggestContent(newCategory);
            if (suggestion) {
                if (suggestion.title) setNewTitle(suggestion.title);
                if (suggestion.notes) setNewNotes(suggestion.notes);
            }
        } catch (error) {
            console.error("Error fetching AI suggestion:", error);
            Alert.alert("Error AI", "No se pudo conectar con el Coach.");
        } finally {
            setSuggestingAI(false);
        }
    };

    const handleSaveReminder = async () => {
        const now = new Date();
        setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(now);
    };

    const handleTodayJump = () => {
        const now = new Date();
        setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
        setSelectedDate(now);
    };

    // Items grouped from store
    const allItems = useMemo(() => {
        return reminders.map(r => {
            const meta = parseReminderMeta(r);
            return {
                id: r.id,
                title: r.title,
                category: meta.category,
                stage: meta.stage,
                customText: meta.customText,
                date: r.due_date,
                completed: r.completed === 1,
                isFromStore: true,
            };
        });
    }, [reminders]);

    // Items grouped by day "YYYY-MM-DD"
    const itemsByDay = useMemo(() => {
        const map = {};
        allItems.forEach(item => {
            try {
                const d = new Date(item.date);
                if (isNaN(d.getTime())) return;
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                if (!map[key]) map[key] = [];
                map[key].push(item);
            } catch (_) {}
        });
        return map;
    }, [allItems]);

    // Compute calendar cells for current viewDate
    const calendarGrid = useMemo(() => {
        return generateMonthGrid(viewDate.getFullYear(), viewDate.getMonth());
    }, [viewDate]);

    // Selected day key (YYYY-MM-DD)
    const selectedDateKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;

    // Filtered items for selected day
    const selectedDayItems = useMemo(() => {
        const list = itemsByDay[selectedDateKey] || [];
        if (!selectedCategory) return list;
        return list.filter(item => item.category === selectedCategory);
    }, [itemsByDay, selectedDateKey, selectedCategory]);

    // Upcoming preview items (next days)
    const upcomingItem = useMemo(() => {
        const nextDay = new Date(selectedDate);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextKey = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;
        const items = itemsByDay[nextKey];
        if (items && items.length > 0) {
            return {
                ...items[0],
                targetDayLabel: `Para Mañana • ${nextDay.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })}`,
            };
        }
        return null;
    }, [itemsByDay, selectedDate]);

    // Format selected date badge (e.g. "Mié 16 Oct")
    const formattedBadgeDate = useMemo(() => {
        const weekday = selectedDate.toLocaleDateString('es-AR', { weekday: 'short' });
        const day = selectedDate.getDate();
        const month = selectedDate.toLocaleDateString('es-AR', { month: 'short' });
        const cleanWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1, 3);
        const cleanMonth = month.charAt(0).toUpperCase() + month.slice(1, 3);
        return `${cleanWeekday} ${day} ${cleanMonth}`;
    }, [selectedDate]);

    // Handler to toggle complete
    const handleToggleCheck = async (item) => {
        if (item.isFromStore) {
            await toggleReminderCompleted(item.id);
        }
    };

    // Handler to schedule a new video / reminder
    const handleScheduleVideo = async () => {
        if (!newTitle.trim()) {
            if (Platform.OS === 'web') alert('Por favor ingresa un título para el video.');
            else Alert.alert('Campo requerido', 'Por favor ingresa un título para el video.');
            return;
        }

        setSaving(true);
        try {
            // Combine selected date with newTime
            const [hours, mins] = newTime.split(':').map(Number);
            const targetDate = new Date(selectedDate);
            targetDate.setHours(hours || 18, mins || 0, 0, 0);

            // If time is in past for today, set at least 5 mins ahead
            if (targetDate.getTime() <= Date.now()) {
                targetDate.setTime(Date.now() + 15 * 60000);
            }

            const notePayload = {
                category: newCategory,
                stage: newStage,
                text: newNotes.trim(),
            };

            if (editingId) {
                await updateReminder(editingId, newTitle.trim(), notePayload, targetDate.toISOString());
            } else {
                await addReminder(newTitle.trim(), notePayload, targetDate.toISOString());
            }

            setNewTitle('');
            setNewNotes('');
            setEditingId(null);
            setModalVisible(false);

            if (Platform.OS === 'web') alert(editingId ? '¡Video actualizado!' : '¡Video programado con éxito!');
            else Alert.alert('✅ Agenda Imperial', editingId ? 'Video actualizado.' : 'Video programado con éxito.');
        } catch (e) {
            console.error('Error scheduling video:', e);
            if (Platform.OS === 'web') alert('Error al guardar.');
            else Alert.alert('Error', 'No se pudo programar el video.');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteReminder = (id) => {
        Alert.alert(
            "Eliminar Contenido",
            "¿Estás seguro de que deseas eliminar este contenido? Esta acción no se puede deshacer.",
            [
                { text: "Cancelar", style: "cancel" },
                { text: "Eliminar", style: "destructive", onPress: () => deleteReminder(id) }
            ]
        );
    };

    const handleEditReminder = (item) => {
        setEditingId(item.id);
        setNewTitle(item.title);
        const cat = CATEGORIES.find(c => c.id === item.category);
        if (cat) setNewCategory(cat.id);
        setNewStage(item.stage || 'Idea / Concepto');
        setNewNotes(item.customText || '');
        const d = new Date(item.date);
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        setNewTime(`${h}:${m}`);
        setSelectedDate(d);
        setModalVisible(true);
    };

    // Format time for card
    const formatCardTime = (dateStr) => {
        try {
            const d = new Date(dateStr);
            const h = String(d.getHours()).padStart(2, '0');
            const m = String(d.getMinutes()).padStart(2, '0');
            return `${h}:${m} hs`;
        } catch (_) {
            return '18:00 hs';
        }
    };

    // Render category indicator bars inside calendar cell
    const renderDayIndicators = (dateKey) => {
        const items = itemsByDay[dateKey] || [];
        if (items.length === 0) return null;

        // Filter by active category if selected
        const displayed = selectedCategory
            ? items.filter(i => i.category === selectedCategory)
            : items;

        if (displayed.length === 0) return null;

        return (
            <View style={styles.cellBarsContainer}>
                {displayed.slice(0, 3).map((item, idx) => {
                    const catObj = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                    return (
                        <View
                            key={idx}
                            style={[
                                styles.cellBar,
                                { backgroundColor: catObj.color },
                            ]}
                        />
                    );
                })}
            </View>
        );
    };

    // Sub-view: Content Ideas / Scripts
    const renderIdeasTab = () => {
        const pendingIdeas = allItems.filter(i => !i.completed);
        return (
            <ScrollView
                contentContainerStyle={styles.tabContentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={loadingReminders}
                        onRefresh={fetchReminders}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
            >
                <View style={styles.subViewHeader}>
                    <MaterialCommunityIcons name="lightbulb-on" size={24} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.subViewTitle}>BANCO DE IDEAS & GUIONES</Text>
                        <Text style={styles.subViewSubtitle}>Producción en cola de grabación</Text>
                    </View>
                </View>
                {pendingIdeas.map((item, index) => {
                    const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                    return (
                        <View key={item.id || index} style={[styles.ideaCard, { borderLeftColor: cat.color }]}>
                            <View style={{ flex: 1 }}>
                                <View style={styles.cardBadgeRow}>
                                    <View style={[styles.categoryPill, { backgroundColor: cat.bgColor }]}>
                                        <Text style={[styles.categoryPillText, { color: cat.color }]}>{cat.label}</Text>
                                    </View>
                                    <Text style={styles.cardTimeText}>{formatCardTime(item.date)}</Text>
                                </View>
                                <Text style={styles.cardTitle}>{item.title}</Text>
                                <Text style={styles.ideaStageText}>{item.stage}</Text>
                            </View>
                        </View>
                    );
                })}
            </ScrollView>
        );
    };

    // Sub-view: Bóveda / Archivados
    const renderVaultTab = () => {
        const completedItems = allItems.filter(i => i.completed);
        return (
            <ScrollView
                contentContainerStyle={styles.tabContentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={loadingReminders}
                        onRefresh={fetchReminders}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
            >
                <View style={styles.subViewHeader}>
                    <MaterialCommunityIcons name="lock-clock" size={24} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.subViewTitle}>BÓVEDA DE PUBLICACIONES</Text>
                        <Text style={styles.subViewSubtitle}>Historial de contenidos publicados y archivados</Text>
                    </View>
                </View>
                {completedItems.length === 0 ? (
                    <View style={styles.emptyStateContainer}>
                        <MaterialCommunityIcons name="archive-outline" size={48} color="#444" />
                        <Text style={styles.emptyStateTitle}>Sin contenidos archivados</Text>
                        <Text style={styles.emptyStateSubtitle}>Completa tareas en el calendario para guardarlas en la Bóveda.</Text>
                    </View>
                ) : (
                    completedItems.map((item, idx) => {
                        const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                        return (
                            <View key={item.id || idx} style={[styles.ideaCard, styles.vaultCard, { borderLeftColor: cat.color }]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.cardTitleDone}>{item.title}</Text>
                                    <Text style={styles.cardSubtitleDone}>Completado • {cat.label}</Text>
                                </View>
                                <MaterialCommunityIcons name="check-decagram" size={22} color={COLORS.primary} />
                            </View>
                        );
                    })
                )}
            </ScrollView>
        );
    };

    // Sub-view: Stats
    const renderStatsTab = () => {
        const total = allItems.length;
        const completed = allItems.filter(i => i.completed).length;
        const pending = total - completed;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        return (
            <ScrollView
                contentContainerStyle={styles.tabContentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={loadingReminders}
                        onRefresh={fetchReminders}
                        tintColor={COLORS.primary}
                        colors={[COLORS.primary]}
                    />
                }
            >
                <View style={styles.subViewHeader}>
                    <MaterialCommunityIcons name="chart-box-outline" size={24} color={COLORS.primary} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.subViewTitle}>MÉTRICAS DE CONTENIDO</Text>
                        <Text style={styles.subViewSubtitle}>Rendimiento del calendario de publicaciones</Text>
                    </View>
                </View>
                <View style={styles.statsGrid}>
                    <View style={styles.statBox}>
                        <Text style={styles.statValue}>{total}</Text>
                        <Text style={styles.statLabel}>TOTAL CONTENIDOS</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: COLORS.primaryContainer }]}>{pending}</Text>
                        <Text style={styles.statLabel}>EN PRODUCCIÓN</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: '#2ed573' }]}>{completed}</Text>
                        <Text style={styles.statLabel}>PUBLICADOS</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color: COLORS.tertiaryContainer }]}>{completionRate}%</Text>
                        <Text style={styles.statLabel}>TASA DE ENTREGA</Text>
                    </View>
                </View>
                <Text style={styles.sectionHeaderTitle}>DESGLOSE POR FORMATO</Text>
                {CATEGORIES.map(cat => {
                    const count = allItems.filter(i => i.category === cat.id).length;
                    return (
                        <View key={cat.id} style={styles.statCategoryRow}>
                            <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                            <Text style={styles.statCategoryName}>{cat.label}</Text>
                            <Text style={[styles.statCategoryCount, { color: cat.color }]}>{count} videos</Text>
                        </View>
                    );
                })}
            </ScrollView>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* HEADER IMPERIAL */}
            <View style={[styles.header, { paddingTop: headerTopPadding }]}>
                <View style={styles.headerLeft}>
                    <View style={styles.headerIconBox}>
                        <MaterialCommunityIcons name="calendar-month" size={24} color={COLORS.primary} />
                    </View>
                    <View style={styles.headerTitleContainer}>
                        <Text style={styles.headerTitle}>AGENDA IMPERIAL</Text>
                        <Text style={styles.headerSubtitle}>Bitácora de Recordatorios</Text>
                    </View>
                </View>
                <View style={styles.headerRight}>
                    <TouchableOpacity
                        style={styles.headerActionBtn}
                        onPress={() => fetchReminders()}
                        activeOpacity={0.7}
                    >
                        {loadingReminders ? (
                            <ActivityIndicator size="small" color={COLORS.primary} />
                        ) : (
                            <MaterialCommunityIcons name="sync" size={20} color={COLORS.onSurfaceVariant} />
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.headerActionBtn, { backgroundColor: 'rgba(212, 175, 55, 0.15)', borderWidth: 1, borderColor: 'rgba(212, 175, 55, 0.3)' }]}
                        onPress={() => {
                            if (onClose) onClose();
                            globalNavigate('PowerEmpireStrategy');
                        }}
                        activeOpacity={0.7}
                    >
                        <MaterialCommunityIcons name="lightning-bolt" size={20} color={COLORS.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.headerActionBtn}
                        onPress={() => {
                            if (Platform.OS === 'web') alert('Centro de Notificaciones: Todo sincronizado.');
                            else Alert.alert('Notificaciones', 'Sistema de alertas sincronizado con el dispositivo.');
                        }}
                    >
                        <MaterialCommunityIcons name="bell-outline" size={22} color={COLORS.onSurfaceVariant} />
                    </TouchableOpacity>
                    {onClose ? (
                        <TouchableOpacity style={styles.headerCloseBtn} onPress={onClose}>
                            <MaterialCommunityIcons name="close" size={20} color="#000" />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.headerAvatar}>
                            <MaterialCommunityIcons name="account" size={18} color="#000" />
                        </View>
                    )}
                </View>
            </View>

            {/* MAIN CONTENT AREA */}
            <View style={{ flex: 1 }}>
                {activeTab === 'calendario' && (
                    <ScrollView
                        style={styles.mainScroll}
                        contentContainerStyle={[styles.mainScrollContent, { paddingBottom: 110 }]}
                        showsVerticalScrollIndicator={false}
                        refreshControl={
                            <RefreshControl
                                refreshing={loadingReminders}
                                onRefresh={fetchReminders}
                                tintColor={COLORS.primary}
                                colors={[COLORS.primary]}
                            />
                        }
                    >
                        {/* SELECTOR DE MES & VISTA HOY */}
                        <View style={styles.monthNavRow}>
                            <View style={styles.monthTitleWrapper}>
                                <Text style={styles.calendarMonthTitle}>{monthTitle}</Text>
                                <View style={styles.monthArrows}>
                                    <TouchableOpacity
                                        style={styles.arrowBtn}
                                        onPress={handlePrevMonth}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="chevron-left" size={20} color={COLORS.onSurfaceVariant} />
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.arrowBtn}
                                        onPress={handleNextMonth}
                                        activeOpacity={0.7}
                                    >
                                        <MaterialCommunityIcons name="chevron-right" size={20} color={COLORS.onSurfaceVariant} />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.todayJumpBtn}
                                onPress={handleTodayJump}
                                activeOpacity={0.8}
                            >
                                <View style={styles.todayPulsingDot} />
                                <Text style={styles.todayJumpText}>HOY</Text>
                            </TouchableOpacity>
                        </View>

                        {/* FILTROS INTERACTIVOS DE CATEGORÍAS */}
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.categoryFiltersRow}
                        >
                            <TouchableOpacity
                                style={[
                                    styles.categoryFilterPill,
                                    selectedCategory === null && styles.categoryFilterPillActive,
                                ]}
                                onPress={() => setSelectedCategory(null)}
                                activeOpacity={0.8}
                            >
                                <View style={[styles.categoryDot, { backgroundColor: COLORS.primary }]} />
                                <Text style={[
                                    styles.categoryFilterText,
                                    selectedCategory === null && styles.categoryFilterTextActive,
                                ]}>
                                    Todos
                                </Text>
                            </TouchableOpacity>

                            {CATEGORIES.map(cat => {
                                const isSelected = selectedCategory === cat.id;
                                return (
                                    <TouchableOpacity
                                        key={cat.id}
                                        style={[
                                            styles.categoryFilterPill,
                                            isSelected && styles.categoryFilterPillActive,
                                        ]}
                                        onPress={() => setSelectedCategory(isSelected ? null : cat.id)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                                        <Text style={[
                                            styles.categoryFilterText,
                                            isSelected && styles.categoryFilterTextActive,
                                        ]}>
                                            {cat.label}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* CUADRÍCULA CALENDARIO MENSUAL (7 DÍAS x SEMANA) */}
                        <View style={styles.calendarContainer}>
                            {/* Días cabecera: L M M J V S D */}
                            <View style={styles.gridWeekHeader}>
                                {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                                    <View key={i} style={styles.dayHeaderCol}>
                                        <Text style={styles.dayHeaderText}>{d}</Text>
                                    </View>
                                ))}
                            </View>

                            {/* Celdas mensuales */}
                            <View style={styles.gridCellsWrapper}>
                                {calendarGrid.map((cell, idx) => {
                                    const isSelected = cell.dateKey === selectedDateKey;

                                    return (
                                        <TouchableOpacity
                                            key={idx}
                                            style={[
                                                styles.dayCell,
                                                !cell.isCurrentMonth && styles.dayCellDimmed,
                                                isSelected && styles.dayCellSelected,
                                            ]}
                                            onPress={() => {
                                                const now = Date.now();
                                                const isSameAsSelected = cell.dateKey === selectedDateKey;
                                                const isDoubleTap = lastDayClickRef.current.dateKey === cell.dateKey && (now - lastDayClickRef.current.time) < 400;

                                                lastDayClickRef.current = { dateKey: cell.dateKey, time: now };

                                                setSelectedDate(cell.date);
                                                // If day clicked is in prev or next month, shift view
                                                if (!cell.isCurrentMonth) {
                                                    setViewDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
                                                }

                                                // Solo abre el modal si se hace clic en el día ya seleccionado o si es doble clic
                                                if (isSameAsSelected || isDoubleTap) {
                                                    setEditingId(null);
                                                    setNewTitle('');
                                                    setNewNotes('');
                                                    setNewTime('18:00');
                                                    setModalVisible(true);
                                                }
                                            }}
                                            activeOpacity={0.7}
                                        >
                                            <View style={styles.dayCellTopRow}>
                                                <Text
                                                    style={[
                                                        styles.dayCellNumber,
                                                        !cell.isCurrentMonth && styles.dayCellNumberDimmed,
                                                        isSelected && styles.dayCellNumberSelected,
                                                    ]}
                                                >
                                                    {cell.day}
                                                </Text>
                                                {isSelected && (
                                                    <View style={styles.selectedDayDot} />
                                                )}
                                            </View>
                                            {renderDayIndicators(cell.dateKey)}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* BOTÓN DE ACCIÓN RÁPIDA: + PROGRAMAR VIDEO */}
                        <TouchableOpacity
                            style={styles.addVideoBtn}
                            onPress={() => {
                                setEditingId(null);
                                setNewTitle('');
                                setNewNotes('');
                                setNewTime('18:00');
                                setModalVisible(true);
                            }}
                            activeOpacity={0.88}
                        >
                            <View style={styles.addVideoIconCircle}>
                                <MaterialCommunityIcons name="plus" size={18} color="#000" />
                            </View>
                            <Text style={styles.addVideoBtnText}>PROGRAMAR VIDEO</Text>
                        </TouchableOpacity>

                        {/* DETALLE DEL DÍA SELECCIONADO / AGENDA */}
                        <View style={styles.dayDetailSection}>
                            <View style={styles.dayDetailHeaderRow}>
                                <View style={styles.dayDetailTitleBadge}>
                                    <Text style={styles.dayDetailTitle}>Agenda del Día</Text>
                                    <View style={styles.dateBadgePill}>
                                        <Text style={styles.dateBadgeText}>{formattedBadgeDate}</Text>
                                    </View>
                                </View>
                                <Text style={styles.contentsCountText}>
                                    {selectedDayItems.length === 1 ? '1 Contenido' : `${selectedDayItems.length} Contenidos`}
                                </Text>
                            </View>

                            {/* Tarjetas de Contenidos del Día */}
                            {selectedDayItems.length === 0 ? (
                                <View style={styles.emptyDayCard}>
                                    <MaterialCommunityIcons name="calendar-clock-outline" size={32} color="#555" />
                                    <Text style={styles.emptyDayText}>Sin videos programados para este día</Text>
                                    <TouchableOpacity
                                        style={styles.emptyDayScheduleBtn}
                                        onPress={() => setModalVisible(true)}
                                    >
                                        <Text style={styles.emptyDayScheduleBtnText}>+ Programar para {formattedBadgeDate}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                selectedDayItems.map((item, index) => {
                                    const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[0];
                                    const isDone = item.completed;

                                    return (
                                        <View key={item.id || index} style={styles.videoCard}>
                                            {/* Barra de acento izquierda de 4px */}
                                            <View style={[styles.cardAccentBar, { backgroundColor: cat.color }]} />

                                            <View style={styles.cardContent}>
                                                <View style={styles.cardBadgeRow}>
                                                    <View style={[styles.categoryPill, { backgroundColor: cat.bgColor }]}>
                                                        <Text style={[styles.categoryPillText, { color: cat.color }]}>
                                                            {cat.label}
                                                        </Text>
                                                    </View>
                                                    <Text style={styles.cardTimeText}>
                                                        {formatCardTime(item.date)}
                                                    </Text>
                                                </View>

                                                <Text
                                                    style={[
                                                        styles.cardTitle,
                                                        isDone && styles.cardTitleDone,
                                                    ]}
                                                    numberOfLines={2}
                                                >
                                                    {item.title}
                                                </Text>

                                                <View style={styles.cardStatusRow}>
                                                    <MaterialCommunityIcons
                                                        name={cat.icon}
                                                        size={14}
                                                        color={cat.color}
                                                    />
                                                    <Text style={styles.cardStatusText} numberOfLines={1}>
                                                        {item.stage || cat.defaultStage}
                                                    </Text>
                                                </View>
                                            </View>

                                            {/* Action Buttons: Edit / Delete */}
                                            <View style={{ position: 'absolute', right: 48, top: 12, flexDirection: 'row', gap: 10 }}>
                                                <TouchableOpacity onPress={() => handleEditReminder(item)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                                                    <MaterialCommunityIcons name="pencil-outline" size={20} color={COLORS.onSurfaceVariant} />
                                                </TouchableOpacity>
                                                <TouchableOpacity onPress={() => handleDeleteReminder(item.id)} hitSlop={{top:10, bottom:10, left:10, right:10}}>
                                                    <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.error} />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Check toggle button */}
                                            <TouchableOpacity
                                                style={[
                                                    styles.checkToggleBtn,
                                                    isDone && styles.checkToggleBtnDone,
                                                ]}
                                                onPress={() => handleToggleCheck(item)}
                                                activeOpacity={0.7}
                                            >
                                                <MaterialCommunityIcons
                                                    name={isDone ? 'check-all' : 'check'}
                                                    size={20}
                                                    color={isDone ? '#000' : COLORS.onSurfaceVariant}
                                                />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })
                            )}

                            {/* Tarjeta Próximo Recordatorio / Estrategia */}
                            {upcomingItem && (
                                <TouchableOpacity
                                    style={styles.upcomingCard}
                                    onPress={() => {
                                        const next = new Date(selectedDate);
                                        next.setDate(next.getDate() + 1);
                                        setSelectedDate(next);
                                    }}
                                    activeOpacity={0.8}
                                >
                                    <View style={[styles.cardAccentBar, { backgroundColor: COLORS.surfaceTint }]} />
                                    <View style={styles.cardContent}>
                                        <View style={styles.cardBadgeRow}>
                                            <View style={[styles.categoryPill, { backgroundColor: CATEGORIES.find(c => c.id === upcomingItem.category)?.bgColor || COLORS.goldGlow }]}>
                                                <Text style={[styles.categoryPillText, { color: CATEGORIES.find(c => c.id === upcomingItem.category)?.color || COLORS.surfaceTint }]}>
                                                    {CATEGORIES.find(c => c.id === upcomingItem.category)?.label || 'Próximo'}
                                                </Text>
                                            </View>
                                            <Text style={styles.cardTimeText}>{upcomingItem.targetDayLabel}</Text>
                                        </View>
                                        <Text style={styles.cardTitle} numberOfLines={1}>
                                            {upcomingItem.title}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons
                                        name="chevron-right"
                                        size={20}
                                        color={COLORS.onSurfaceVariant}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    </ScrollView>
                )}

                {activeTab === 'videos' && renderIdeasTab()}
                {activeTab === 'boveda' && renderVaultTab()}
                {activeTab === 'stats' && renderStatsTab()}
            </View>

            {/* MODAL: PROGRAMAR VIDEO / RECORDATORIO */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    style={styles.modalOverlay}
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                >
                    <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                    <TouchableOpacity 
                        style={StyleSheet.absoluteFill} 
                        activeOpacity={1} 
                        onPress={() => setModalVisible(false)} 
                    />
                    <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
                        <View style={styles.modalSheetHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={styles.modalHeaderIconBadge}>
                                    <MaterialCommunityIcons name="video-plus" size={22} color={COLORS.primary} />
                                </View>
                                <View>
                                    <Text style={styles.modalSheetTitle}>
                                        {editingId ? 'EDITAR CONTENIDO' : 'PROGRAMAR NUEVO VIDEO'}
                                    </Text>
                                    <Text style={styles.modalSheetSubtitle}>
                                        {formattedBadgeDate}
                                    </Text>
                                </View>
                            </View>
                            <TouchableOpacity 
                                style={styles.modalCloseCircle} 
                                onPress={() => setModalVisible(false)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <MaterialCommunityIcons name="close" size={20} color="#aaa" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            showsVerticalScrollIndicator={false} 
                            style={styles.modalScrollBody}
                            contentContainerStyle={styles.modalScrollContent}
                            keyboardShouldPersistTaps="handled"
                        >
                            <Text style={styles.modalFieldLabel}>TÍTULO O CONCEPTO DEL VIDEO *</Text>
                            <TextInput
                                style={styles.modalTextInput}
                                placeholder="Ej: 5 Trucos de Edición en CapCut..."
                                placeholderTextColor="#555"
                                value={newTitle}
                                onChangeText={setNewTitle}
                                maxLength={100}
                            />

                            <Text style={styles.modalFieldLabel}>FORMATO / CATEGORÍA</Text>
                            <View style={styles.modalCategoryPickerRow}>
                                {CATEGORIES.map(cat => {
                                    const isSelected = newCategory === cat.id;
                                    return (
                                        <TouchableOpacity
                                            key={cat.id}
                                            style={[
                                                styles.modalCategoryOption,
                                                isSelected && { borderColor: cat.color, backgroundColor: cat.bgColor },
                                            ]}
                                            onPress={() => setNewCategory(cat.id)}
                                            activeOpacity={0.7}
                                        >
                                            <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
                                            <Text
                                                style={[
                                                    styles.modalCategoryOptionText,
                                                    isSelected && { color: cat.color, fontWeight: 'bold' },
                                                ]}
                                            >
                                                {cat.label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <TouchableOpacity 
                                style={[styles.aiSuggestBtn, suggestingAI && { opacity: 0.7 }]} 
                                onPress={handleSuggestContent}
                                disabled={suggestingAI}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="robot-outline" size={18} color="#d4af37" />
                                <Text style={styles.aiSuggestBtnText}>
                                    {suggestingAI ? 'GENERANDO SUGERENCIAS...' : 'PREGUNTAR AL COACH (IA)'}
                                </Text>
                            </TouchableOpacity>

                            <Text style={styles.modalFieldLabel}>ETAPA DE PRODUCCIÓN</Text>
                            <View style={styles.modalStagePickerRow}>
                                {DEFAULT_STAGES.map((st, i) => {
                                    const isSelected = newStage === st;
                                    return (
                                        <TouchableOpacity
                                            key={i}
                                            style={[
                                                styles.modalStageChip,
                                                isSelected && styles.modalStageChipActive,
                                            ]}
                                            onPress={() => setNewStage(st)}
                                            activeOpacity={0.7}
                                        >
                                            <Text
                                                style={[
                                                    styles.modalStageChipText,
                                                    isSelected && styles.modalStageChipTextActive,
                                                ]}
                                            >
                                                {st}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            <Text style={styles.modalFieldLabel}>HORA DE PUBLICACIÓN</Text>
                            <TextInput
                                style={styles.modalTextInput}
                                placeholder="Ej: 18:00 o 21:15"
                                placeholderTextColor="#555"
                                value={newTime}
                                onChangeText={setNewTime}
                            />

                            <Text style={styles.modalFieldLabel}>GUION / NOTAS ADICIONALES</Text>
                            <TextInput
                                style={[styles.modalTextInput, { height: 85, textAlignVertical: 'top' }]}
                                placeholder="Ideas clave, ganchos o notas..."
                                placeholderTextColor="#555"
                                multiline
                                numberOfLines={3}
                                value={newNotes}
                                onChangeText={setNewNotes}
                            />

                            <TouchableOpacity
                                style={styles.modalSubmitBtn}
                                onPress={handleScheduleVideo}
                                disabled={saving}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={['#d4af37', '#b5952f']}
                                    style={styles.modalSubmitGradient}
                                >
                                    {saving ? (
                                        <ActivityIndicator color="#000" size="small" />
                                    ) : (
                                        <>
                                            <MaterialCommunityIcons name="calendar-check" size={20} color="#000" />
                                            <Text style={styles.modalSubmitText}>GUARDAR Y SINCRONIZAR</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* BARRA DE NAVEGACIÓN INFERIOR (SUB-TABS) */}
            <View style={[styles.bottomNav, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => setActiveTab('calendario')}
                >
                    <MaterialCommunityIcons
                        name="calendar-month"
                        size={22}
                        color={activeTab === 'calendario' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navLabel, activeTab === 'calendario' && styles.navLabelActive]}>
                        Calendario
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => setActiveTab('videos')}
                >
                    <MaterialCommunityIcons
                        name="video-vintage"
                        size={22}
                        color={activeTab === 'videos' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navLabel, activeTab === 'videos' && styles.navLabelActive]}>
                        Videos/Ideas
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => setActiveTab('boveda')}
                >
                    <MaterialCommunityIcons
                        name="lock-clock"
                        size={22}
                        color={activeTab === 'boveda' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navLabel, activeTab === 'boveda' && styles.navLabelActive]}>
                        Bóveda
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.navItem}
                    onPress={() => setActiveTab('stats')}
                >
                    <MaterialCommunityIcons
                        name="chart-box-outline"
                        size={22}
                        color={activeTab === 'stats' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navLabel, activeTab === 'stats' && styles.navLabelActive]}>
                        Estadísticas
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },

    // HEADER
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: '#1a1b1f',
        zIndex: 50,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerIconBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceHigh,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(245, 185, 66, 0.25)',
        shadowColor: COLORS.primaryContainer,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    headerTitleContainer: {
        justifyContent: 'center',
    },
    headerTitle: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 1.5,
    },
    headerSubtitle: {
        color: COLORS.onSurfaceVariant,
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 1.8,
        textTransform: 'uppercase',
        marginTop: 2,
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerActionBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // MAIN SCROLL
    mainScroll: {
        flex: 1,
    },
    mainScrollContent: {
        paddingHorizontal: 18,
        paddingTop: 12,
    },

    // MONTH NAV
    monthNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
    },
    monthTitleWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    calendarMonthTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: COLORS.onSurface,
        letterSpacing: -0.5,
    },
    monthArrows: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    arrowBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceContainer,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todayJumpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceHigh,
    },
    todayPulsingDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: COLORS.primary,
    },
    todayJumpText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 1,
    },

    // CATEGORY FILTERS
    categoryFiltersRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingBottom: 14,
    },
    categoryFilterPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: COLORS.surfaceContainer,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryFilterPillActive: {
        backgroundColor: COLORS.surfaceHighest,
        borderColor: 'rgba(245, 185, 66, 0.4)',
        shadowColor: COLORS.primaryContainer,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    categoryFilterText: {
        color: COLORS.onSurface,
        fontSize: 11.5,
        fontWeight: '600',
    },
    categoryFilterTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },

    // CALENDAR GRID
    calendarContainer: {
        backgroundColor: COLORS.surfaceLowest,
        borderRadius: 16,
        padding: 10,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#1e1f24',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 6,
    },
    gridWeekHeader: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 6,
    },
    dayHeaderCol: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 4,
    },
    dayHeaderText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        fontWeight: '700',
    },
    gridCellsWrapper: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: `${100 / 7}%`,
        height: 56,
        padding: 4,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceLow,
        marginVertical: 2,
        justifyContent: 'space-between',
        borderWidth: 1,
        borderColor: '#191a1e',
    },
    dayCellDimmed: {
        opacity: 0.35,
    },
    dayCellSelected: {
        backgroundColor: COLORS.surfaceHighest,
        borderColor: 'rgba(245, 185, 66, 0.6)',
        shadowColor: COLORS.primaryContainer,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
        elevation: 8,
    },
    dayCellTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dayCellNumber: {
        fontSize: 12,
        fontWeight: '600',
        color: COLORS.onSurface,
    },
    dayCellNumberDimmed: {
        color: COLORS.onSurfaceVariant,
    },
    dayCellNumberSelected: {
        color: COLORS.primary,
        fontWeight: '800',
    },
    selectedDayDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: COLORS.primary,
    },
    cellBarsContainer: {
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        marginTop: 2,
    },
    cellBar: {
        width: '100%',
        height: 2.5,
        borderRadius: 2,
    },

    // QUICK ACTION BUTTON
    addVideoBtn: {
        width: '100%',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 14,
        backgroundColor: COLORS.surfaceHigh,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(245, 185, 66, 0.22)',
        shadowColor: COLORS.primaryContainer,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 5,
    },
    addVideoIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    addVideoBtnText: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 2,
    },

    // DAY DETAIL
    dayDetailSection: {
        gap: 10,
    },
    dayDetailHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    dayDetailTitleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    dayDetailTitle: {
        fontSize: 17,
        fontWeight: '700',
        color: COLORS.onSurface,
        letterSpacing: 0.3,
    },
    dateBadgePill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        backgroundColor: COLORS.surfaceContainer,
    },
    dateBadgeText: {
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: '700',
    },
    contentsCountText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11.5,
        fontWeight: '600',
    },

    // VIDEO CARDS
    videoCard: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 14,
        padding: 14,
        paddingLeft: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#26272c',
        overflow: 'hidden',
    },
    cardAccentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
    },
    cardContent: {
        flex: 1,
        gap: 4,
        paddingRight: 10,
    },
    cardBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    categoryPill: {
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 12,
    },
    categoryPillText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    cardTimeText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
    },
    cardTitle: {
        color: COLORS.onSurface,
        fontSize: 14.5,
        fontWeight: '700',
        marginTop: 1,
    },
    cardTitleDone: {
        textDecorationLine: 'line-through',
        color: '#777',
    },
    cardSubtitleDone: {
        color: '#555',
        fontSize: 11,
    },
    cardStatusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    cardStatusText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
    },
    checkToggleBtn: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: COLORS.surfaceHighest,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkToggleBtnDone: {
        backgroundColor: COLORS.primary,
    },

    // UPCOMING CARD
    upcomingCard: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: COLORS.surfaceLow,
        borderRadius: 14,
        padding: 14,
        paddingLeft: 16,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#222328',
        overflow: 'hidden',
    },

    // EMPTY DAY CARD
    emptyDayCard: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        paddingHorizontal: 20,
        backgroundColor: COLORS.surfaceLow,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#1e1f24',
        gap: 10,
    },
    emptyDayText: {
        color: '#666',
        fontSize: 13,
        fontWeight: '600',
    },
    emptyDayScheduleBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: COLORS.surfaceHigh,
    },
    emptyDayScheduleBtnText: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '700',
    },

    // SUB-VIEWS (Ideas, Bóveda, Stats)
    tabContentContainer: {
        padding: 20,
        paddingBottom: 110,
    },
    subViewHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#222',
    },
    subViewTitle: {
        color: COLORS.primary,
        fontSize: 15,
        fontWeight: '800',
        letterSpacing: 1,
    },
    subViewSubtitle: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
    },
    ideaCard: {
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderWidth: 1,
        borderColor: '#26272c',
    },
    ideaStageText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        marginTop: 6,
    },
    vaultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: 0.85,
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyStateTitle: {
        color: '#666',
        fontSize: 14,
        fontWeight: '700',
    },
    emptyStateSubtitle: {
        color: '#444',
        fontSize: 12,
        textAlign: 'center',
        maxWidth: 240,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 24,
    },
    statBox: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: COLORS.surfaceContainer,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#222',
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: '900',
        color: COLORS.onSurface,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: COLORS.onSurfaceVariant,
        letterSpacing: 1,
    },
    sectionHeaderTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: COLORS.onSurfaceVariant,
        letterSpacing: 1.5,
        marginBottom: 12,
    },
    statCategoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.surfaceContainer,
        padding: 12,
        borderRadius: 10,
        marginBottom: 8,
    },
    statCategoryName: {
        flex: 1,
        color: COLORS.onSurface,
        fontSize: 13,
        marginLeft: 10,
    },
    statCategoryCount: {
        fontSize: 12,
        fontWeight: '700',
    },

    // BOTTOM NAV
    bottomNav: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(18, 19, 22, 0.95)',
        borderTopWidth: 1,
        borderTopColor: '#1d1e22',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingTop: 10,
        zIndex: 100,
    },
    navItem: {
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 64,
        gap: 3,
    },
    navLabel: {
        fontSize: 10,
        fontWeight: '600',
        color: COLORS.onSurfaceVariant,
    },
    navLabelActive: {
        color: COLORS.primary,
        fontWeight: '800',
    },

    // MODAL FORM
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#18191d',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        paddingTop: 20,
        paddingHorizontal: 20,
        borderTopWidth: 1.5,
        borderTopColor: 'rgba(212, 175, 55, 0.4)',
        maxHeight: Dimensions.get('window').height * 0.88,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.5,
        shadowRadius: 16,
        elevation: 20,
    },
    modalSheetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#25262c',
    },
    modalHeaderIconBadge: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalCloseCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#222329',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalSheetTitle: {
        color: COLORS.primary,
        fontSize: 14.5,
        fontWeight: '900',
        letterSpacing: 1.2,
    },
    modalSheetSubtitle: {
        color: '#888',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    modalScrollBody: {
        flexGrow: 0,
    },
    modalScrollContent: {
        paddingBottom: 24,
    },
    modalFieldLabel: {
        color: '#c4b59d',
        fontSize: 10.5,
        fontWeight: '800',
        letterSpacing: 1,
        marginTop: 14,
        marginBottom: 8,
    },
    modalTextInput: {
        backgroundColor: '#0d0e11',
        borderWidth: 1,
        borderColor: '#2e3038',
        borderRadius: 12,
        padding: 13,
        color: '#fff',
        fontSize: 14,
    },
    aiSuggestBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
        paddingVertical: 11,
        borderRadius: 10,
        marginTop: 12,
        marginBottom: 4,
    },
    aiSuggestBtnText: {
        color: '#d4af37',
        fontSize: 11.5,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    modalCategoryPickerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    modalCategoryOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
        backgroundColor: '#0d0e11',
        borderWidth: 1,
        borderColor: '#2e3038',
    },
    modalCategoryOptionText: {
        color: COLORS.onSurface,
        fontSize: 12,
    },
    modalStagePickerRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 7,
    },
    modalStageChip: {
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 9,
        backgroundColor: '#0d0e11',
        borderWidth: 1,
        borderColor: '#2e3038',
    },
    modalStageChipActive: {
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        borderColor: COLORS.primary,
    },
    modalStageChipText: {
        color: '#888',
        fontSize: 11,
    },
    modalStageChipTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    modalSubmitBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 22,
        marginBottom: 6,
    },
    modalSubmitGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 15,
        gap: 8,
    },
    modalSubmitText: {
        color: '#000',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 1,
    },
});
