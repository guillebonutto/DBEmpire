import { create } from 'zustand';
import { LocalDbService } from '../services/localDbService';
import { NotificationService } from '../services/notificationService';

export const useReminderStore = create((set, get) => ({
    reminders: [],
    loadingReminders: false,
    isInitialized: false,

    initStore: async () => {
        if (get().isInitialized) return;
        set({ loadingReminders: true });
        try {
            const cached = await LocalDbService.getAll('reminders');
            if (cached) {
                // Sort by due_date ascending
                const sorted = cached.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                set({ reminders: sorted, isInitialized: true });
            }
        } catch (err) {
            console.error('[ReminderStore] Init error:', err);
        } finally {
            set({ loadingReminders: false });
        }
    },

    fetchReminders: async () => {
        set({ loadingReminders: true });
        try {
            const cached = await LocalDbService.getAll('reminders');
            if (cached) {
                const sorted = cached.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                set({ reminders: sorted });
            }
        } catch (err) {
            console.error('[ReminderStore] Fetch error:', err);
        } finally {
            set({ loadingReminders: false });
        }
    },

    addReminder: async (title, notes, dueDate) => {
        const id = 'rem_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        
        const newReminder = {
            id,
            title: title.trim(),
            notes: (notes || '').trim(),
            due_date: dueDate,
            completed: 0,
            notification_id: ''
        };

        // Update local state immediately for a snappy UI
        set((state) => {
            const newList = [...state.reminders, newReminder].sort(
                (a, b) => new Date(a.due_date) - new Date(b.due_date)
            );
            return { reminders: newList };
        });

        // Save to DB and schedule notification asynchronously
        (async () => {
            try {
                await LocalDbService.saveItem('reminders', newReminder);
                
                let notificationId = null;
                try {
                    notificationId = await NotificationService.scheduleReminder(id, title, notes, dueDate);
                } catch (e) {
                    console.warn('[ReminderStore] Notification scheduling failed:', e);
                }

                if (notificationId) {
                    const updatedReminder = { ...newReminder, notification_id: notificationId };
                    await LocalDbService.saveItem('reminders', updatedReminder);
                    set((state) => ({
                        reminders: state.reminders.map(r => r.id === id ? updatedReminder : r)
                    }));
                }
            } catch (err) {
                console.error('[ReminderStore] Async save/schedule error:', err);
            }
        })();

        return newReminder;
    },

    deleteReminder: async (id) => {
        const item = get().reminders.find(r => r.id === id);
        if (!item) return;

        // Cancel notification if active
        if (item.notification_id) {
            try {
                await NotificationService.cancelReminder(item.notification_id);
            } catch (e) {
                console.warn('[ReminderStore] Error canceling notification on delete:', e);
            }
        }

        try {
            await LocalDbService.deleteItem('reminders', id);
            set((state) => ({
                reminders: state.reminders.filter(r => r.id !== id)
            }));
        } catch (err) {
            console.error('[ReminderStore] Error deleting reminder:', err);
            throw err;
        }
    },

    toggleReminderCompleted: async (id) => {
        const item = get().reminders.find(r => r.id === id);
        if (!item) return;

        const nextCompleted = item.completed === 1 ? 0 : 1;
        let nextNotificationId = item.notification_id;

        if (nextCompleted === 1) {
            // Cancel notification if marked completed
            if (item.notification_id) {
                await NotificationService.cancelReminder(item.notification_id);
                nextNotificationId = '';
            }
        } else {
            // Re-schedule notification if marked incomplete and is in the future
            if (new Date(item.due_date).getTime() > Date.now()) {
                try {
                    nextNotificationId = await NotificationService.scheduleReminder(
                        item.id,
                        item.title,
                        item.notes,
                        item.due_date
                    );
                } catch (e) {
                    console.warn('[ReminderStore] Failed to reschedule notification:', e);
                }
            }
        }

        const updatedReminder = {
            ...item,
            completed: nextCompleted,
            notification_id: nextNotificationId || ''
        };

        try {
            await LocalDbService.saveItem('reminders', updatedReminder);
            set((state) => ({
                reminders: state.reminders.map(r => r.id === id ? updatedReminder : r)
            }));
        } catch (err) {
            console.error('[ReminderStore] Error toggling completed status:', err);
            throw err;
        }
    }
}));
