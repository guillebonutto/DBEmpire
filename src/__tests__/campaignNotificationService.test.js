import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CampaignNotificationService } from '../services/CampaignNotificationService';

jest.mock('expo-notifications', () => ({
    getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
    getAllScheduledNotificationsAsync: jest.fn().mockResolvedValue([]),
    scheduleNotificationAsync: jest.fn(),
    cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(),
    setNotificationHandler: jest.fn(),
    SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
    getItem: jest.fn(),
    setItem: jest.fn().mockResolvedValue(),
}));

describe('CampaignNotificationService', () => {
    let storedValues;
    let nextNotificationId;

    beforeEach(() => {
        jest.clearAllMocks();
        Object.defineProperty(Platform, 'OS', { get: () => 'android', configurable: true });
        storedValues = {};
        nextNotificationId = 0;
        AsyncStorage.getItem.mockImplementation(async key => storedValues[key] || null);
        AsyncStorage.setItem.mockImplementation(async (key, value) => {
            storedValues[key] = value;
        });
        Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
        Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([]);
        Notifications.scheduleNotificationAsync.mockImplementation(async () => `campaign-${++nextNotificationId}`);
    });

    test('recovers partial prior runs and caps future campaign alarms', async () => {
        storedValues.campaign_notification_ids = JSON.stringify(['saved-campaign-id']);
        storedValues.custom_campaign_events = JSON.stringify(Array.from({ length: 100 }, (_, index) => ({
            id: `custom-${index}`,
            name: `Custom ${index}`,
            dateString: `2027-${String((index % 12) + 1).padStart(2, '0')}-15`,
            isCustom: true,
        })));
        Notifications.getAllScheduledNotificationsAsync.mockResolvedValue([
            {
                identifier: 'orphaned-campaign-id',
                content: { title: '⚠️ Campaña Urgente: Evento', data: { screen: 'CampaignPlanner' } },
            },
            {
                identifier: 'unrelated-reminder-id',
                content: { title: 'Recordatorio personal', data: { screen: 'Agenda' } },
            },
        ]);

        await CampaignNotificationService.scheduleCampaignReminders();

        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('saved-campaign-id');
        expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('orphaned-campaign-id');
        expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('unrelated-reminder-id');
        expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledTimes(40);
        expect(JSON.parse(storedValues.campaign_notification_ids)).toHaveLength(40);
    });

    test('stores IDs as notifications are scheduled so a failed run can clean them up', async () => {
        Notifications.scheduleNotificationAsync
            .mockResolvedValueOnce('scheduled-before-failure')
            .mockRejectedValueOnce(new Error('alarm limit reached'));

        await CampaignNotificationService.scheduleCampaignReminders();

        expect(JSON.parse(storedValues.campaign_notification_ids)).toEqual(['scheduled-before-failure']);
    });
});
