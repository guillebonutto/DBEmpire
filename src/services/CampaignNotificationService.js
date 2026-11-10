import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Set notification handler to show alerts when app is in foreground
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

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
    { id: 'valentines', name: 'San Valentín 💖', month: 1, day: 14, isFixed: true },
    { id: 'hotsale', name: 'Hot Sale 🔥', month: 4, day: 15, isFixed: true },
    { id: 'father', name: 'Día del Padre 👔', month: 5, getNthSunday: (y) => getNthSunday(y, 5, 3), isFixed: false },
    { id: 'friend', name: 'Día del Amigo 🤝', month: 6, day: 20, isFixed: true },
    { id: 'child', name: 'Día del Niño 🎮', month: 7, getNthSunday: (y) => getNthSunday(y, 7, 3), isFixed: false },
    { id: 'mother', name: 'Día de la Madre 🌸', month: 9, getNthSunday: (y) => getNthSunday(y, 9, 3), isFixed: false },
    { id: 'cybermonday', name: 'CyberMonday ⚡', month: 10, day: 4, isFixed: true },
    { id: 'christmas', name: 'Navidad 🎄', month: 11, day: 25, isFixed: true }
];

const MAX_CAMPAIGN_NOTIFICATIONS = 40;
let campaignSchedulePromise = null;

const calculateEventDetails = (event) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentYear = today.getFullYear();
    let targetDate;

    if (event.isCustom) {
        targetDate = new Date(event.dateString + 'T00:00:00');
        if (targetDate < today) {
            targetDate.setFullYear(currentYear + 1);
        }
    } else {
        if (event.isFixed) {
            targetDate = new Date(currentYear, event.month, event.day);
        } else {
            targetDate = event.getNthSunday(currentYear);
        }

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

export const CampaignNotificationService = {
    // Request notification permissions
    requestPermissions: async () => {
        if (Platform.OS === 'web') return false;
        try {
            const { status: existingStatus } = await Notifications.getPermissionsAsync();
            let finalStatus = existingStatus;
            if (existingStatus !== 'granted') {
                const { status } = await Notifications.requestPermissionsAsync();
                finalStatus = status;
            }
            return finalStatus === 'granted';
        } catch (error) {
            console.error('[CampaignNotificationService] Error requesting permission:', error);
            return false;
        }
    },

    // Clean previous scheduled notifications and schedule new ones autonomously
    scheduleCampaignReminders: () => {
        if (campaignSchedulePromise) return campaignSchedulePromise;

        campaignSchedulePromise = scheduleCampaignReminders().finally(() => {
            campaignSchedulePromise = null;
        });
        return campaignSchedulePromise;
    }
};

async function scheduleCampaignReminders() {
        if (Platform.OS === 'web') return;

        try {
            const hasPermission = await CampaignNotificationService.requestPermissions();
            if (!hasPermission) {
                console.log('[CampaignNotificationService] Notification permission not granted');
                return;
            }

            // Cancel stored IDs and recover campaign reminders left behind by a partial run.
            const savedIdsJson = await AsyncStorage.getItem('campaign_notification_ids');
            const savedIds = savedIdsJson ? JSON.parse(savedIdsJson) : [];
            const scheduledNotifications = await Notifications.getAllScheduledNotificationsAsync();
            const campaignNotificationIds = scheduledNotifications
                .filter(({ content }) => (
                    content?.data?.source === 'campaign-reminder'
                    || content?.data?.screen === 'CampaignPlanner'
                    || content?.title?.startsWith('📅 Planificar Campaña:')
                    || content?.title?.startsWith('⚠️ Campaña Urgente:')
                ))
                .map(({ identifier }) => identifier);
            const campaignNotificationIdSet = new Set(campaignNotificationIds);
            const unrelatedNotificationCount = scheduledNotifications
                .filter(({ identifier }) => !campaignNotificationIdSet.has(identifier))
                .length;
            const idsToCancel = new Set([...savedIds, ...campaignNotificationIds]);
            for (const id of idsToCancel) {
                try {
                    await Notifications.cancelScheduledNotificationAsync(id);
                } catch (error) {
                    console.warn(`[CampaignNotificationService] Could not cancel old campaign notification ${id}:`, error);
                }
            }
            await AsyncStorage.setItem('campaign_notification_ids', JSON.stringify([]));

            // Load Custom Events
            let customEvents = [];
            const customData = await AsyncStorage.getItem('custom_campaign_events');
            if (customData) {
                customEvents = JSON.parse(customData);
            }

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

            const allEvents = [...baseCalculated, ...customCalculated];

            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const notificationCandidates = [];

            for (const event of allEvents) {
                const targetDate = new Date(event.date);
                targetDate.setHours(9, 0, 0, 0); // Trigger at 9:00 AM

                // Alert 30 days before
                const date30DaysPrior = new Date(targetDate);
                date30DaysPrior.setDate(date30DaysPrior.getDate() - 30);

                if (date30DaysPrior > today) {
                    notificationCandidates.push({
                        title: `📅 Planificar Campaña: ${event.name}`,
                        body: 'Faltan 30 días para el evento. Ingresá a la app y usá la IA para definir tus promociones y stock.',
                        date: date30DaysPrior,
                    });
                }

                // Alert 15 days before
                const date15DaysPrior = new Date(targetDate);
                date15DaysPrior.setDate(date15DaysPrior.getDate() - 15);

                if (date15DaysPrior > today) {
                    notificationCandidates.push({
                        title: `⚠️ Campaña Urgente: ${event.name}`,
                        body: '¡Faltan 15 días! Límite para subir tus promociones y combos al Imperio.',
                        date: date15DaysPrior,
                    });
                }
            }

            notificationCandidates.sort((a, b) => a.date - b.date);
            const newNotificationIds = [];
            const alarmBudget = Platform.OS === 'android'
                ? Math.max(0, 450 - unrelatedNotificationCount)
                : MAX_CAMPAIGN_NOTIFICATIONS;
            const notificationLimit = Math.min(MAX_CAMPAIGN_NOTIFICATIONS, alarmBudget);
            for (const candidate of notificationCandidates.slice(0, notificationLimit)) {
                const id = await Notifications.scheduleNotificationAsync({
                    content: {
                        title: candidate.title,
                        body: candidate.body,
                        data: { screen: 'CampaignPlanner', source: 'campaign-reminder' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: candidate.date,
                    },
                });
                newNotificationIds.push(id);
                await AsyncStorage.setItem('campaign_notification_ids', JSON.stringify(newNotificationIds));
            }
            console.log(`[CampaignNotificationService] Scheduled ${newNotificationIds.length} campaign reminders (limit ${notificationLimit}).`);
        } catch (error) {
            console.error('[CampaignNotificationService] Error scheduling notifications:', error);
        }
}
