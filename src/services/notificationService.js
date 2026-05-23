import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Configure how notifications should behave when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export const NotificationService = {
    // 1. Request Permissions
    requestPermissions: async () => {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.log('Permission not granted for push notifications!');
            return false;
        }

        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#d4af37',
            });
        }
        return true;
    },

    // 2. Trigger Immediate Alert for Low Stock
    sendLowStockAlert: async (productName, remainingStock) => {
        await Notifications.scheduleNotificationAsync({
            content: {
                title: '⚡ ALERTA DE IMPERIO',
                body: `¡Atención! Quedan solo ${remainingStock} unidades de ${productName}. Stock crítico.`,
                data: { productName, remainingStock },
                color: '#d4af37',
                sound: true,
            },
            trigger: null, // send immediately
        });
    },

    // 3. Schedule Recurring Reminders (Every 5 hours)
    scheduleStockReminder: async (criticalProducts) => {
        if (!criticalProducts || criticalProducts.length === 0) return;

        // Cancel previous reminders to avoid clutter
        await Notifications.cancelAllScheduledNotificationsAsync();

        const productNames = criticalProducts.map(p => p.name).join(', ');

        await Notifications.scheduleNotificationAsync({
            content: {
                title: '🛡️ CENTINELA DEL IMPERIO',
                body: `Recordatorio: Tienes stock crítico en: ${productNames}. Reabastece para no perder ventas.`,
                color: '#d4af37',
            },
            trigger: {
                seconds: 5 * 60 * 60, // 5 hours in seconds
                repeats: true
            },
        });
    },

    // 4. Schedule User Reminder
    scheduleReminder: async (id, title, notes, dateString) => {
        try {
            const triggerDate = new Date(dateString);
            if (triggerDate.getTime() <= Date.now()) {
                console.log('[NotificationService] Date is in the past, skipping trigger scheduling');
                return null;
            }

            const hasPerm = await NotificationService.requestPermissions();
            if (!hasPerm) {
                console.log('[NotificationService] No notification permissions granted');
                return null;
            }

            const notifId = await Notifications.scheduleNotificationAsync({
                content: {
                    title: `📅 AGENDA: ${title}`,
                    body: notes || 'Tienes una tarea pendiente ahora.',
                    color: '#d4af37',
                    sound: true,
                },
                trigger: {
                    type: Notifications.SchedulableTriggerInputTypes.DATE,
                    date: triggerDate,
                },
            });
            console.log(`[NotificationService] Scheduled notification ID: ${notifId} at ${triggerDate.toISOString()}`);
            return notifId;
        } catch (err) {
            console.error('[NotificationService] Error scheduling notification:', err);
            return null;
        }
    },

    // 5. Cancel Scheduled Reminder
    cancelReminder: async (notificationId) => {
        if (!notificationId) return;
        try {
            await Notifications.cancelScheduledNotificationAsync(notificationId);
            console.log(`[NotificationService] Canceled scheduled notification ID: ${notificationId}`);
        } catch (err) {
            console.warn('[NotificationService] Cancel notification error:', err.message);
        }
    }
};
