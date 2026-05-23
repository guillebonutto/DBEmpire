/**
 * CustomAlert.js
 * 
 * Sistema de alertas premium para Digital Boost Empire.
 * Reemplaza Alert.alert() nativo con un modal branded, animado y con
 * design system consistente (fondo negro, acentos dorados, glassmorphism).
 *
 * Variantes: success | error | warning | info | sandbox | confirm
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Dimensions,
    BackHandler,
    Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width: SCREEN_W } = Dimensions.get('window');
const MODAL_WIDTH = Math.min(SCREEN_W - 48, 360);

// ─── Design Tokens ───────────────────────────────────────────────────────────
const PALETTE = {
    success:  { accent: '#00e676', bg: '#00e67614', icon: 'check-circle-outline' },
    error:    { accent: '#ff5252', bg: '#ff525214', icon: 'alert-circle-outline' },
    warning:  { accent: '#ffab00', bg: '#ffab0014', icon: 'alert-outline' },
    info:     { accent: '#d4af37', bg: '#d4af3714', icon: 'information-outline' },
    sandbox:  { accent: '#a78bfa', bg: '#a78bfa14', icon: 'flask-outline' },
    confirm:  { accent: '#d4af37', bg: '#d4af3714', icon: 'help-circle-outline' },
};

// ─── AnimatedButton ───────────────────────────────────────────────────────────
function AnimatedButton({ onPress, style, textStyle, label, isPrimary, accentColor, isDestructive }) {
    const scale = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scale, {
            toValue: 0.94,
            useNativeDriver: true,
            speed: 50,
            bounciness: 4,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            speed: 20,
            bounciness: 8,
        }).start();
    };

    const primaryBg = isDestructive ? '#ff525218' : `${accentColor}18`;
    const primaryBorder = isDestructive ? '#ff5252' : accentColor;
    const primaryText = isDestructive ? '#ff5252' : accentColor;

    return (
        <Animated.View style={{ transform: [{ scale }], flex: 1 }}>
            <TouchableOpacity
                activeOpacity={1}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                onPress={onPress}
                style={[
                    styles.btn,
                    isPrimary
                        ? { backgroundColor: primaryBg, borderColor: primaryBorder, borderWidth: 1 }
                        : { backgroundColor: '#0a0a0a', borderColor: '#222', borderWidth: 1 },
                    style,
                ]}
            >
                <Text
                    style={[
                        styles.btnText,
                        isPrimary
                            ? { color: primaryText, fontWeight: '900' }
                            : { color: '#555', fontWeight: '700' },
                        textStyle,
                    ]}
                    numberOfLines={1}
                >
                    {label}
                </Text>
            </TouchableOpacity>
        </Animated.View>
    );
}

// ─── CustomAlert ──────────────────────────────────────────────────────────────
export default function CustomAlert({
    visible = false,
    type = 'info',           // 'success' | 'error' | 'warning' | 'info' | 'sandbox' | 'confirm'
    title = '',
    message = '',
    buttons = [],            // [{ text, onPress, style }] — style: 'cancel' | 'destructive' | 'default'
    onDismiss,               // called when backdrop tapped (if dismissable)
    dismissable = false,     // whether tapping backdrop closes the alert
}) {
    const palette = PALETTE[type] || PALETTE.info;
    const { accent, bg, icon } = palette;

    // ── Animations ──
    const backdropOpacity  = useRef(new Animated.Value(0)).current;
    const cardScale        = useRef(new Animated.Value(0.82)).current;
    const cardOpacity      = useRef(new Animated.Value(0)).current;
    const iconPulse        = useRef(new Animated.Value(1)).current;
    const accentLineWidth  = useRef(new Animated.Value(0)).current;
    const pulseAnim        = useRef(null);

    const animateIn = useCallback(() => {
        // Start icon pulse loop
        pulseAnim.current = Animated.loop(
            Animated.sequence([
                Animated.timing(iconPulse, { toValue: 1.12, duration: 900, useNativeDriver: true }),
                Animated.timing(iconPulse, { toValue: 1.0,  duration: 900, useNativeDriver: true }),
            ])
        );

        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 1, duration: 220, useNativeDriver: true,
            }),
            Animated.spring(cardScale, {
                toValue: 1, friction: 7, tension: 120, useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
                toValue: 1, duration: 200, useNativeDriver: true,
            }),
            Animated.timing(accentLineWidth, {
                toValue: MODAL_WIDTH, duration: 350, delay: 120, useNativeDriver: false,
            }),
        ]).start(() => {
            pulseAnim.current?.start();
        });
    }, []);

    const animateOut = useCallback((cb) => {
        pulseAnim.current?.stop();
        Animated.parallel([
            Animated.timing(backdropOpacity, {
                toValue: 0, duration: 180, useNativeDriver: true,
            }),
            Animated.timing(cardScale, {
                toValue: 0.88, duration: 160, useNativeDriver: true,
            }),
            Animated.timing(cardOpacity, {
                toValue: 0, duration: 160, useNativeDriver: true,
            }),
        ]).start(() => {
            // Reset for next show
            cardScale.setValue(0.82);
            cardOpacity.setValue(0);
            backdropOpacity.setValue(0);
            accentLineWidth.setValue(0);
            iconPulse.setValue(1);
            cb?.();
        });
    }, []);

    useEffect(() => {
        if (visible) {
            animateIn();
        }
    }, [visible]);

    // Android back button
    useEffect(() => {
        if (!visible) return;
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            if (dismissable) onDismiss?.();
            return true; // always consume
        });
        return () => sub.remove();
    }, [visible, dismissable]);

    // Build buttons: default to single OK if none provided
    const resolvedButtons = buttons.length > 0 ? buttons : [{ text: 'OK', onPress: null }];

    const handleButtonPress = (btn) => {
        animateOut(() => {
            btn.onPress?.();
        });
    };

    const handleBackdropPress = () => {
        if (dismissable) {
            animateOut(() => onDismiss?.());
        }
    };

    if (!visible) return null;

    const BlurOrView = Platform.OS === 'android' ? View : BlurView;
    const blurProps = Platform.OS !== 'android'
        ? { intensity: 60, tint: 'dark' }
        : { style: { backgroundColor: 'rgba(0,0,0,0.88)' } };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={() => {
                if (dismissable) animateOut(() => onDismiss?.());
            }}
        >
            {/* ── Backdrop ── */}
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <TouchableOpacity
                    style={StyleSheet.absoluteFill}
                    activeOpacity={1}
                    onPress={handleBackdropPress}
                />
            </Animated.View>

            {/* ── Card ── */}
            <View style={styles.centeredContainer} pointerEvents="box-none">
                <Animated.View
                    style={[
                        styles.card,
                        {
                            opacity: cardOpacity,
                            transform: [{ scale: cardScale }],
                        },
                    ]}
                >
                    {/* Blur background */}
                    <BlurOrView
                        {...blurProps}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Animated accent top line */}
                    <Animated.View
                        style={[
                            styles.accentLine,
                            { backgroundColor: accent, width: accentLineWidth },
                        ]}
                    />

                    {/* Content */}
                    <View style={styles.content}>
                        {/* Icon */}
                        <Animated.View
                            style={[
                                styles.iconContainer,
                                { backgroundColor: bg, transform: [{ scale: iconPulse }] },
                            ]}
                        >
                            <MaterialCommunityIcons name={icon} size={32} color={accent} />
                        </Animated.View>

                        {/* Title */}
                        {!!title && (
                            <Text style={[styles.title, { color: accent }]} numberOfLines={2}>
                                {title}
                            </Text>
                        )}

                        {/* Message */}
                        {!!message && (
                            <Text style={styles.message}>
                                {message}
                            </Text>
                        )}

                        {/* Separator */}
                        <View style={[styles.separator, { backgroundColor: accent + '22' }]} />

                        {/* Buttons */}
                        <View style={[
                            styles.buttonRow,
                            resolvedButtons.length === 1 && { justifyContent: 'center' },
                        ]}>
                            {resolvedButtons.map((btn, idx) => {
                                const isCancel = btn.style === 'cancel';
                                const isDestructive = btn.style === 'destructive';
                                // Last non-cancel button = primary; cancel = secondary
                                const cancelIdx = resolvedButtons.findIndex(b => b.style === 'cancel');
                                const isPrimary = isCancel ? false : (idx === resolvedButtons.length - 1 || cancelIdx !== -1);

                                return (
                                    <AnimatedButton
                                        key={idx}
                                        label={btn.text || 'OK'}
                                        isPrimary={isPrimary}
                                        isDestructive={isDestructive}
                                        accentColor={accent}
                                        onPress={() => handleButtonPress(btn)}
                                    />
                                );
                            })}
                        </View>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.75)',
    },
    centeredContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    card: {
        width: MODAL_WIDTH,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#0d0d0d',
        borderWidth: 1,
        borderColor: '#1a1a1a',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.6,
        shadowRadius: 30,
        elevation: 25,
    },
    accentLine: {
        height: 3,
        borderRadius: 3,
    },
    content: {
        padding: 24,
        alignItems: 'center',
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        textAlign: 'center',
        letterSpacing: 0.3,
        marginBottom: 10,
    },
    message: {
        fontSize: 14,
        color: '#888',
        textAlign: 'center',
        lineHeight: 20,
        fontWeight: '500',
    },
    separator: {
        width: '100%',
        height: 1,
        marginTop: 20,
        marginBottom: 16,
        borderRadius: 1,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    btn: {
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnText: {
        fontSize: 13,
        letterSpacing: 0.5,
    },
});
