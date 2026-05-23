let mockPlatformOS = 'android';

jest.mock('react-native', () => ({
    Platform: {
        get OS() {
            return mockPlatformOS;
        }
    }
}));

// Mock expo-notifications inside factory to prevent TDZ hoisting issues
jest.mock('expo-notifications', () => {
    return {
        getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
        requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
        setNotificationChannelAsync: jest.fn().mockResolvedValue(),
        scheduleNotificationAsync: jest.fn().mockResolvedValue('notif_12345'),
        cancelAllScheduledNotificationsAsync: jest.fn().mockResolvedValue(),
        cancelScheduledNotificationAsync: jest.fn().mockResolvedValue(),
        setNotificationHandler: jest.fn(),
        AndroidImportance: {
            MAX: 4,
        },
        SchedulableTriggerInputTypes: {
            DATE: 'date',
        }
    };
});

import { NotificationService } from '../services/notificationService';
import * as Notifications from 'expo-notifications';

describe('NotificationService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPlatformOS = 'android';
        
        // Reset default mock returns
        Notifications.getPermissionsAsync.mockResolvedValue({ status: 'granted' });
        Notifications.requestPermissionsAsync.mockResolvedValue({ status: 'granted' });
        Notifications.scheduleNotificationAsync.mockResolvedValue('notif_12345');
    });

    describe('requestPermissions', () => {
        test('should request permissions and configure channel on Android if granted', async () => {
            mockPlatformOS = 'android';
            Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'undetermined' });
            Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

            const result = await NotificationService.requestPermissions();

            expect(result).toBe(true);
            expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
            expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
            expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith('default', expect.objectContaining({
                name: 'default',
                importance: 4,
            }));
        });

        test('should skip channel configuration on iOS', async () => {
            mockPlatformOS = 'ios';
            Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

            const result = await NotificationService.requestPermissions();

            expect(result).toBe(true);
            expect(Notifications.getPermissionsAsync).toHaveBeenCalled();
            expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
            expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
        });

        test('should return false if permissions are denied', async () => {
            Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
            Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

            const result = await NotificationService.requestPermissions();

            expect(result).toBe(false);
            expect(Notifications.setNotificationChannelAsync).not.toHaveBeenCalled();
        });
    });

    describe('sendLowStockAlert', () => {
        test('should immediately schedule low stock alert notification', async () => {
            await NotificationService.sendLowStockAlert('Imperial Charger', 3);

            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
                content: expect.objectContaining({
                    title: '⚡ ALERTA DE IMPERIO',
                    body: expect.stringContaining('Quedan solo 3 unidades de Imperial Charger'),
                }),
                trigger: null
            });
        });
    });

    describe('scheduleStockReminder', () => {
        test('should cancel previous notifications and schedule recurring reminder', async () => {
            const criticalProducts = [{ name: 'Cable Havit' }, { name: 'Powerbank' }];
            await NotificationService.scheduleStockReminder(criticalProducts);

            expect(Notifications.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
                content: expect.objectContaining({
                    title: '🛡️ CENTINELA DEL IMPERIO',
                    body: expect.stringContaining('Cable Havit, Powerbank'),
                }),
                trigger: expect.objectContaining({
                    seconds: 18000,
                    repeats: true
                })
            });
        });

        test('should do nothing if critical products list is empty', async () => {
            await NotificationService.scheduleStockReminder([]);
            expect(Notifications.cancelAllScheduledNotificationsAsync).not.toHaveBeenCalled();
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });
    });

    describe('scheduleReminder', () => {
        test('should schedule date-based reminder if date is in the future and permission granted', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString(); // 1 hour in future
            Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'granted' });

            const notifId = await NotificationService.scheduleReminder(
                'rem_456',
                'Cobrar a Gabriela',
                'Hacer seguimiento de pago',
                futureDate
            );

            expect(notifId).toBe('notif_12345');
            expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({
                content: expect.objectContaining({
                    title: '📅 AGENDA: Cobrar a Gabriela',
                    body: 'Hacer seguimiento de pago',
                }),
                trigger: {
                    type: 'date',
                    date: expect.any(Date),
                }
            });
        });

        test('should return null and skip scheduling if date is in the past', async () => {
            const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1 hour in past

            const notifId = await NotificationService.scheduleReminder(
                'rem_111',
                'Reunión terminada',
                'Esto es pasado',
                pastDate
            );

            expect(notifId).toBeNull();
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });

        test('should return null if notification permissions are denied', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
            Notifications.getPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
            Notifications.requestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

            const notifId = await NotificationService.scheduleReminder(
                'rem_222',
                'Test Denegado',
                'No permissions',
                futureDate
            );

            expect(notifId).toBeNull();
            expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
        });
    });

    describe('cancelReminder', () => {
        test('should cancel notification using unique notification id', async () => {
            await NotificationService.cancelReminder('notif_9999');

            expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('notif_9999');
        });

        test('should do nothing if notification id is null or empty', async () => {
            await NotificationService.cancelReminder(null);

            expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
        });
    });
});
