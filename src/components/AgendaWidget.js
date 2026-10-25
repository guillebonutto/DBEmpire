import React, { useState, useEffect } from 'react';
import {
    View,
    StyleSheet,
    TouchableOpacity,
    Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { useReminderStore } from '../store/useReminderStore';
import { useAuthStore } from '../store/useAuthStore';
import ImperialAgendaView from './ImperialAgendaView';

export default function AgendaWidget() {
    const insets = useSafeAreaInsets();
    const userRole = useAuthStore(state => state.userRole);
    const { reminders, initStore } = useReminderStore();
    const [modalVisible, setModalVisible] = useState(false);

    // Initialize store when role changes
    useEffect(() => {
        if (userRole) {
            initStore();
        }
    }, [userRole]);

    // Don't render the floating widget if user is not logged in
    if (!userRole) return null;

    // Check if there are active reminders today or overdue
    const hasPendingTodayOrOverdue = reminders.some(r => {
        if (r.completed === 1) return false;
        const d = new Date(r.due_date);
        const today = new Date();
        return d.toDateString() === today.toDateString() || d.getTime() < today.getTime();
    });

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

            {/* Premium Fullscreen Modal with Imperial Calendar Agenda */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={false}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalContainer}>
                    <ImperialAgendaView 
                        onClose={() => setModalVisible(false)}
                        isScreen={false}
                    />
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
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
    modalContainer: {
        flex: 1,
        backgroundColor: '#121316',
    },
});
