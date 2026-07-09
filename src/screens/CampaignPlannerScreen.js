import React, { useState, useEffect, useMemo } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ScrollView,
    TextInput, Modal, ActivityIndicator, Alert, Share, StatusBar
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { useProductStore } from '../store/useProductStore';
import { GeminiService } from '../services/geminiService';

// Helper to calculate the N-th Sunday of a given month
const getNthSunday = (year, month, n) => {
    let count = 0;
    for (let day = 1; day <= 31; day++) {
        const date = new Date(year, month, day);
        if (date.getDay() === 0) { // 0 is Sunday
            count++;
            if (count === n) {
                return date;
            }
        }
    }
    return new Date(year, month, 15); // Fallback to middle of month
};

// Seasonal events list generator
const getSeasonalEvents = (year) => [
    { id: 'valentines', name: 'San Valentín 💖', month: 1, day: 14, isFixed: true, description: 'Regalos tecnológicos y accesorios de parejas.' },
    { id: 'hotsale', name: 'Hot Sale 🔥', month: 4, day: 15, isFixed: true, description: 'Días de mega ofertas online. Enfoque en volumen y combos.' },
    { id: 'father', name: 'Día del Padre 👔', month: 5, getNthSunday: (y) => getNthSunday(y, 5, 3), isFixed: false, description: 'Tercer domingo de Junio. Consolas, herramientas y gadgets.' },
    { id: 'friend', name: 'Día del Amigo 🤝', month: 6, day: 20, isFixed: true, description: '20 de Julio. Combos 2x1 y accesorios para regalar.' },
    { id: 'child', name: 'Día del Niño 🎮', month: 7, getNthSunday: (y) => getNthSunday(y, 7, 3), isFixed: false, description: 'Tercer domingo de Agosto. Mandos, auriculares y diversión.' },
    { id: 'mother', name: 'Día de la Madre 🌸', month: 9, getNthSunday: (y) => getNthSunday(y, 9, 3), isFixed: false, description: 'Tercer domingo de Octubre. Smartwatches, belleza y hogar.' },
    { id: 'cybermonday', name: 'CyberMonday ⚡', month: 10, day: 4, isFixed: true, description: 'Noviembre. Descuentos agresivos para liquidación de año.' },
    { id: 'christmas', name: 'Navidad 🎄', month: 11, day: 25, isFixed: true, description: '25 de Diciembre. La mayor campaña de regalos familiares.' }
];

export default function CampaignPlannerScreen({ navigation }) {
    const { products } = useProductStore();
    
    // States
    const [customEvents, setCustomEvents] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [newEventName, setNewEventName] = useState('');
    const [newEventDate, setNewEventDate] = useState('');
    const [newEventDesc, setNewEventDesc] = useState('');

    // AI suggestion Modal States
    const [aiModalVisible, setAiModalVisible] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiProposal, setAiProposal] = useState('');

    // Load custom events from local storage
    useEffect(() => {
        loadCustomEvents();
    }, []);

    const loadCustomEvents = async () => {
        try {
            const data = await AsyncStorage.getItem('custom_campaign_events');
            if (data) {
                setCustomEvents(JSON.parse(data));
            }
        } catch (e) {
            console.error('Error loading custom events', e);
        }
    };

    const handleSaveCustomEvent = async () => {
        if (!newEventName || !newEventDate) {
            Alert.alert('Faltan datos', 'Completa el nombre y la fecha del evento.');
            return;
        }

        // Date format validation (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(newEventDate)) {
            Alert.alert('Formato inválido', 'Usa el formato AAAA-MM-DD (ej: 2026-09-21)');
            return;
        }

        const parsedDate = new Date(newEventDate + 'T00:00:00');
        if (isNaN(parsedDate.getTime())) {
            Alert.alert('Fecha inválida', 'La fecha ingresada no es válida.');
            return;
        }

        const newEvent = {
            id: 'custom_' + Date.now(),
            name: newEventName,
            dateString: newEventDate,
            description: newEventDesc || 'Evento personalizado',
            isCustom: true
        };

        const updated = [...customEvents, newEvent];
        setCustomEvents(updated);
        await AsyncStorage.setItem('custom_campaign_events', JSON.stringify(updated));

        // Reset and close
        setNewEventName('');
        setNewEventDate('');
        setNewEventDesc('');
        setShowAddModal(false);
        Alert.alert('¡Éxito!', 'Evento guardado correctamente.');
    };

    const handleDeleteCustomEvent = (id) => {
        Alert.alert(
            'Eliminar Evento',
            '¿Estás seguro de que quieres eliminar este evento?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Eliminar',
                    style: 'destructive',
                    onPress: async () => {
                        const updated = customEvents.filter(e => e.id !== id);
                        setCustomEvents(updated);
                        await AsyncStorage.setItem('custom_campaign_events', JSON.stringify(updated));
                    }
                }
            ]
        );
    };

    // Calculate days remaining and event date for this or next year
    const calculateEventDetails = (event) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const currentYear = today.getFullYear();
        let targetDate;

        if (event.isCustom) {
            targetDate = new Date(event.dateString + 'T00:00:00');
            // If custom event already passed, increment its year for recurring if needed, 
            // or just calculate remaining days.
            if (targetDate < today) {
                targetDate.setFullYear(currentYear + 1);
            }
        } else {
            if (event.isFixed) {
                targetDate = new Date(currentYear, event.month, event.day);
            } else {
                targetDate = event.getNthSunday(currentYear);
            }

            // If it already passed this year, compute for the next year
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

        return {
            date: targetDate,
            daysRemaining
        };
    };

    // Merge default and custom events and sort by remaining days
    const allCampaignEvents = useMemo(() => {
        const year = new Date().getFullYear();
        const base = getSeasonalEvents(year);
        
        const baseCalculated = base.map(e => {
            const details = calculateEventDetails(e);
            return { ...e, ...details };
        });

        const customCalculated = customEvents.map(e => {
            const details = calculateEventDetails(e);
            return { ...e, ...details };
        });

        return [...baseCalculated, ...customCalculated].sort((a, b) => a.daysRemaining - b.daysRemaining);
    }, [customEvents]);

    // Handle AI generation
    const handleGenerateAICampaign = async (event) => {
        setSelectedEvent(event);
        setAiProposal('');
        setAiModalVisible(true);
        setAiLoading(true);

        try {
            // Get high stock products and higher margin products to make recommendations
            const activeProducts = products.filter(p => p.active);
            const highStockProducts = [...activeProducts]
                .sort((a, b) => (b.current_stock || 0) - (a.current_stock || 0))
                .slice(0, 10);

            const productListText = highStockProducts.length > 0 
                ? highStockProducts.map(p => `- ${p.name} (Stock: ${p.current_stock}, Precio sugerido Jujuy: $${p.sale_price || 'S/D'})`).join('\n')
                : 'Catálogo sin productos con stock registrado.';

            const prompt = `Actúa como un Director de Marketing y Copywriter Experto en eCommerce.
Te preparas para lanzar una campaña de ofertas y promociones para el evento: "${event.name}".
La fecha objetivo del evento es el ${event.date.toLocaleDateString('es-AR')}, y faltan exactamente ${event.daysRemaining} días para la campaña.

Considerando que vendemos tecnología y accesorios (bajo la marca "Digital Boost Empire") y este es nuestro stock principal:
${productListText}

Por favor, genera una propuesta comercial estratégica que contenga:
1. ESTRATEGIA (con 30 y 15 días de anticipación, qué debemos preparar).
2. TRES PROPUESTAS DE DESCUENTOS/COMBOS: Diseña combos activos usando los productos en stock, justificando el gancho de venta (ej: "Combo Papá Gamer", "2x1 Amigos Auris").
3. COPY DE VENTA LISTO PARA WHATSAPP: Redacta un mensaje irresistible para enviar por WhatsApp, usando emojis, mayúsculas estratégicas, frases cortas, urgencia y un llamado a la acción claro al catálogo.

Formato:
# Propuesta de Campaña para ${event.name}

## 📅 Cronograma de Acciones
- **A 30 días**: [Acción]
- **A 15 días**: [Acción]
- **Hoy**: [Acción]

## 🎁 Combos y Promociones Recomendadas
1. **[Nombre Combo 1]**: [Detalles y por qué funciona]
2. **[Nombre Combo 2]**: [Detalles]
3. **[Nombre Combo 3]**: [Detalles]

## ✍️ Copy para WhatsApp (Listo para copiar)
"[Mensaje de WhatsApp]"`;

            const proposal = await GeminiService.handleGeneralRequest(prompt);
            setAiProposal(proposal);
        } catch (e) {
            console.error('Error generating campaign', e);
            setAiProposal(`Error de conexión con la IA: ${e.message || 'Inténtalo de nuevo.'}`);
        } finally {
            setAiLoading(false);
        }
    };

    const handleCopyProposal = () => {
        if (!aiProposal) return;
        Clipboard.setString(aiProposal);
        Alert.alert('✅ Copiado', 'La propuesta de campaña completa se ha copiado al portapapeles.');
    };

    const handleShareProposal = async () => {
        if (!aiProposal) return;
        try {
            await Share.share({
                title: `Campaña ${selectedEvent?.name}`,
                message: aiProposal
            });
        } catch (e) {
            console.error(e);
        }
    };

    // Card Alert color helpers
    const getAlertStyle = (days) => {
        if (days <= 15) {
            return {
                border: '#ff4757',
                bg: 'rgba(255, 71, 87, 0.1)',
                text: '#ff4757',
                badgeText: '⚠️ URGENTE (Lanzar Ya)',
                glow: 'rgba(255, 71, 87, 0.4)'
            };
        } else if (days <= 30) {
            return {
                border: '#ffa502',
                bg: 'rgba(255, 165, 2, 0.1)',
                text: '#ffa502',
                badgeText: '⚙️ PLANIFICAR (Stock & Arte)',
                glow: 'rgba(255, 165, 2, 0.4)'
            };
        } else {
            return {
                border: '#2ed573',
                bg: 'rgba(46, 213, 115, 0.1)',
                text: '#2ed573',
                badgeText: '✅ A TIEMPO',
                glow: 'rgba(46, 213, 115, 0.4)'
            };
        }
    };

    const renderEventCard = ({ item }) => {
        const alert = getAlertStyle(item.daysRemaining);

        return (
            <View style={[styles.card, { borderColor: alert.border }]}>
                <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.eventName}>{item.name}</Text>
                        <Text style={styles.eventDate}>
                            Fecha: {item.date.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: alert.bg, borderColor: alert.border }]}>
                        <Text style={[styles.badgeText, { color: alert.text }]}>{alert.badgeText}</Text>
                    </View>
                </View>

                <Text style={styles.eventDesc}>{item.description}</Text>

                <View style={styles.cardFooter}>
                    <View style={styles.countdownBox}>
                        <Text style={[styles.countdownNumber, { color: alert.text }]}>{item.daysRemaining}</Text>
                        <Text style={styles.countdownLabel}>días restantes</Text>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        {item.isCustom && (
                            <TouchableOpacity 
                                style={styles.deleteBtn} 
                                onPress={() => handleDeleteCustomEvent(item.id)}
                            >
                                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ff4757" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.aiButton}
                            onPress={() => handleGenerateAICampaign(item)}
                        >
                            <LinearGradient colors={['#d4af37', '#b8942e']} style={styles.aiButtonGrad}>
                                <MaterialCommunityIcons name="creation" size={16} color="#000" />
                                <Text style={styles.aiButtonText}>PLAN DE IA</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <StatusBar barStyle="light-content" />
            <LinearGradient colors={['#000', '#121212']} style={styles.gradientBg} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <MaterialCommunityIcons name="arrow-left" size={24} color="#d4af37" />
                </TouchableOpacity>
                <View style={{ flex: 1, marginLeft: 15 }}>
                    <Text style={styles.headerLabel}>LOGÍSTICA DEL IMPERIO</Text>
                    <Text style={styles.title}>CALENDARIO DE CAMPAÑAS</Text>
                </View>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowAddModal(true)}>
                    <MaterialCommunityIcons name="calendar-plus" size={24} color="#d4af37" />
                </TouchableOpacity>
            </View>

            {/* List */}
            <FlatList
                data={allCampaignEvents}
                keyExtractor={(item) => item.id}
                renderItem={renderEventCard}
                contentContainerStyle={styles.listContent}
                ListHeaderComponent={
                    <View style={styles.infoBanner}>
                        <MaterialCommunityIcons name="information-outline" size={20} color="#d4af37" />
                        <Text style={styles.infoBannerText}>
                            Planifica tus campañas de marketing con anticipación. Usa el "PLAN DE IA" para analizar stock disponible y sugerir copys para WhatsApp.
                        </Text>
                    </View>
                }
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No hay eventos de campaña programados.</Text>
                    </View>
                }
            />

            {/* Modal - Add Custom Event */}
            <Modal
                visible={showAddModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowAddModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Nuevo Evento Especial</Text>
                            <TouchableOpacity onPress={() => setShowAddModal(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <Text style={styles.inputLabel}>Nombre del Evento</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: Día del Estudiante, Aniversario..."
                            placeholderTextColor="#444"
                            value={newEventName}
                            onChangeText={setNewEventName}
                        />

                        <Text style={styles.inputLabel}>Fecha (AAAA-MM-DD)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="Ej: 2026-09-21"
                            placeholderTextColor="#444"
                            value={newEventDate}
                            onChangeText={setNewEventDate}
                        />

                        <Text style={styles.inputLabel}>Descripción breve</Text>
                        <TextInput
                            style={[styles.input, { height: 80 }]}
                            placeholder="Ej: Descuentos en fundas y auriculares..."
                            placeholderTextColor="#444"
                            multiline={true}
                            value={newEventDesc}
                            onChangeText={setNewEventDesc}
                        />

                        <TouchableOpacity style={styles.saveBtn} onPress={handleSaveCustomEvent}>
                            <LinearGradient colors={['#d4af37', '#b8942e']} style={styles.saveBtnGrad}>
                                <Text style={styles.saveBtnText}>GUARDAR EVENTO</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Modal - AI Proposal Details */}
            <Modal
                visible={aiModalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setAiModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { maxHeight: '85%' }]}>
                        <View style={styles.modalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <MaterialCommunityIcons name="brain" size={28} color="#d4af37" />
                                <View>
                                    <Text style={styles.modalTitle}>Asistente de Marketing IA</Text>
                                    <Text style={styles.modalSubtitle}>{selectedEvent?.name}</Text>
                                </View>
                            </View>
                            <TouchableOpacity onPress={() => setAiModalVisible(false)}>
                                <MaterialCommunityIcons name="close" size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={styles.proposalScroll} showsVerticalScrollIndicator={false}>
                            {aiLoading ? (
                                <View style={styles.loadingBox}>
                                    <ActivityIndicator size="large" color="#d4af37" />
                                    <Text style={styles.loadingText}>
                                        Analizando catálogo, stock de tecnología y generando propuesta de ventas...
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.proposalText}>{aiProposal}</Text>
                            )}
                        </ScrollView>

                        {!aiLoading && (
                            <View style={styles.proposalFooter}>
                                <TouchableOpacity style={styles.actionBtn} onPress={handleCopyProposal}>
                                    <MaterialCommunityIcons name="content-copy" size={20} color="#fff" />
                                    <Text style={styles.actionBtnText}>COPIAR</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#25D366' }]} onPress={handleShareProposal}>
                                    <MaterialCommunityIcons name="whatsapp" size={20} color="#000" />
                                    <Text style={[styles.actionBtnText, { color: '#000' }]}>ENVIAR</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000000' },
    gradientBg: { ...StyleSheet.absoluteFillObject },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderColor: '#111'
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#222',
        justifyContent: 'center',
        alignItems: 'center'
    },
    addBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: '#0a0a0a',
        borderWidth: 1,
        borderColor: '#222',
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerLabel: { color: '#666', fontSize: 10, fontWeight: '900', letterSpacing: 2 },
    title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: 1 },
    listContent: { padding: 20, paddingBottom: 50 },
    
    infoBanner: {
        flexDirection: 'row',
        backgroundColor: '#121212',
        borderWidth: 1,
        borderColor: '#d4af3720',
        borderRadius: 15,
        padding: 15,
        marginBottom: 20,
        gap: 12,
        alignItems: 'center'
    },
    infoBannerText: { color: '#aaa', fontSize: 12, lineHeight: 18, flex: 1 },
    
    card: {
        backgroundColor: '#080808',
        borderRadius: 20,
        borderWidth: 1.5,
        padding: 18,
        marginBottom: 15
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    eventName: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
    eventDate: { color: '#666', fontSize: 11, marginTop: 2 },
    
    badge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1
    },
    badgeText: { fontSize: 9, fontWeight: '900' },
    
    eventDesc: { color: '#999', fontSize: 13, lineHeight: 18, marginBottom: 15 },
    cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    
    countdownBox: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    countdownNumber: { fontSize: 26, fontWeight: '900' },
    countdownLabel: { color: '#555', fontSize: 12, fontWeight: '700' },
    
    deleteBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 71, 87, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(255, 71, 87, 0.2)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    aiButton: { borderRadius: 12, overflow: 'hidden' },
    aiButtonGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 6
    },
    aiButtonText: { color: '#000', fontSize: 11, fontWeight: '900' },
    
    empty: { alignItems: 'center', marginTop: 100 },
    emptyText: { color: '#444', fontSize: 14, fontWeight: 'bold' },
    
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
    modalContent: {
        backgroundColor: '#0c0c0c',
        borderRadius: 25,
        borderWidth: 1.5,
        borderColor: '#222',
        padding: 20
    },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
    modalSubtitle: { color: '#d4af37', fontSize: 12, fontWeight: '700', marginTop: 2 },
    
    inputLabel: { color: '#aaa', fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 12 },
    input: {
        backgroundColor: '#050505',
        borderWidth: 1,
        borderColor: '#222',
        borderRadius: 12,
        padding: 12,
        color: '#fff',
        fontSize: 14
    },
    
    saveBtn: { borderRadius: 12, overflow: 'hidden', marginTop: 25 },
    saveBtnGrad: { padding: 15, justifyContent: 'center', alignItems: 'center' },
    saveBtnText: { color: '#000', fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
    
    proposalScroll: { marginVertical: 10, maxHeight: 400 },
    proposalText: { color: '#ccc', fontSize: 13, lineHeight: 22, fontWeight: '500' },
    
    loadingBox: { height: 250, justifyContent: 'center', alignItems: 'center', padding: 20 },
    loadingText: { color: '#d4af37', fontSize: 13, textAlign: 'center', marginTop: 15, lineHeight: 20, fontWeight: '600' },
    
    proposalFooter: { flexDirection: 'row', gap: 10, marginTop: 15 },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#222',
        padding: 14,
        borderRadius: 12,
        gap: 8
    },
    actionBtnText: { color: '#fff', fontWeight: '900', fontSize: 13 }
});
