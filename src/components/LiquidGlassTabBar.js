import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GOLD = '#d4af37';
const GOLD_LIGHT = '#f5e6a3';
const TAB_BAR_HEIGHT = 65;
const INDICATOR_HORIZONTAL_PADDING = 6;
const INDICATOR_VERTICAL_PADDING = 6;

const ICON_MAP = {
    Home: 'home-variant',
    Inventario: 'package-variant-closed',
    Presupuestos: 'file-document-edit',
    Balance: 'scale-balance',
    Deudas: 'cash-check',
};

export default function LiquidGlassTabBar({ state, descriptors, navigation }) {
    const insets = useSafeAreaInsets();
    const isAndroid = Platform.OS === 'android';
    const numTabs = state.routes.length;

    const translateX = useRef(new Animated.Value(0)).current;
    const scaleX = useRef(new Animated.Value(1)).current;
    const glowOpacity = useRef(new Animated.Value(1)).current;

    const [tabWidths, setTabWidths] = useState([]);
    const [tabPositions, setTabPositions] = useState([]);
    const [barWidth, setBarWidth] = useState(0);
    const layoutsReady = tabWidths.length === numTabs && barWidth > 0;

    useEffect(() => {
        if (!layoutsReady) return;

        const activeIndex = state.index;
        const tabWidth = barWidth / numTabs;
        const targetX = activeIndex * tabWidth + INDICATOR_HORIZONTAL_PADDING;

        Animated.parallel([
            Animated.sequence([
                Animated.timing(scaleX, {
                    toValue: 0.85,
                    duration: 100,
                    useNativeDriver: true,
                }),
                Animated.spring(scaleX, {
                    toValue: 1,
                    friction: 4,
                    tension: 200,
                    useNativeDriver: true,
                }),
            ]),
            Animated.spring(translateX, {
                toValue: targetX,
                friction: 6,
                tension: 80,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.timing(glowOpacity, {
                    toValue: 0.4,
                    duration: 80,
                    useNativeDriver: true,
                }),
                Animated.spring(glowOpacity, {
                    toValue: 1,
                    friction: 4,
                    tension: 120,
                    useNativeDriver: true,
                }),
            ]),
        ]).start();
    }, [state.index, layoutsReady, barWidth]);

    useEffect(() => {
        if (!layoutsReady) return;
        const tabWidth = barWidth / numTabs;
        const targetX = state.index * tabWidth + INDICATOR_HORIZONTAL_PADDING;
        translateX.setValue(targetX);
    }, [layoutsReady]);

    const indicatorWidth = layoutsReady
        ? barWidth / numTabs - INDICATOR_HORIZONTAL_PADDING * 2
        : 0;

    return (
        <View
            style={[
                styles.container,
                { bottom: Math.max(insets.bottom, 12) },
            ]}
        >
            {/* ── CAPA 1: Base muy translúcida para que el blur respire ── */}
            <View style={styles.glassBase} />

            {/* ── CAPA 2: BlurView nativo en ambas plataformas (expo-blur) ── */}
            <BlurView
                intensity={90}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />

            {/* ── CAPA 3: Gradiente de reflexión interna (efecto frosted glass) ── */}
            <LinearGradient
                colors={[
                    'rgba(255, 255, 255, 0.14)',
                    'rgba(255, 255, 255, 0.04)',
                    'rgba(0, 0, 0, 0.08)',
                    'rgba(0, 0, 0, 0.28)',
                ]}
                locations={[0, 0.20, 0.60, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* ── CAPA 4: Tinte dorado muy sutil en los bordes ── */}
            <LinearGradient
                colors={[
                    'rgba(212, 175, 55, 0.06)',
                    'transparent',
                    'rgba(212, 175, 55, 0.04)',
                ]}
                locations={[0, 0.5, 1]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />

            {/* ── CAPA 5: Línea de reflejo superior (efecto cristal) ── */}
            <View style={styles.topHighlight} />

            {/* ── CAPA 6: Contenido (indicador + tabs) ── */}
            <View
                style={styles.innerContainer}
                onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
            >
                {/* Sliding indicator */}
                {layoutsReady && (
                    <Animated.View
                        style={[
                            styles.indicator,
                            {
                                width: indicatorWidth,
                                height: TAB_BAR_HEIGHT - INDICATOR_VERTICAL_PADDING * 2,
                                transform: [{ translateX }, { scaleX }],
                            },
                        ]}
                    >
                        {/* Fondo del indicador: gradiente dorado suave */}
                        <LinearGradient
                            colors={[
                                'rgba(212, 175, 55, 0.22)',
                                'rgba(212, 175, 55, 0.10)',
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.indicatorGradient}
                        />
                        {/* Reflexión blanca en el top del pill */}
                        <Animated.View
                            style={[styles.indicatorHighlight, { opacity: glowOpacity }]}
                        />
                        {/* Borde dorado del pill */}
                        <View style={styles.indicatorBorder} />
                        {/* Glow difuso abajo del pill */}
                        <Animated.View
                            style={[styles.indicatorGlow, { opacity: glowOpacity }]}
                        />
                    </Animated.View>
                )}

                {/* Tab buttons */}
                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const label = options.title ?? route.name;
                    const isFocused = state.index === index;

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!isFocused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };

                    const onLongPress = () => {
                        navigation.emit({ type: 'tabLongPress', target: route.key });
                    };

                    const iconName = ICON_MAP[route.name] || 'help-circle';

                    return (
                        <TouchableOpacity
                            key={route.key}
                            accessibilityRole="button"
                            accessibilityState={isFocused ? { selected: true } : {}}
                            accessibilityLabel={options.tabBarAccessibilityLabel}
                            testID={options.tabBarTestID}
                            onPress={onPress}
                            onLongPress={onLongPress}
                            style={styles.tab}
                            activeOpacity={0.7}
                            onLayout={(e) => {
                                const { width, x } = e.nativeEvent.layout;
                                setTabWidths((prev) => {
                                    const next = [...prev];
                                    next[index] = width;
                                    return next;
                                });
                                setTabPositions((prev) => {
                                    const next = [...prev];
                                    next[index] = x;
                                    return next;
                                });
                            }}
                        >
                            <MaterialCommunityIcons
                                name={iconName}
                                size={22}
                                color={isFocused ? GOLD : 'rgba(180, 180, 200, 0.6)'}
                            />
                            <Animated.Text
                                style={[
                                    styles.label,
                                    {
                                        color: isFocused ? GOLD : 'rgba(180, 180, 200, 0.55)',
                                        fontWeight: isFocused ? '700' : '500',
                                        fontSize: numTabs > 4 ? 9 : 10,
                                    },
                                ]}
                                numberOfLines={1}
                                adjustsFontSizeToFit={true}
                                minimumScaleFactor={0.8}
                            >
                                {label}
                            </Animated.Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        left: 15,
        right: 15,
        height: TAB_BAR_HEIGHT,
        borderRadius: 24,
        // Sin backgroundColor aquí: lo maneja glassBase + capas encima
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        elevation: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 20,
        overflow: 'hidden',
    },

    // Capa 1: base MUY transparente — el BlurView hace el trabajo pesado
    glassBase: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: Platform.select({
            ios: 'rgba(5, 5, 12, 0.15)',    // iOS: casi invisible, blur lo oscurece
            android: 'rgba(5, 5, 14, 0.28)', // Android: un poco más para compensar blur limitado
        }),
        borderRadius: 24,
    },

    // Línea de destello en el borde superior (simula el reflejo del vidrio)
    topHighlight: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.22)',
        borderRadius: 1,
    },

    innerContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },

    tab: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        zIndex: 2,
    },

    label: {
        fontSize: 10,
        marginTop: 2,
    },

    // Sliding indicator
    indicator: {
        position: 'absolute',
        top: INDICATOR_VERTICAL_PADDING,
        left: 0,
        borderRadius: 18,
        zIndex: 1,
        overflow: 'hidden',
    },

    indicatorGradient: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 18,
    },

    // Borde translúcido dorado del pill
    indicatorBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.30)',
    },

    // Reflexión blanca en la parte superior del pill
    indicatorHighlight: {
        position: 'absolute',
        top: 0,
        left: '15%',
        right: '15%',
        height: 1.5,
        borderRadius: 1,
        backgroundColor: 'rgba(245, 230, 163, 0.55)',
    },

    // Glow difuso debajo del pill
    indicatorGlow: {
        position: 'absolute',
        bottom: -5,
        left: '20%',
        right: '20%',
        height: 10,
        borderRadius: 5,
        backgroundColor: GOLD,
        opacity: 0.20,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.9,
        shadowRadius: 10,
        elevation: 4,
    },
});
