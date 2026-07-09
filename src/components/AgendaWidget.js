import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    FlatList,
    Platform,
    Dimensions,
    ActivityIndicator,
    Alert
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useReminderStore } from '../store/useReminderStore';
import { useAuthStore } from '../store/useAuthStore';

// Web standard HTML5 Input for Date and Time
const WebDateTimePicker = ({ value, onChange }) => {
    // Format Date object to YYYY-MM-DDThh:mm for HTML5 datetime-local input
    const formatDateForInput = (date) => {
        const pad = (n) => String(n).padStart(2, '0');
        const y = date.getFullYear();
        const m = pad(date.getMonth() + 1);
        const d = pad(date.getDate());
        const h = pad(date.getHours());
        const min = pad(date.getMinutes());
        return `${y}-${m}-${d}T${h}:${min}`;
    };

    return (
        <input
            type="datetime-local"
            value={formatDateForInput(value)}
            onChange={(e) => {
                if (e.target.value) {
                    onChange(new Date(e.target.value));
                }
            }}
            style={{
                backgroundColor: '#111',
                color: '#fff',
                border: '1.5px solid rgba(212, 175, 55, 0.3)',
                borderRadius: 12,
                padding: 12,
                fontSize: 14,
                fontFamily: 'sans-serif',
                colorScheme: 'dark',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box'
            }}
        />
    );
};

export default function AgendaWidget() {
    const insets = useSafeAreaInsets();
    const userRole = useAuthStore(state => state.userRole);
    const { reminders, loadingReminders, initStore, addReminder, deleteReminder, toggleReminderCompleted } = useReminderStore();

    const [modalVisible, setModalVisible] = useState(false);
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');
    const [dueDate, setDueDate] = useState(new Date(Date.now() + 15 * 60000)); // Default to 15m in the future
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [formExpanded, setFormExpanded] = useState(false);

    // Initialize store when mounted and role changes (meaning user logs in)
    useEffect(() => {
        if (userRole) {
            initStore();
        }
    }, [userRole]);

    // Don't render the floating widget if user is not logged in
    if (!userRole) return null;

    // Filter reminders
    const pendingReminders = reminders.filter(r => r.completed === 0);
    const completedReminders = reminders.filter(r => r.completed === 1);

    // Check if there are active reminders today or overdue
    const hasPendingTodayOrOverdue = reminders.some(r => {
        if (r.completed === 1) return false;
        const d = new Date(r.due_date);
        const today = new Date();
        return d.toDateString() === today.toDateString() || d.getTime() < today.getTime();
    });

    const handleAdd = async () => {
        if (!title.trim()) {
            if (Platform.OS === 'web') alert('El título del recordatorio es obligatorio.');
            else Alert.alert('Campo Obligatorio', 'El título del recordatorio es obligatorio.');
            return;
        }

        if (dueDate.getTime() <= Date.now()) {
            if (Platform.OS === 'web') alert('La fecha y hora del recordatorio deben ser en el futuro.');
            else Alert.alert('Fecha Inválida', 'La fecha y hora del recordatorio deben ser en el futuro.');
            return;
        }

        try {
            await addReminder(title.trim(), notes.trim(), dueDate.toISOString());
            setTitle('');
            setNotes('');
            setDueDate(new Date(Date.now() + 15 * 60000));
            setFormExpanded(false);
            if (Platform.OS === 'web') alert('Recordatorio programado con éxito.');
            else Alert.alert('✅ Agenda', 'Recordatorio programado con éxito.');
        } catch (e) {
            if (Platform.OS === 'web') alert('Error al guardar el recordatorio.');
            else Alert.alert('Error', 'No se pudo guardar el recordatorio.');
        }
    };

    const formatDueDate = (dateString) => {
        try {
            const d = new Date(dateString);
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
            
            const diffTime = targetDate - today;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            
            if (diffDays === 0) {
                return `Hoy, ${timeStr}`;
            } else if (diffDays === 1) {
                return `Mañana, ${timeStr}`;
            } else if (diffDays === -1) {
                return `Ayer, ${timeStr}`;
            } else {
                const day = d.getDate();
                const month = d.toLocaleDateString('es-AR', { month: 'short' });
                return `${day} ${month}, ${timeStr}`;
            }
        } catch (err) {
            return dateString;
        }
    };

    const onDateChange = (event, date) => {
        setShowDatePicker(false);
        if (date) {
            const newDate = new Date(dueDate);
            newDate.setFullYear(date.getFullYear());
            newDate.setMonth(date.getMonth());
            newDate.setDate(date.getDate());
            setDueDate(newDate);
            // Immediately open time picker for smooth UX on Native
            if (Platform.OS !== 'ios') {
                setTimeout(() => setShowTimePicker(true), 150);
            } else {
                setShowTimePicker(true);
            }
        }
    };

    const onTimeChange = (event, time) => {
        setShowTimePicker(false);
        if (time) {
            const newDate = new Date(dueDate);
            newDate.setHours(time.getHours());
            newDate.setMinutes(time.getMinutes());
            setDueDate(newDate);
        }
    };

    const renderReminderItem = ({ item }) => {
        const isOverdue = new Date(item.due_date).getTime() < Date.now() && item.completed === 0;

        return (
            <View style={[
                styles.reminderCard, 
                item.completed === 1 && styles.reminderCardCompleted,
                isOverdue && styles.reminderCardOverdue
            ]}>
                <TouchableOpacity 
                    style={styles.checkBtn} 
                    onPress={() => toggleReminderCompleted(item.id)}
                >
                    <MaterialCommunityIcons 
                        name={item.completed === 1 ? "checkbox-marked" : "checkbox-blank-outline"} 
                        size={22} 
                        color={item.completed === 1 ? "#d4af37" : (isOverdue ? "#ff3b3b" : "#666")} 
                    />
                </TouchableOpacity>

                <View style={styles.reminderInfo}>
                    <Text style={[
                        styles.reminderTitle, 
                        item.completed === 1 && styles.textCompleted,
                        isOverdue && { color: '#ff3b3b' }
                    ]}>
                        {item.title}
                    </Text>
                    {item.notes ? (
                        <Text style={[
                            styles.reminderNotes, 
                            item.completed === 1 && styles.textCompleted
                        ]}>
                            {item.notes}
                        </Text>
                    ) : null}
                    <View style={styles.dueRow}>
                        <MaterialCommunityIcons 
                            name="clock-outline" 
                            size={12} 
                            color={item.completed === 1 ? "#444" : (isOverdue ? "#ff3b3b" : "#b8942e")} 
                        />
                        <Text style={[
                            styles.dueText, 
                            item.completed === 1 && styles.textCompleted,
                            isOverdue && { color: '#ff3b3b', fontWeight: 'bold' }
                        ]}>
                            {formatDueDate(item.due_date)} {isOverdue && '(Vencido)'}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity 
                    style={styles.deleteBtn} 
                    onPress={() => {
                        if (Platform.OS === 'web') {
                            if (window.confirm('¿Eliminar este recordatorio?')) deleteReminder(item.id);
                        } else {
                            Alert.alert('Eliminar', '¿Eliminar este recordatorio?', [
                                { text: 'Cancelar', style: 'cancel' },
                                { text: 'Eliminar', style: 'destructive', onPress: () => deleteReminder(item.id) }
                            ]);
                        }
                    }}
                >
                    <MaterialCommunityIcons name="delete-outline" size={18} color="#444" />
                </TouchableOpacity>
            </View>
        );
    };

    // Lazy load DateTimePicker only on Native to avoid web require crashes
    let DateTimePicker = null;
    if (Platform.OS !== 'web') {
        DateTimePicker = require('@react-native-community/datetimepicker').default;
    }

    return (
        <>
            {/* Floating Glassmorphism Agenda Button */}
            <TouchableOpacity 
                style={[
                    styles.floatingBadge, 
                    { top: Math.max(insets.top, 10) + 12 }
                ]}
                activeOpacity={0.8}
                onPress={() => setModalVisible(true)}
            >
                <BlurView intensity={70} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.badgeInner}>
                    <MaterialCommunityIcons name="calendar-clock" size={20} color="#d4af37" />
                    {hasPendingTodayOrOverdue && (
                        <View style={styles.redDot} />
                    )}
                </View>
            </TouchableOpacity>

            {/* Premium Fullscreen Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <BlurView intensity={95} tint="dark" style={StyleSheet.absoluteFill} />
                    <LinearGradient 
                        colors={['rgba(212, 175, 55, 0.08)', 'transparent', 'rgba(0, 0, 0, 0.5)']} 
                        style={StyleSheet.absoluteFill} 
                    />
                    
                    <View style={[styles.modalHeader, { paddingTop: Math.max(insets.top, 20) }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                            <View style={styles.titleIconBox}>
                                <MaterialCommunityIcons name="calendar-multiselect" size={22} color="#d4af37" />
                            </View>
                            <View>
                                <Text style={styles.headerTitle}>AGENDA IMPERIAL</Text>
                                <Text style={styles.headerSubtitle}>Bitácora de Recordatorios</Text>
                            </View>
                        </View>
                        <TouchableOpacity 
                            style={styles.closeModalBtn} 
                            onPress={() => setModalVisible(false)}
                        >
                            <MaterialCommunityIcons name="close" size={24} color="#666" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView 
                        style={styles.modalScroll}
                        contentContainerStyle={{ padding: 20, paddingBottom: 50 }}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Expandable Add form */}
                        <TouchableOpacity 
                            style={styles.formHeaderToggle}
                            activeOpacity={0.9}
                            onPress={() => setFormExpanded(!formExpanded)}
                        >
                            <MaterialCommunityIcons name={formExpanded ? "chevron-up" : "plus-circle-outline"} size={20} color="#d4af37" />
                            <Text style={styles.formToggleText}>
                                {formExpanded ? "OCULTAR FORMULARIO" : "CREAR NUEVO RECORDATORIO"}
                            </Text>
                        </TouchableOpacity>

                        {formExpanded && (
                            <View style={styles.addFormCard}>
                                <Text style={styles.inputLabel}>TÍTULO O RECORDATORIO *</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ej: Cobrar saldo a Gabriela, Llamar al proveedor..."
                                    placeholderTextColor="#444"
                                    value={title}
                                    onChangeText={setTitle}
                                    maxLength={80}
                                />

                                <Text style={styles.inputLabel}>DETALLES / NOTAS (OPCIONAL)</Text>
                                <TextInput
                                    style={[styles.input, styles.inputMultiline]}
                                    placeholder="Anotar detalles adicionales aquí..."
                                    placeholderTextColor="#444"
                                    value={notes}
                                    onChangeText={setNotes}
                                    multiline
                                    numberOfLines={3}
                                />

                                <Text style={styles.inputLabel}>DÍA Y HORA DE ALERTA</Text>
                                {Platform.OS === 'web' ? (
                                    <WebDateTimePicker 
                                        value={dueDate} 
                                        onChange={setDueDate} 
                                    />
                                ) : (
                                    <View style={styles.nativeDateRow}>
                                        <TouchableOpacity 
                                            style={styles.dateTimeSelector} 
                                            onPress={() => setShowDatePicker(true)}
                                        >
                                            <MaterialCommunityIcons name="calendar" size={18} color="#d4af37" />
                                            <Text style={styles.dateTimeSelectText}>
                                                {dueDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </Text>
                                        </TouchableOpacity>
                                        
                                        <TouchableOpacity 
                                            style={styles.dateTimeSelector} 
                                            onPress={() => setShowTimePicker(true)}
                                        >
                                            <MaterialCommunityIcons name="clock" size={18} color="#d4af37" />
                                            <Text style={styles.dateTimeSelectText}>
                                                {dueDate.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}

                                {/* Native DateTime pickers */}
                                {showDatePicker && DateTimePicker && (
                                    <DateTimePicker
                                        value={dueDate}
                                        mode="date"
                                        display="default"
                                        minimumDate={new Date()}
                                        onChange={onDateChange}
                                    />
                                )}

                                {showTimePicker && DateTimePicker && (
                                    <DateTimePicker
                                        value={dueDate}
                                        mode="time"
                                        display="default"
                                        onChange={onTimeChange}
                                    />
                                )}

                                <TouchableOpacity 
                                    style={styles.submitBtn} 
                                    onPress={handleAdd}
                                >
                                    <LinearGradient 
                                        colors={['#d4af37', '#b8942e']} 
                                        style={styles.submitGrad}
                                    >
                                        <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#000" />
                                        <Text style={styles.submitText}>AGENDAR Y PROGRAMAR ALERTA</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}

                        {loadingReminders ? (
                            <View style={styles.centerBox}>
                                <ActivityIndicator size="large" color="#d4af37" />
                            </View>
                        ) : reminders.length === 0 ? (
                            <View style={styles.emptyBox}>
                                <MaterialCommunityIcons name="calendar-blank" size={50} color="#333" />
                                <Text style={styles.emptyTitle}>Bóveda de Tareas vacía</Text>
                                <Text style={styles.emptySub}>No tienes tareas agendadas en este momento.</Text>
                            </View>
                        ) : (
                            <View style={{ marginTop: 10 }}>
                                {/* PENDING SECTION */}
                                {pendingReminders.length > 0 && (
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={styles.sectionHeader}>TAREAS PENDIENTES ({pendingReminders.length})</Text>
                                        <FlatList
                                            data={pendingReminders}
                                            keyExtractor={(item) => item.id}
                                            renderItem={renderReminderItem}
                                            scrollEnabled={false}
                                        />
                                    </View>
                                )}

                                {/* COMPLETED SECTION */}
                                {completedReminders.length > 0 && (
                                    <View style={{ marginBottom: 20 }}>
                                        <Text style={styles.sectionHeader}>COMPLETADAS / ARCHIVADAS ({completedReminders.length})</Text>
                                        <FlatList
                                            data={completedReminders}
                                            keyExtractor={(item) => item.id}
                                            renderItem={renderReminderItem}
                                            scrollEnabled={false}
                                        />
                                    </View>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    // Floating Button Badge
    floatingBadge: {
        position: 'absolute',
        alignSelf: 'center',
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(10, 10, 10, 0.45)',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.22)',
        overflow: 'hidden',
        zIndex: 9999,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    badgeInner: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    redDot: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ff3b3b',
        borderWidth: 1,
        borderColor: '#000',
    },

    // Modal
    modalContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#111',
    },
    titleIconBox: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    headerTitle: {
        color: '#d4af37',
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 2,
    },
    headerSubtitle: {
        color: '#666',
        fontSize: 10,
        fontWeight: 'bold',
        marginTop: 1,
    },
    closeModalBtn: {
        padding: 5,
    },
    modalScroll: {
        flex: 1,
    },

    // Accordion Toggle
    formHeaderToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#080808',
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.15)',
        marginBottom: 15,
    },
    formToggleText: {
        color: '#d4af37',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 1.5,
    },

    // Add Form Card
    addFormCard: {
        backgroundColor: '#080808',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#111',
        marginBottom: 20,
        gap: 12,
    },
    inputLabel: {
        color: '#666',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 1,
        marginBottom: 2,
    },
    input: {
        backgroundColor: '#111',
        borderWidth: 1.5,
        borderColor: '#1a1a1a',
        borderRadius: 12,
        padding: 12,
        color: '#fff',
        fontSize: 14,
    },
    inputMultiline: {
        height: 70,
        textAlignVertical: 'top',
    },
    nativeDateRow: {
        flexDirection: 'row',
        gap: 10,
    },
    dateTimeSelector: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#111',
        borderWidth: 1.5,
        borderColor: '#1a1a1a',
        borderRadius: 12,
        padding: 12,
    },
    dateTimeSelectText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    submitBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        marginTop: 6,
    },
    submitGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        paddingVertical: 14,
    },
    submitText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '950',
        letterSpacing: 0.5,
    },

    // List Headers
    sectionHeader: {
        color: '#444',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1.5,
        marginTop: 15,
        marginBottom: 10,
    },

    // Reminder Cards
    reminderCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#080808',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: '#111',
        marginBottom: 8,
        gap: 12,
    },
    reminderCardCompleted: {
        opacity: 0.45,
        borderColor: '#0b0b0b',
    },
    reminderCardOverdue: {
        borderColor: 'rgba(255, 59, 59, 0.25)',
        backgroundColor: 'rgba(255, 59, 59, 0.02)',
    },
    checkBtn: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    reminderInfo: {
        flex: 1,
        gap: 4,
    },
    reminderTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    reminderNotes: {
        color: '#888',
        fontSize: 11,
        lineHeight: 16,
    },
    dueRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    dueText: {
        color: '#b8942e',
        fontSize: 10,
        fontWeight: 'bold',
    },
    textCompleted: {
        textDecorationLine: 'line-through',
        color: '#555',
    },
    deleteBtn: {
        padding: 6,
    },

    // Empty state / Loader
    centerBox: {
        paddingVertical: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyBox: {
        paddingVertical: 80,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    emptyTitle: {
        color: '#555',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    emptySub: {
        color: '#333',
        fontSize: 11,
        textAlign: 'center',
        maxWidth: 220,
    }
});
