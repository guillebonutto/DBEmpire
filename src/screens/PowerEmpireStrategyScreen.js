import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    StatusBar,
    Platform,
    Alert,
    Dimensions,
    TextInput
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useReminderStore } from '../store/useReminderStore';

const COLORS = {
    background: '#121316',
    surface: '#18191d',
    surfaceContainer: '#202126',
    surfaceHigh: '#292b32',
    primary: '#d4af37',
    primaryGlow: 'rgba(212, 175, 55, 0.25)',
    onSurface: '#e6e6ea',
    onSurfaceVariant: '#a8a8b2',
    border: '#2c2d35',
    accentGreen: '#00e475',
    accentBlue: '#00b4d8',
    accentPurple: '#b5179e',
    accentOrange: '#f77f00',
    cardPillar1: 'rgba(247, 127, 0, 0.12)',
    cardPillar2: 'rgba(0, 180, 216, 0.12)',
    cardPillar3: 'rgba(181, 23, 158, 0.12)',
    cardPillar4: 'rgba(0, 228, 117, 0.12)',
};

const STRATEGY_STORAGE_KEY = '@powerempire_strategy_metrics';

const PILARES = [
    {
        id: 1,
        title: 'Vida cotidiana y conexión',
        subtitle: 'Identificación y atención',
        color: '#f77f00',
        icon: 'coffee-outline',
        description: 'Situaciones reales con las que la audiencia empatiza: quedarse sin batería, salir apurado, tomar mate en el trabajo, mojar zapatillas.',
        formula: 'Problema humano reconocible -> Cero venta dura -> Generar afinidad y retención.',
        formatos: 'Reels / TikToks espontáneos, stories cotidianas.'
    },
    {
        id: 2,
        title: 'Demostración y utilidad',
        subtitle: 'Comprensión e interés',
        color: '#00b4d8',
        icon: 'hammer-wrench',
        description: 'Enseñar el producto en acción. Qué resuelve, cómo se usa y en qué contexto real salva el momento.',
        formula: 'Solución práctica en 5-15 seg -> Demostración sin rodeos -> Despertar deseo.',
        formatos: 'Reels de producto, unboxings funcionales, reviews cortas.'
    },
    {
        id: 3,
        title: 'Confianza y marca',
        subtitle: 'Credibilidad y cercanía',
        color: '#b5179e',
        icon: 'shield-check-outline',
        description: 'Detrás de escena: empaquetando pedidos de clientes, testeos de resistencia, honestidad y respuesta a dudas comunes.',
        formula: 'Trasparencia total -> Humanizar el negocio -> Reducir la fricción de compra.',
        formatos: 'Stories interactivas (encuestas/preguntas), BTS de taller/envíos.'
    },
    {
        id: 4,
        title: 'Venta directa',
        subtitle: 'Generar consultas y ventas',
        color: '#00e475',
        icon: 'currency-usd',
        description: 'Presentación comercial directa: beneficios, precio o promo cuando aplique, llamada a la acción clara para pedir por WhatsApp/web.',
        formula: 'Beneficio claro -> Solución disponible -> Llamado a la acción (CTA) directo.',
        formatos: 'Reel comercial de alto impacto, historias destacadas con enlace.'
    }
];

const SEMANA_MODELO = [
    {
        dia: 'Lunes',
        tipo: 'Reel',
        pilarId: 1,
        titulo: 'Reel cotidiano: Problema reconocible',
        objetivo: 'Alcance y atención',
        ejemplo: 'Quedarse sin batería saliendo apurado de casa o el auto.',
        cta: '¿A cuántos les pasó esto hoy? Dejá tu comentario abajo 👇',
        hora: '13:00'
    },
    {
        dia: 'Martes',
        tipo: 'Historias',
        pilarId: 3,
        titulo: 'Historias interactivas: Encuesta / Pregunta',
        objetivo: 'Interacción y feedback',
        ejemplo: 'Sticker de encuesta: "¿Sos team cable largo o cargador magnético rápido?"',
        cta: 'Votá en la encuesta / respondé al sticker.',
        hora: '17:30'
    },
    {
        dia: 'Miércoles',
        tipo: 'Reel',
        pilarId: 2,
        titulo: 'Reel demostración: Utilidad extrema',
        objetivo: 'Interés y comprensión',
        ejemplo: 'Poniendo a prueba la velocidad y comodidad del producto.',
        cta: 'Guardá este tip para cuando necesites renovar tus accesorios.',
        hora: '19:00'
    },
    {
        dia: 'Jueves',
        tipo: 'Stories / Reel',
        pilarId: 3,
        titulo: 'Detrás de escena: Despacho y confianza',
        objetivo: 'Confianza y cercanía',
        ejemplo: 'Armando los pedidos de la semana + respondiendo duda real de un cliente.',
        cta: 'Enviá tu consulta al MD y te respondemos.',
        hora: '18:00'
    },
    {
        dia: 'Viernes',
        tipo: 'Reel',
        pilarId: 4,
        titulo: 'Reel comercial: Solución lista para vos',
        objetivo: 'Consultas y ventas',
        ejemplo: 'Kit PowerEmpire completo en stock para entrega inmediata.',
        cta: 'Tocá el link en bio o comentá "POWER" para enviarte la info.',
        hora: '20:00'
    },
    {
        dia: 'Sábado',
        tipo: 'Historias',
        pilarId: 3,
        titulo: 'Historias: Pedidos en viaje y clientes reales',
        objetivo: 'Cercanía y prueba social',
        ejemplo: 'Fotos y capturas de clientes satisfechos o paquetes listos para enviar.',
        cta: 'Consultá disponibilidad por WhatsApp.',
        hora: '12:00'
    },
    {
        dia: 'Domingo',
        tipo: 'Auditoría',
        pilarId: 0,
        titulo: 'Revisión de métricas y ajuste semanal',
        objetivo: 'Aprendizaje y optimización',
        ejemplo: 'Comprobar alcance, guardados, comentarios y ventas atribuibles.',
        cta: 'Anotar qué formato tuvo mejor retención y repetirlo.',
        hora: '21:00'
    }
];

export default function PowerEmpireStrategyScreen({ navigation }) {
    const insets = useSafeAreaInsets();
    const androidStatusBarHeight = Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0;
    const topInset = Math.max(insets.top, androidStatusBarHeight);

    const [activeSection, setActiveSection] = useState('calendario'); // 'calendario' | 'pilares' | 'metricas' | 'principios'
    const [injecting, setInjecting] = useState(false);
    const { addReminder, fetchReminders } = useReminderStore();

    // Estado editable de métricas registradas para auditar Reels
    const [metrics, setMetrics] = useState({
        alcance: '',
        retencion: '',
        guardados: '',
        consultas: '',
        ventas: '',
        notas: ''
    });

    useEffect(() => {
        loadMetrics();
    }, []);

    const loadMetrics = async () => {
        try {
            const saved = await AsyncStorage.getItem(STRATEGY_STORAGE_KEY);
            if (saved) setMetrics(JSON.parse(saved));
        } catch (e) {
            console.error('Error cargando métricas:', e);
        }
    };

    const handleSaveMetrics = async () => {
        try {
            await AsyncStorage.setItem(STRATEGY_STORAGE_KEY, JSON.stringify(metrics));
            Alert.alert('✅ Métricas guardadas', 'Los registros de rendimiento de PowerEmpire se actualizaron.');
        } catch (e) {
            Alert.alert('Error', 'No se pudieron guardar las métricas.');
        }
    };

    const handleInjectCalendarToAgenda = async () => {
        Alert.alert(
            'Inyectar a la Agenda Imperial',
            '¿Deseas programar los 7 contenidos de la semana de PowerEmpire en tu calendario de la app a partir de hoy?',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Inyectar Semana',
                    onPress: async () => {
                        setInjecting(true);
                        try {
                            const now = new Date();
                            for (let i = 0; i < SEMANA_MODELO.length; i++) {
                                const item = SEMANA_MODELO[i];
                                const targetDate = new Date(now);
                                targetDate.setDate(targetDate.getDate() + i);
                                const [h, m] = item.hora.split(':').map(Number);
                                targetDate.setHours(h || 18, m || 0, 0, 0);

                                const categoryMap = {
                                    1: 'entretenimiento',
                                    2: 'educativo',
                                    3: 'bts',
                                    4: 'promocional',
                                    0: 'informativo'
                                };

                                const notePayload = {
                                    category: categoryMap[item.pilarId] || 'educativo',
                                    stage: item.dia === 'Domingo' ? 'Recordatorio general' : 'Idea aprobada',
                                    text: `[PowerEmpire Estrategia] ${item.objetivo}\nIdea: ${item.ejemplo}\nCTA: ${item.cta}`
                                };

                                await addReminder(
                                    `[PowerEmpire] ${item.titulo}`,
                                    notePayload,
                                    targetDate.toISOString()
                                );
                            }
                            await fetchReminders();
                            Alert.alert('🔥 ¡Semana Inyectada!', 'Los 7 contenidos de PowerEmpire ya están programados en tu Agenda Imperial.');
                        } catch (err) {
                            console.error('Error inyectando semana:', err);
                            Alert.alert('Error', 'No se pudo completar la inyección a la agenda.');
                        } finally {
                            setInjecting(false);
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />

            {/* HEADER */}
            <View style={[styles.header, { paddingTop: topInset > 0 ? topInset + 8 : 28 }]}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => navigation.goBack()}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                    <MaterialCommunityIcons name="arrow-left" size={24} color={COLORS.primary} />
                </TouchableOpacity>
                <View style={styles.headerTitleWrap}>
                    <Text style={styles.headerTitle}>POWEREMPIRE STRATEGY</Text>
                    <Text style={styles.headerSubtitle}>Estrategia y Calendario de Crecimiento</Text>
                </View>
                <TouchableOpacity
                    style={styles.agendaDirectBtn}
                    onPress={() => navigation.navigate('Agenda')}
                    activeOpacity={0.8}
                >
                    <MaterialCommunityIcons name="calendar-month" size={20} color="#000" />
                </TouchableOpacity>
            </View>

            {/* NAV SUB-TABS */}
            <View style={styles.navBar}>
                <TouchableOpacity
                    style={[styles.navTab, activeSection === 'calendario' && styles.navTabActive]}
                    onPress={() => setActiveSection('calendario')}
                >
                    <MaterialCommunityIcons
                        name="calendar-week"
                        size={18}
                        color={activeSection === 'calendario' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navTabText, activeSection === 'calendario' && styles.navTabTextActive]}>
                        Semana
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navTab, activeSection === 'pilares' && styles.navTabActive]}
                    onPress={() => setActiveSection('pilares')}
                >
                    <MaterialCommunityIcons
                        name="view-column-outline"
                        size={18}
                        color={activeSection === 'pilares' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navTabText, activeSection === 'pilares' && styles.navTabTextActive]}>
                        4 Pilares
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navTab, activeSection === 'metricas' && styles.navTabActive]}
                    onPress={() => setActiveSection('metricas')}
                >
                    <MaterialCommunityIcons
                        name="chart-timeline-variant"
                        size={18}
                        color={activeSection === 'metricas' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navTabText, activeSection === 'metricas' && styles.navTabTextActive]}>
                        Métricas
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.navTab, activeSection === 'principios' && styles.navTabActive]}
                    onPress={() => setActiveSection('principios')}
                >
                    <MaterialCommunityIcons
                        name="lightbulb-outline"
                        size={18}
                        color={activeSection === 'principios' ? COLORS.primary : COLORS.onSurfaceVariant}
                    />
                    <Text style={[styles.navTabText, activeSection === 'principios' && styles.navTabTextActive]}>
                        Principios
                    </Text>
                </TouchableOpacity>
            </View>

            {/* CONTENIDO PRINCIPAL */}
            <ScrollView
                style={styles.scrollBody}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
                showsVerticalScrollIndicator={false}
            >
                {/* BANNER DE INYECCIÓN DIRECTA */}
                <View style={styles.heroCard}>
                    <LinearGradient
                        colors={['rgba(212,175,55,0.18)', 'rgba(212,175,55,0.03)']}
                        style={StyleSheet.absoluteFill}
                        borderRadius={16}
                    />
                    <View style={styles.heroBadgeRow}>
                        <View style={styles.heroPill}>
                            <MaterialCommunityIcons name="crown" size={14} color={COLORS.primary} />
                            <Text style={styles.heroPillText}>POWEREMPIRE PROTOCOL</Text>
                        </View>
                        <Text style={styles.heroDuration}>Frecuencia Sostenible</Text>
                    </View>
                    <Text style={styles.heroHeading}>
                        Conectar antes de vender: Del problema a la venta en 4 pasos
                    </Text>
                    <Text style={styles.heroSubheading}>
                        Estructura táctica de 51s para Reels y Stories: no improvisar productos al azar, sino guiar la relación del cliente.
                    </Text>

                    <TouchableOpacity
                        style={styles.injectButton}
                        onPress={handleInjectCalendarToAgenda}
                        disabled={injecting}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={['#d4af37', '#b5952f']}
                            style={styles.injectGradient}
                        >
                            <MaterialCommunityIcons name="calendar-plus" size={18} color="#000" />
                            <Text style={styles.injectButtonText}>
                                {injecting ? 'INYECTANDO SEMANA...' : 'PROGRAMAR SEMANA EN AGENDAR'}
                            </Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* SECCIÓN: CALENDARIO SEMANAL */}
                {activeSection === 'calendario' && (
                    <View style={styles.sectionWrap}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>CALENDARIO INICIAL DE CRECIMIENTO</Text>
                            <Text style={styles.sectionSubtitle}>1 Semana para testear y comparar formatos</Text>
                        </View>

                        {SEMANA_MODELO.map((item, idx) => {
                            const pilar = PILARES.find(p => p.id === item.pilarId);
                            const pilarColor = pilar ? pilar.color : COLORS.primary;

                            return (
                                <View key={idx} style={[styles.scheduleCard, { borderLeftColor: pilarColor }]}>
                                    <View style={styles.scheduleHeaderRow}>
                                        <View style={styles.dayBadge}>
                                            <Text style={styles.dayBadgeText}>{item.dia.toUpperCase()}</Text>
                                        </View>
                                        <View style={[styles.formatTag, { borderColor: pilarColor }]}>
                                            <Text style={[styles.formatTagText, { color: pilarColor }]}>{item.tipo}</Text>
                                        </View>
                                        <Text style={styles.scheduleHour}>{item.hora} HS</Text>
                                    </View>

                                    <Text style={styles.scheduleTitle}>{item.titulo}</Text>

                                    <View style={styles.scheduleDetailRow}>
                                        <MaterialCommunityIcons name="target" size={16} color={pilarColor} />
                                        <Text style={styles.scheduleDetailLabel}>Objetivo:</Text>
                                        <Text style={styles.scheduleDetailValue}>{item.objetivo}</Text>
                                    </View>

                                    <View style={styles.scheduleBox}>
                                        <Text style={styles.scheduleBoxTitle}>Ejemplo práctico:</Text>
                                        <Text style={styles.scheduleBoxText}>{item.ejemplo}</Text>
                                    </View>

                                    <View style={styles.scheduleCtaRow}>
                                        <MaterialCommunityIcons name="bullhorn-outline" size={15} color={COLORS.primary} />
                                        <Text style={styles.scheduleCtaText}>{item.cta}</Text>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* SECCIÓN: 4 PILARES */}
                {activeSection === 'pilares' && (
                    <View style={styles.sectionWrap}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>LOS 4 PILARES DE POWEREMPIRE</Text>
                            <Text style={styles.sectionSubtitle}>La relación que construís antes de pedir la compra</Text>
                        </View>

                        {PILARES.map((pilar) => (
                            <View key={pilar.id} style={[styles.pillarCard, { borderTopColor: pilar.color }]}>
                                <View style={styles.pillarHead}>
                                    <View style={[styles.pillarIconCircle, { backgroundColor: `${pilar.color}22` }]}>
                                        <MaterialCommunityIcons name={pilar.icon} size={24} color={pilar.color} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.pillarIndex}>PILAR {pilar.id}</Text>
                                        <Text style={styles.pillarTitle}>{pilar.title}</Text>
                                        <Text style={[styles.pillarSub, { color: pilar.color }]}>{pilar.subtitle}</Text>
                                    </View>
                                </View>

                                <Text style={styles.pillarDesc}>{pilar.description}</Text>

                                <View style={styles.pillarFormulaBox}>
                                    <Text style={styles.pillarFormulaLabel}>FÓRMULA:</Text>
                                    <Text style={styles.pillarFormulaText}>{pilar.formula}</Text>
                                </View>

                                <View style={styles.pillarFormatsRow}>
                                    <MaterialCommunityIcons name="movie-play-outline" size={16} color={COLORS.onSurfaceVariant} />
                                    <Text style={styles.pillarFormatsText}>{pilar.formatos}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                )}

                {/* SECCIÓN: MÉTRICAS */}
                {activeSection === 'metricas' && (
                    <View style={styles.sectionWrap}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>CÓMO SABER SI CRECES DE VERDAD</Text>
                            <Text style={styles.sectionSubtitle}>No midas solo seguidores; registrá evidencia real</Text>
                        </View>

                        <View style={styles.metricsNoticeBox}>
                            <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.primary} />
                            <Text style={styles.metricsNoticeText}>
                                Después de 2-3 semanas, buscá patrones: ¿Los videos cotidianos te dan más alcance? ¿Las demostraciones más consultas? ¿El comercial vende?
                            </Text>
                        </View>

                        <View style={styles.metricInputsCard}>
                            <Text style={styles.cardSectionHeader}>AUDITORÍA DEL REEL DE LA SEMANA</Text>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>ALCANCE / REPRODUCCIONES</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Ej: 14.500 vistas"
                                    placeholderTextColor="#666"
                                    value={metrics.alcance}
                                    onChangeText={(v) => setMetrics({ ...metrics, alcance: v })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>RETENCIÓN / TIEMPO MEDIO</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Ej: 68% retención (18s medio)"
                                    placeholderTextColor="#666"
                                    value={metrics.retencion}
                                    onChangeText={(v) => setMetrics({ ...metrics, retencion: v })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>GUARDADOS Y COMPARTIDOS</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Ej: 120 guardados, 45 compartidos"
                                    placeholderTextColor="#666"
                                    value={metrics.guardados}
                                    onChangeText={(v) => setMetrics({ ...metrics, guardados: v })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>CONSULTAS RECIBIDAS (MD / WHATSAPP)</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Ej: 18 chats preguntando por stock"
                                    placeholderTextColor="#666"
                                    value={metrics.consultas}
                                    onChangeText={(v) => setMetrics({ ...metrics, consultas: v })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>VENTAS ATRIBUIBLES</Text>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Ej: 6 ventas cerradas ($120.000)"
                                    placeholderTextColor="#666"
                                    value={metrics.ventas}
                                    onChangeText={(v) => setMetrics({ ...metrics, ventas: v })}
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.inputLabel}>PATRÓN O APRENDIZAJE IDENTIFICADO</Text>
                                <TextInput
                                    style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
                                    placeholder="Ej: La toma inicial con el mate enganchó más audiencia local..."
                                    placeholderTextColor="#666"
                                    multiline
                                    numberOfLines={3}
                                    value={metrics.notas}
                                    onChangeText={(v) => setMetrics({ ...metrics, notas: v })}
                                />
                            </View>

                            <TouchableOpacity
                                style={styles.saveMetricsBtn}
                                onPress={handleSaveMetrics}
                                activeOpacity={0.8}
                            >
                                <MaterialCommunityIcons name="content-save-outline" size={18} color="#000" />
                                <Text style={styles.saveMetricsBtnText}>GUARDAR AUDITORÍA</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* SECCIÓN: PRINCIPIOS Y CICLO */}
                {activeSection === 'principios' && (
                    <View style={styles.sectionWrap}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>EL CICLO DE TRABAJO POWEREMPIRE</Text>
                            <Text style={styles.sectionSubtitle}>No un calendario enorme de un mes; un ciclo ágil de 4 fases</Text>
                        </View>

                        <View style={styles.cycleGrid}>
                            <View style={styles.cycleStepCard}>
                                <View style={[styles.cycleStepNum, { backgroundColor: '#f77f00' }]}>
                                    <Text style={styles.cycleStepNumText}>1</Text>
                                </View>
                                <Text style={styles.cycleStepTitle}>PLANIFICAR</Text>
                                <Text style={styles.cycleStepDesc}>Elegir objetivo, producto concreto y problema cotidiano.</Text>
                            </View>

                            <View style={styles.cycleStepCard}>
                                <View style={[styles.cycleStepNum, { backgroundColor: '#00b4d8' }]}>
                                    <Text style={styles.cycleStepNumText}>2</Text>
                                </View>
                                <Text style={styles.cycleStepTitle}>CREAR Y PUBLICAR</Text>
                                <Text style={styles.cycleStepDesc}>Grabar 51s, editar con gancho inicial y distribuir en Reels + Stories.</Text>
                            </View>

                            <View style={styles.cycleStepCard}>
                                <View style={[styles.cycleStepNum, { backgroundColor: '#b5179e' }]}>
                                    <Text style={styles.cycleStepNumText}>3</Text>
                                </View>
                                <Text style={styles.cycleStepTitle}>MEDIR</Text>
                                <Text style={styles.cycleStepDesc}>Revisar alcance, retención de segundos y consultas de venta.</Text>
                            </View>

                            <View style={styles.cycleStepCard}>
                                <View style={[styles.cycleStepNum, { backgroundColor: '#00e475' }]}>
                                    <Text style={styles.cycleStepNumText}>4</Text>
                                </View>
                                <Text style={styles.cycleStepTitle}>APRENDER Y AJUSTAR</Text>
                                <Text style={styles.cycleStepDesc}>Repetir lo que convirtió y modificar lo que no retuvo.</Text>
                            </View>
                        </View>

                        {/* Stories vs Reels */}
                        <View style={styles.compareCard}>
                            <Text style={styles.compareTitle}>DISTINCIÓN CLAVE: STORIES VS REELS</Text>
                            <View style={styles.compareRow}>
                                <View style={styles.compareCol}>
                                    <Text style={[styles.compareColHeader, { color: '#f77f00' }]}>HISTORIAS (STORIES)</Text>
                                    <Text style={styles.compareColBody}>
                                        Nutren la relación con los que ya te siguen. Ideales para encuestas, preguntas, detrás de escena y confianza rápida.
                                    </Text>
                                </View>
                                <View style={styles.compareDivider} />
                                <View style={styles.compareCol}>
                                    <Text style={[styles.compareColHeader, { color: '#00e475' }]}>REELS / TIKTOKS</Text>
                                    <Text style={styles.compareColBody}>
                                        Atraen nuevas personas. Deben capturar la atención en los primeros 3 segundos con un problema cotidiano o utilidad real.
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 12,
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: COLORS.surfaceContainer,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitleWrap: {
        flex: 1,
        marginLeft: 12,
    },
    headerTitle: {
        color: COLORS.primary,
        fontSize: 16,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    headerSubtitle: {
        color: COLORS.onSurfaceVariant,
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2,
    },
    agendaDirectBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: COLORS.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navBar: {
        flexDirection: 'row',
        backgroundColor: COLORS.surface,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.border,
        paddingHorizontal: 10,
    },
    navTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        gap: 6,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    navTabActive: {
        borderBottomColor: COLORS.primary,
    },
    navTabText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11.5,
        fontWeight: '600',
    },
    navTabTextActive: {
        color: COLORS.primary,
        fontWeight: '700',
    },
    scrollBody: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        gap: 16,
    },
    heroCard: {
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        backgroundColor: COLORS.surfaceContainer,
        position: 'relative',
        overflow: 'hidden',
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    heroPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: COLORS.primaryGlow,
    },
    heroPillText: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
    },
    heroDuration: {
        color: COLORS.onSurfaceVariant,
        fontSize: 10.5,
        fontWeight: '600',
    },
    heroHeading: {
        color: COLORS.onSurface,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 6,
        lineHeight: 22,
    },
    heroSubheading: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
        lineHeight: 17,
        marginBottom: 14,
    },
    injectButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    injectGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 16,
    },
    injectButtonText: {
        color: '#000',
        fontSize: 12.5,
        fontWeight: '800',
        letterSpacing: 1,
    },
    sectionWrap: {
        gap: 12,
    },
    sectionHeaderRow: {
        marginBottom: 4,
    },
    sectionTitle: {
        color: COLORS.primary,
        fontSize: 13,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    sectionSubtitle: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        marginTop: 2,
    },
    scheduleCard: {
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 12,
        borderLeftWidth: 4,
        padding: 14,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 8,
    },
    scheduleHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dayBadge: {
        backgroundColor: COLORS.surfaceHigh,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
    },
    dayBadgeText: {
        color: COLORS.onSurface,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    formatTag: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
    },
    formatTagText: {
        fontSize: 10,
        fontWeight: '700',
    },
    scheduleHour: {
        marginLeft: 'auto',
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        fontWeight: '600',
    },
    scheduleTitle: {
        color: COLORS.onSurface,
        fontSize: 14,
        fontWeight: '700',
    },
    scheduleDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    scheduleDetailLabel: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        fontWeight: '600',
    },
    scheduleDetailValue: {
        color: COLORS.onSurface,
        fontSize: 11,
        fontWeight: '700',
    },
    scheduleBox: {
        backgroundColor: COLORS.surface,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    scheduleBoxTitle: {
        color: COLORS.primary,
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 2,
        textTransform: 'uppercase',
    },
    scheduleBoxText: {
        color: COLORS.onSurface,
        fontSize: 11.5,
        lineHeight: 16,
    },
    scheduleCtaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 2,
    },
    scheduleCtaText: {
        color: COLORS.primary,
        fontSize: 11,
        fontWeight: '600',
        flex: 1,
    },
    pillarCard: {
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 14,
        borderTopWidth: 4,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 10,
    },
    pillarHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    pillarIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pillarIndex: {
        color: COLORS.onSurfaceVariant,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 1.5,
    },
    pillarTitle: {
        color: COLORS.onSurface,
        fontSize: 15,
        fontWeight: '700',
    },
    pillarSub: {
        fontSize: 11,
        fontWeight: '600',
    },
    pillarDesc: {
        color: COLORS.onSurfaceVariant,
        fontSize: 12,
        lineHeight: 18,
    },
    pillarFormulaBox: {
        backgroundColor: COLORS.surface,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    pillarFormulaLabel: {
        color: COLORS.primary,
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 2,
    },
    pillarFormulaText: {
        color: COLORS.onSurface,
        fontSize: 11.5,
        lineHeight: 16,
    },
    pillarFormatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pillarFormatsText: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        fontWeight: '500',
    },
    metricsNoticeBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: COLORS.primaryGlow,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(212,175,55,0.3)',
    },
    metricsNoticeText: {
        color: COLORS.onSurface,
        fontSize: 11.5,
        lineHeight: 16,
        flex: 1,
    },
    metricInputsCard: {
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
    },
    cardSectionHeader: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1.2,
        marginBottom: 4,
    },
    inputGroup: {
        gap: 6,
    },
    inputLabel: {
        color: COLORS.onSurfaceVariant,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
    },
    textInput: {
        backgroundColor: COLORS.surface,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: COLORS.border,
        paddingHorizontal: 12,
        paddingVertical: 9,
        color: COLORS.onSurface,
        fontSize: 12,
    },
    saveMetricsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: COLORS.primary,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 6,
    },
    saveMetricsBtnText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    cycleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    cycleStepCard: {
        width: '48%',
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 6,
    },
    cycleStepNum: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    cycleStepNumText: {
        color: '#000',
        fontSize: 12,
        fontWeight: '800',
    },
    cycleStepTitle: {
        color: COLORS.onSurface,
        fontSize: 12,
        fontWeight: '700',
    },
    cycleStepDesc: {
        color: COLORS.onSurfaceVariant,
        fontSize: 10.5,
        lineHeight: 15,
    },
    compareCard: {
        backgroundColor: COLORS.surfaceContainer,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: COLORS.border,
        gap: 12,
        marginTop: 4,
    },
    compareTitle: {
        color: COLORS.primary,
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 1,
    },
    compareRow: {
        flexDirection: 'row',
        gap: 12,
    },
    compareCol: {
        flex: 1,
        gap: 6,
    },
    compareColHeader: {
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.8,
    },
    compareColBody: {
        color: COLORS.onSurfaceVariant,
        fontSize: 11,
        lineHeight: 16,
    },
    compareDivider: {
        width: 1,
        backgroundColor: COLORS.border,
    },
});
