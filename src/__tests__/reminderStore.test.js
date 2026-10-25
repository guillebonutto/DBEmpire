// Mocks must be defined before imports due to Jest hoisting

jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
    Alert: { alert: jest.fn() },
}));

// Mock syncService
jest.mock('../services/syncService', () => ({
    SyncService: {
        queueAction: jest.fn().mockResolvedValue(),
    }
}));

// Mock localDbService
jest.mock('../services/localDbService', () => ({
    LocalDbService: {
        getAll: jest.fn(),
        saveItem: jest.fn().mockResolvedValue(),
        deleteItem: jest.fn().mockResolvedValue(),
        queueForSync: jest.fn().mockResolvedValue(),
        getPendingSyncs: jest.fn().mockResolvedValue([]),
    }
}));

// Mock notificationService
jest.mock('../services/notificationService', () => ({
    NotificationService: {
        scheduleReminder: jest.fn().mockResolvedValue('notif_abc123'),
        cancelReminder: jest.fn().mockResolvedValue(),
    }
}));

import { useReminderStore } from '../store/useReminderStore';
import { LocalDbService } from '../services/localDbService';
import { NotificationService } from '../services/notificationService';

// Helper to get fresh store state
const getState = () => useReminderStore.getState();

describe('useReminderStore', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset store to initial state
        useReminderStore.setState({
            reminders: [],
            loadingReminders: false,
            isInitialized: false,
        });
    });

    describe('initStore', () => {
        test('should load reminders from SQLite sorted chronologically by due_date', async () => {
            const mockReminders = [
                { id: 'rem_2', title: 'Segundo', due_date: '2026-05-25T10:00:00Z', completed: 0 },
                { id: 'rem_1', title: 'Primero', due_date: '2026-05-24T08:00:00Z', completed: 0 },
                { id: 'rem_3', title: 'Tercero', due_date: '2026-05-26T12:00:00Z', completed: 0 },
            ];
            LocalDbService.getAll.mockResolvedValueOnce(mockReminders);

            await getState().initStore();

            const { reminders, isInitialized, loadingReminders } = getState();
            expect(isInitialized).toBe(true);
            expect(loadingReminders).toBe(false);
            expect(reminders).toHaveLength(3);
            // Verify ascending sort by due_date
            expect(reminders[0].id).toBe('rem_1');
            expect(reminders[1].id).toBe('rem_2');
            expect(reminders[2].id).toBe('rem_3');
        });

        test('should not re-initialize if already initialized', async () => {
            useReminderStore.setState({ isInitialized: true });
            
            await getState().initStore();
            
            expect(LocalDbService.getAll).not.toHaveBeenCalled();
        });

        test('should log error if LocalDbService.getAll fails on init', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            LocalDbService.getAll.mockRejectedValueOnce(new Error('init err'));

            await getState().initStore();

            expect(consoleSpy).toHaveBeenCalledWith('[ReminderStore] Init error:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('fetchReminders', () => {
        test('should refresh reminders from database', async () => {
            const freshReminders = [
                { id: 'rem_fresh', title: 'Refreshed', due_date: '2026-06-01T09:00:00Z', completed: 0 }
            ];
            LocalDbService.getAll.mockResolvedValueOnce(freshReminders);

            await getState().fetchReminders();

            const { reminders } = getState();
            expect(reminders).toHaveLength(1);
            expect(reminders[0].id).toBe('rem_fresh');
        });

        test('should log error if LocalDbService.getAll fails on fetch', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            LocalDbService.getAll.mockRejectedValueOnce(new Error('fetch err'));

            await getState().fetchReminders();

            expect(consoleSpy).toHaveBeenCalledWith('[ReminderStore] Fetch error:', expect.any(Error));
            consoleSpy.mockRestore();
        });
    });

    describe('addReminder', () => {
        test('should add reminder to store and schedule native notification', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();

            const newReminder = await getState().addReminder(
                'Cobrar deuda',
                'Llamar a Juan',
                futureDate
            );

            // Verify notification scheduled
            expect(NotificationService.scheduleReminder).toHaveBeenCalledWith(
                expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
                'Cobrar deuda',
                'Llamar a Juan',
                futureDate
            );

            // Verify saved to sync queue
            expect(require('../services/syncService').SyncService.queueAction).toHaveBeenCalledWith(
                'reminder',
                expect.objectContaining({
                    title: 'Cobrar deuda',
                    notes: 'Llamar a Juan',
                    due_date: futureDate,
                    completed: 0,
                    notification_id: 'notif_abc123',
                }),
                {},
                'INSERT'
            );

            // Verify in memory state
            const { reminders } = getState();
            expect(reminders).toHaveLength(1);
            expect(reminders[0].title).toBe('Cobrar deuda');
            expect(newReminder.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
        });

        test('should cancel notification if local db save fails', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
            require('../services/syncService').SyncService.queueAction.mockRejectedValueOnce(new Error('DB write failed'));

            await expect(
                getState().addReminder('Tarea fallida', 'Notas', futureDate)
            ).rejects.toThrow('DB write failed');

            // Notification should be cancelled if DB failed
            expect(NotificationService.cancelReminder).toHaveBeenCalledWith('notif_abc123');
        });

        test('should handle scheduling failure gracefully', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            NotificationService.scheduleReminder.mockRejectedValueOnce(new Error('schedule err'));
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();

            await getState().addReminder('Test schedule fail', '', futureDate);

            expect(consoleSpy).toHaveBeenCalledWith('[ReminderStore] Notification scheduling failed:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        test('should handle cancellation error when save fails', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            require('../services/syncService').SyncService.queueAction.mockRejectedValueOnce(new Error('save error'));
            NotificationService.cancelReminder.mockRejectedValueOnce(new Error('cancel err'));
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();

            await expect(getState().addReminder('Test cancel fail', '', futureDate)).rejects.toThrow('save error');

            expect(consoleSpy).toHaveBeenCalledWith('[ReminderStore] Error canceling notification on failure:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        test('should trim whitespace from title and notes', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
            await getState().addReminder('  Recordatorio  ', '  Notas extra  ', futureDate);

            expect(require('../services/syncService').SyncService.queueAction).toHaveBeenCalledWith(
                'reminder',
                expect.objectContaining({
                    title: 'Recordatorio',
                    notes: 'Notas extra',
                }),
                {},
                'INSERT'
            );
        });
    });

    describe('deleteReminder', () => {
        test('should remove reminder from store and cancel notification', async () => {
            const existingReminder = {
                id: 'rem_test_del',
                title: 'Para borrar',
                due_date: '2026-06-01T09:00:00Z',
                completed: 0,
                notification_id: 'notif_del_999'
            };
            useReminderStore.setState({ reminders: [existingReminder] });

            await getState().deleteReminder('rem_test_del');

            expect(NotificationService.cancelReminder).toHaveBeenCalledWith('notif_del_999');
            expect(require('../services/syncService').SyncService.queueAction).toHaveBeenCalledWith('reminder', { id: 'rem_test_del' }, {}, 'DELETE');
            
            const { reminders } = getState();
            expect(reminders).toHaveLength(0);
        });

        test('should do nothing if reminder id does not exist in store', async () => {
            useReminderStore.setState({ reminders: [] });

            await getState().deleteReminder('rem_nonexistent');

            expect(NotificationService.cancelReminder).not.toHaveBeenCalled();
            expect(require('../services/syncService').SyncService.queueAction).not.toHaveBeenCalled();
        });

        test('should warn if cancel notification fails on delete', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            useReminderStore.setState({ reminders: [{ id: 'rem_test_del', notification_id: 'notif_del_999' }] });
            NotificationService.cancelReminder.mockRejectedValueOnce(new Error('cancel err'));

            await getState().deleteReminder('rem_test_del');

            expect(consoleSpy).toHaveBeenCalledWith('[ReminderStore] Error canceling notification on delete:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        test('should throw error if delete fails', async () => {
            useReminderStore.setState({ reminders: [{ id: 'rem_test_del' }] });
            require('../services/syncService').SyncService.queueAction.mockRejectedValueOnce(new Error('delete err'));

            await expect(getState().deleteReminder('rem_test_del')).rejects.toThrow('delete err');
        });
    });

    describe('toggleReminderCompleted', () => {
        test('should mark pending reminder as completed and cancel notification', async () => {
            const pendingReminder = {
                id: 'rem_toggle',
                title: 'Pendiente',
                due_date: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
                completed: 0,
                notification_id: 'notif_toggle_111'
            };
            useReminderStore.setState({ reminders: [pendingReminder] });

            await getState().toggleReminderCompleted('rem_toggle');

            // Notification should be cancelled when marked as completed
            expect(NotificationService.cancelReminder).toHaveBeenCalledWith('notif_toggle_111');

            // State should be updated
            const { reminders } = getState();
            expect(reminders[0].completed).toBe(1);
            expect(reminders[0].notification_id).toBe('');
        });

        test('should re-schedule notification when marking a future-dated reminder as incomplete', async () => {
            const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
            const completedReminder = {
                id: 'rem_undo',
                title: 'Completada',
                notes: '',
                due_date: futureDate,
                completed: 1,
                notification_id: ''
            };
            useReminderStore.setState({ reminders: [completedReminder] });
            NotificationService.scheduleReminder.mockResolvedValueOnce('notif_rescheduled');

            await getState().toggleReminderCompleted('rem_undo');

            expect(NotificationService.scheduleReminder).toHaveBeenCalledWith(
                'rem_undo',
                'Completada',
                '',
                futureDate
            );

            const { reminders } = getState();
            expect(reminders[0].completed).toBe(0);
            expect(reminders[0].notification_id).toBe('notif_rescheduled');
        });

        test('should not re-schedule notification if past due date when marking as incomplete', async () => {
            const pastDate = new Date(Date.now() - 1000 * 60 * 60).toISOString();
            const completedPastReminder = {
                id: 'rem_past_undo',
                title: 'Pasada',
                due_date: pastDate,
                completed: 1,
                notification_id: ''
            };
            useReminderStore.setState({ reminders: [completedPastReminder] });

            await getState().toggleReminderCompleted('rem_past_undo');

            // Should NOT re-schedule since due date is in the past
            expect(NotificationService.scheduleReminder).not.toHaveBeenCalled();

            const { reminders } = getState();
            expect(reminders[0].completed).toBe(0);
        });

        test('should log warning if reschedule fails', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const futureDate = new Date(Date.now() + 1000 * 60 * 60).toISOString();
            useReminderStore.setState({ reminders: [{ id: 'rem_undo', due_date: futureDate, completed: 1 }] });
            NotificationService.scheduleReminder.mockRejectedValueOnce(new Error('sched err'));

            await getState().toggleReminderCompleted('rem_undo');

            expect(consoleSpy).toHaveBeenCalledWith('[ReminderStore] Failed to reschedule notification:', expect.any(Error));
            consoleSpy.mockRestore();
        });

        test('should throw error if toggle sync fails', async () => {
            useReminderStore.setState({ reminders: [{ id: 'rem_toggle', completed: 0 }] });
            require('../services/syncService').SyncService.queueAction.mockRejectedValueOnce(new Error('sync err'));

            await expect(getState().toggleReminderCompleted('rem_toggle')).rejects.toThrow('sync err');
        });
    });
});
