/**
 * CustomAlert.js
 * Sistema de alertas branded con design system Digital Boost Empire
 * 
 * Características:
 * - 5 variantes: success, error, warning, info, sandbox
 * - Animaciones fluidas con spring
 * - Glassmorphism con BlurView
 * - Iconos animados con pulso
 * - Soporte para 1, 2 o 3+ botones
 */

import React, { useEffect, useRef } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    Animated,
    StyleSheet,
    Platform,
    Dimensions,
    StatusBar
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Configuración de variantes con colores y iconos
const VARIANT_CONFIG = {
    success: {
        color: '#00ff88',
        icon: 'checkmark-circle',
        borderColor: '#00ff88',
        glowColor: 'rgba(0, 255, 136, 0.3)'
    },
    error: {
        color: '#ff4444',
        icon: 'alert-circle',
        borderColor: '#ff4444',
        glowColor: 'rgba(255, 68, 68, 0.3)'
    },
    warning: {
        color: '#ffaa00',
        icon: 'warning',
        borderColor: '#ffaa00',
        glowColor: 'rgba(255, 170, 0, 0.3)'
    },
    info: {
        color: '#d4af37',
        icon: 'information-circle',
        borderColor: '#d4af37',
        glowColor: 'rgba(212, 175, 55, 0.3)'
    },
    sandbox: {
        color: '#7C3AED',
        icon: 'flask',
        borderColor: '#7C3AED',
        glowColor: 'rgba(124, 58, 237, 0.3)'
    }
};

const CustomAlert = ({
    visible = false,
    type = 'info',
    title = '',
    message = '',
    buttons = [],
    onClose = () => { }
}) => {
    const scaleAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;
    const iconPulseAnim = useRef(new Animated.Value(1)).current;
    const iconRotateAnim = useRef(new Animated.Value(0)).current;

    const config = VARIANT_CONFIG[type] || VARIANT_CONFIG.info;

    useEffect(() => {
        if (visible) {
            // Animación de entrada con spring
            Animated.parallel([
                Animated.spring(scaleAnim, {
                    toValue: 1,
                    friction: 8,
                    tension: 40,
                    useNativeDriver: true
                }),
                Animated.timing(opacityAnim, {
                    toValue: 1,
                    duration: 200,
                    useNativeDriver: true
                })
            ]).start();

            // Animación de pulso del icono (loop infinito)
            Animated.loop(
                Animated.sequence([
                    Animated.timing(iconPulseAnim, {
                        toValue: 1.15,
                        duration: 1000,
                        useNativeDriver: true
                    }),
                    Animated.timing(iconPulseAnim, {
                        toValue: 1,
                        duration: 1000,
                        useNativeDriver: true
                    })
                ])
            ).start();

            // Rotación suave del icono al aparecer
            Animated.spring(iconRotateAnim, {
                toValue: 1,
                friction: 8,
                tension: 40,
                useNativeDriver: true
            }).start();
        } else {
            // Reset animaciones cuando se oculta
            scaleAnim.setValue(0);
            opacityAnim.setValue(0);
            iconPulseAnim.setValue(1);
            iconRotateAnim.setValue(0);
        }
    }, [visible]);

    const handleButtonPress = (button) => {
        // Animación de salida suave
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.85,
                friction: 8,
                useNativeDriver: true
            }),
            Animated.timing(opacityAnim, {
                toValue: 0,
                duration: 150,
                useNativeDriver: true
            })
        ]).start(() => {
            // Ejecutar callback del botón después de la animación
            if (button.onPress) {
                button.onPress();
            }
            // Cerrar el modal
            if (onClose) {
                onClose();
            }
        });
    };

    // Asegurar al menos un botón por defecto
    const displayButtons = buttons.length > 0
        ? buttons
        : [{ text: 'OK', onPress: () => { }, style: 'default' }];

    // Interpolación de rotación del icono
    const iconRotate = iconRotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    if (!visible) return null;

    return (
        <Modal
            transparent
            visible={visible}
            animationType="none"
            statusBarTranslucent
            onRequestClose={() => handleButtonPress(displayButtons[0])}
        >
            <StatusBar backgroundColor="rgba(0,0,0,0.7)" barStyle="light-content" />

            <Animated.View
                style={[
                    styles.overlay,
                    { opacity: opacityAnim }
                ]}
            >
                {/* Blur effect para iOS, fondo sólido para Android */}
                {Platform.OS === 'ios' ? (
                    <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                ) : (
                    <View style={styles.androidBlur} />
                )}

                <Animated.View
                    style={[
                        styles.alertContainer,
                        {
                            transform: [{ scale: scaleAnim }],
                            borderTopColor: config.borderColor,
                            shadowColor: config.glowColor
                        }
                    ]}
                >
                    {/* Línea superior de acento con gradiente */}
                    <View style={[styles.accentLine, { backgroundColor: config.borderColor }]} />

                    {/* Icono animado con pulso y rotación */}
                    <Animated.View
                        style={{
                            transform: [
                                { scale: iconPulseAnim },
                                { rotate: iconRotate }
                            ]
                        }}
                    >
                        <View style={[styles.iconContainer, { backgroundColor: config.glowColor }]}>
                            <Ionicons
                                name={config.icon}
                                size={56}
                                color={config.color}
                            />
                        </View>
                    </Animated.View>

                    {/* Título */}
                    {title ? (
                        <Text style={styles.title} numberOfLines={2}>
                            {title}
                        </Text>
                    ) : null}

                    {/* Mensaje */}
                    {message ? (
                        <Text style={styles.message} numberOfLines={5}>
                            {message}
                        </Text>
                    ) : null}

                    {/* Botones */}
                    <View style={[
                        styles.buttonsContainer,
                        displayButtons.length === 1 && styles.singleButton,
                        displayButtons.length === 2 && styles.twoButtons,
                        displayButtons.length >= 3 && styles.multipleButtons
                    ]}>
                        {displayButtons.map((button, index) => (
                            <AlertButton
                                key={`btn-${index}`}
                                button={button}
                                config={config}
                                onPress={() => handleButtonPress(button)}
                                isLast={index === displayButtons.length - 1}
                                total={displayButtons.length}
                            />
                        ))}
                    </View>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

// Componente de botón con animación de press
const AlertButton = ({ button, config, onPress, isLast, total }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const glowAnim = useRef(new Animated.Value(0)).current;

    const handlePressIn = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 0.95,
                friction: 3,
                useNativeDriver: true
            }),
            Animated.timing(glowAnim, {
                toValue: 1,
                duration: 100,
                useNativeDriver: false
            })
        ]).start();
    };

    const handlePressOut = () => {
        Animated.parallel([
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 3,
                useNativeDriver: true
            }),
            Animated.timing(glowAnim, {
                toValue: 0,
                duration: 100,
                useNativeDriver: false
            })
        ]).start();
    };

    // Determinar estilo del botón
    const isPrimary = button.style === 'default' || button.style === 'confirm' || !button.style;
    const isDestructive = button.style === 'destructive';
    const isCancel = button.style === 'cancel';

    // Color de fondo dinámico
    const backgroundColor = glowAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [
            isDestructive ? '#ff4444' : (isPrimary ? config.color : '#2a2a2a'),
            isDestructive ? '#ff6666' : (isPrimary ? config.borderColor : '#3a3a3a')
        ]
    });

    return (
        <Animated.View
            style={[
                styles.buttonWrapper,
                total === 2 && styles.halfWidth,
                total >= 3 && styles.fullWidth,
                { transform: [{ scale: scaleAnim }] }
            ]}
        >
            <TouchableOpacity
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={0.9}
                style={styles.buttonTouchable}
            >
                <Animated.View
                    style={[
                        styles.button,
                        { backgroundColor }
                    ]}
                >
                    <Text style={[
                        styles.buttonText,
                        (isPrimary || isDestructive) && styles.primaryButtonText,
                        isCancel && styles.cancelButtonText
                    ]}>
                        {button.text.toUpperCase()}
                    </Text>
                </Animated.View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20
    },
    androidBlur: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.85)'
    },
    alertContainer: {
        width: Math.min(width - 40, 420),
        maxHeight: height * 0.8,
        backgroundColor: '#1a1a1a',
        borderRadius: 24,
        padding: 28,
        borderTopWidth: 5,
        shadowOffset: { width: 0, height: 15 },
        shadowOpacity: 0.6,
        shadowRadius: 25,
        elevation: 15,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    accentLine: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 5,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24
    },
    iconContainer: {
        width: 90,
        height: 90,
        borderRadius: 45,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        marginTop: 12
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#ffffff',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: 0.8,
        lineHeight: 30
    },
    message: {
        fontSize: 16,
        color: '#c0c0c0',
        textAlign: 'center',
        marginBottom: 28,
        lineHeight: 24,
        letterSpacing: 0.3
    },
    buttonsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 4,
        gap: 12
    },
    singleButton: {
        justifyContent: 'center'
    },
    twoButtons: {
        justifyContent: 'space-between'
    },
    multipleButtons: {
        flexDirection: 'column'
    },
    buttonWrapper: {
        flex: 1
    },
    halfWidth: {
        flex: 0,
        minWidth: '48%'
    },
    fullWidth: {
        width: '100%'
    },
    buttonTouchable: {
        width: '100%'
    },
    button: {
        paddingVertical: 16,
        paddingHorizontal: 24,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 52
    },
    buttonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 1.2
    },
    primaryButtonText: {
        color: '#000000'
    },
    cancelButtonText: {
        color: '#999999'
    },
    destructiveButtonText: {
        color: '#ffffff'
    }
});

export default CustomAlert;