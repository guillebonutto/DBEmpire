import React, { useRef, useEffect, useState } from 'react';
import {
    View,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Dimensions,
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

    // Animation values
    const translateX = useRef(new Animated.Value(0)).current;
    const scaleX = useRef(new Animated.Value(1)).current;
    const glowOpacity = useRef(new Animated.Value(1)).current;

    // Track tab widths
    const [tabWidths, setTabWidths] = useState([]);
    const [tabPositions, setTabPositions] = useState([]);
    const [barWidth, setBarWidth] = useState(0);
    const layoutsReady = tabWidths.length === numTabs && barWidth > 0;

    // Calculate indicator position when layout is ready or active tab changes
    useEffect(() => {
        if (!layoutsReady) return;

        const activeIndex = state.index;
        const tabWidth = barWidth / numTabs;
        const targetX = activeIndex * tabWidth + INDICATOR_HORIZONTAL_PADDING;

        // Animate with spring for juicy liquid feel
        Animated.parallel([
            // Squeeze indicator briefly during transition
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
            // Slide to new position
            Animated.spring(translateX, {
                toValue: targetX,
                friction: 6,
                tension: 80,
                useNativeDriver: true,
            }),
            // Pulse glow
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

    // Set initial position immediately (no animation)
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
                {
                    bottom: isAndroid ? 15 : 25,
                },
            ]}
        >
            {/* Glass background */}
            <BlurView
                intensity={40}
                tint="dark"
                style={StyleSheet.absoluteFill}
            />

            {/* Inner content wrapper */}
            <View
                style={styles.innerContainer}
                onLayout={(e) => {
                    setBarWidth(e.nativeEvent.layout.width);
                }}
            >
                {/* Sliding indicator (behind icons) */}
                {layoutsReady && (
                    <Animated.View
                        style={[
                            styles.indicator,
                            {
                                width: indicatorWidth,
                                height: TAB_BAR_HEIGHT - INDICATOR_VERTICAL_PADDING * 2,
                                transform: [
                                    { translateX },
                                    { scaleX },
                                ],
                            },
                        ]}
                    >
                        {/* Glass pill background */}
                        <LinearGradient
                            colors={[
                                'rgba(212, 175, 55, 0.18)',
                                'rgba(212, 175, 55, 0.08)',
                            ]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 0, y: 1 }}
                            style={styles.indicatorGradient}
                        />
                        {/* Top highlight line (glass reflex) */}
                        <Animated.View
                            style={[
                                styles.indicatorHighlight,
                                { opacity: glowOpacity },
                            ]}
                        />
                        {/* Bottom glow */}
                        <Animated.View
                            style={[
                                styles.indicatorGlow,
                                { opacity: glowOpacity },
                            ]}
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
                        navigation.emit({
                            type: 'tabLongPress',
                            target: route.key,
                        });
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
                                size={24}
                                color={isFocused ? GOLD : '#666'}
                            />
                            <Animated.Text
                                style={[
                                    styles.label,
                                    {
                                        color: isFocused ? GOLD : '#666',
                                        fontWeight: isFocused ? '700' : '500',
                                    },
                                ]}
                                numberOfLines={1}
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
        backgroundColor: 'rgba(10, 10, 10, 0.45)',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.4,
        shadowRadius: 15,
        overflow: 'hidden',
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
    // --- Sliding indicator ---
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
    indicatorHighlight: {
        position: 'absolute',
        top: 0,
        left: '15%',
        right: '15%',
        height: 1.5,
        borderRadius: 1,
        backgroundColor: 'rgba(245, 230, 163, 0.45)',
    },
    indicatorGlow: {
        position: 'absolute',
        bottom: -4,
        left: '20%',
        right: '20%',
        height: 8,
        borderRadius: 4,
        backgroundColor: GOLD,
        opacity: 0.25,
        // Simulates a diffuse glow below the pill
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.8,
        shadowRadius: 8,
        elevation: 3,
    },
});
