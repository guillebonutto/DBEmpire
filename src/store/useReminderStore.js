import { create } from 'zustand';
import { supabase } from '../services/supabase';
import { LocalDbService } from '../services/localDbService';
import { NotificationService } from '../services/notificationService';
import { SyncService } from '../services/syncService';

export const useReminderStore = create((set, get) => ({
    reminders: [],
    loadingReminders: false,
    isInitialized: false,

    initStore: async () => {
        if (get().isInitialized) return;
        set({ loadingReminders: true });
        try {
            const cached = await LocalDbService.getAll('reminders');
            if (cached && cached.length > 0) {
                // Sort by due_date ascending
                const sorted = cached.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                set({ reminders: sorted, isInitialized: true });
            }
            // Trigger fresh background fetch from Supabase
            get().fetchReminders().catch(() => {});
        } catch (err) {
            console.error('[ReminderStore] Init error:', err);
        } finally {
            set({ loadingReminders: false });
        }
    },

    fetchReminders: async () => {
        set({ loadingReminders: true });
        try {
            // 1. Fetch fresh data from Supabase
            const { data, error } = await supabase
                .from('reminders')
                .select('*')
                .order('due_date', { ascending: true });

            if (!error && data) {
                // 2. Preserve any local pending syncs not yet in Supabase
                let merged = [...data];
                try {
                    const pending = await LocalDbService.getPendingSyncs();
                    const pendingReminders = (pending || []).filter(p => p.table_name === 'reminders');
                    for (const pr of pendingReminders) {
                        try {
                            const pPayload = JSON.parse(pr.payload);
                            if (pr.action === 'INSERT' && !merged.some(m => m.id === pPayload.id)) {
                                merged.push(pPayload);
                            } else if (pr.action === 'DELETE') {
                                merged = merged.filter(m => m.id !== pPayload.id);
                            } else if (pr.action === 'UPDATE') {
                                merged = merged.map(m => m.id === pPayload.id ? { ...m, ...pPayload } : m);
                            }
                        } catch (_) {}
                    }
                } catch (_) {}

                const sorted = merged.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                set({ reminders: sorted, isInitialized: true });
                await LocalDbService.replaceFullTable('reminders', sorted);
            } else {
                // Fallback to local SQLite if Supabase returns error / offline
                const cached = await LocalDbService.getAll('reminders');
                if (cached) {
                    const sorted = cached.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                    set({ reminders: sorted, isInitialized: true });
                }
            }
        } catch (err) {
            console.error('[ReminderStore] Fetch error:', err);
            const cached = await LocalDbService.getAll('reminders');
            if (cached) {
                const sorted = cached.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
                set({ reminders: sorted, isInitialized: true });
            }
        } finally {
            set({ loadingReminders: false });
        }
    },

    addReminder: async (title, notes, dueDate) => {
        const generateUUID = () => {
            return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            });
        };
        const id = generateUUID();
        
        const rawNotes = typeof notes === 'object' && notes !== null
            ? JSON.stringify(notes)
            : (notes || '').trim();

        const notifNotes = typeof notes === 'object' && notes !== null
            ? (notes.stage || notes.text || '')
            : rawNotes;

        const newReminder = {
            id,
            title: title.trim(),
            notes: rawNotes,
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

        let notificationId = null;
        try {
            notificationId = await NotificationService.scheduleReminder(id, title, notifNotes, dueDate);
        } catch (e) {
            console.warn('[ReminderStore] Notification scheduling failed:', e);
        }

        const reminderToSave = notificationId 
            ? { ...newReminder, notification_id: notificationId }
            : newReminder;

        try {
            await SyncService.queueAction('reminder', reminderToSave, {}, 'INSERT');
            
            if (notificationId) {
                set((state) => ({
                    reminders: state.reminders.map(r => r.id === id ? reminderToSave : r)
                }));
            }
            return reminderToSave;
        } catch (err) {
            console.error('[ReminderStore] Error saving reminder:', err);
            // Cancel notification if DB save failed
            if (notificationId) {
                try {
                    await NotificationService.cancelReminder(notificationId);
                } catch (e) {
                    console.warn('[ReminderStore] Error canceling notification on failure:', e);
                }
            }
            // Remove from local state since save failed
            set((state) => ({
                reminders: state.reminders.filter(r => r.id !== id)
            }));
            throw err;
        }
    },

    updateReminder: async (id, title, notes, dueDate) => {
        const item = get().reminders.find(r => r.id === id);
        if (!item) return;

        const rawNotes = typeof notes === 'object' && notes !== null
            ? JSON.stringify(notes)
            : (notes || '').trim();

        const notifNotes = typeof notes === 'object' && notes !== null
            ? (notes.stage || notes.text || '')
            : rawNotes;

        let notificationId = item.notification_id;

        // If date changed or title/notes changed and it's active, reschedule
        if (item.completed === 0 && new Date(dueDate).getTime() > Date.now()) {
            if (notificationId) {
                try {
                    await NotificationService.cancelReminder(notificationId);
                } catch (e) {
                    console.warn('[ReminderStore] Error canceling old notification on update:', e);
                }
            }
            try {
                notificationId = await NotificationService.scheduleReminder(
                    id,
                    title.trim(),
                    notifNotes,
                    dueDate
                );
            } catch (e) {
                console.warn('[ReminderStore] Notification rescheduling failed:', e);
                notificationId = '';
            }
        }

        const updatedReminder = {
            ...item,
            title: title.trim(),
            notes: rawNotes,
            due_date: dueDate,
            notification_id: notificationId
        };

        try {
            await SyncService.queueAction('reminder', updatedReminder, {}, 'INSERT');
            set((state) => ({
                reminders: state.reminders.map(r => r.id === id ? updatedReminder : r)
            }));
            return updatedReminder;
        } catch (err) {
            console.error('[ReminderStore] Error updating reminder:', err);
            throw err;
        }
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
            await SyncService.queueAction('reminder', { id }, {}, 'DELETE');
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
            await SyncService.queueAction('reminder', updatedReminder, {}, 'INSERT');
            set((state) => ({
                reminders: state.reminders.map(r => r.id === id ? updatedReminder : r)
            }));
        } catch (err) {
            console.error('[ReminderStore] Error toggling completed status:', err);
            throw err;
        }
    }
}));
