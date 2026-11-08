import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';
import { LocalDbService } from './localDbService';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const deterministicUUID = (str) => {
    let hex = '';
    for (let i = 0; i < 4; i++) {
        let v = 0;
        for (let j = 0; j < str.length; j++) {
            v = ((v << 5) - v + str.charCodeAt((j + i * 7) % str.length) + (i * 31)) | 0;
        }
        hex += (v >>> 0).toString(16).padStart(8, '0');
    }
    const part1 = hex.substring(0, 8);
    const part2 = hex.substring(8, 12);
    const part3 = '4' + hex.substring(13, 16);
    const part4 = ((parseInt(hex.substring(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.substring(17, 20);
    const part5 = hex.substring(20, 32);
    return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

export function getStableItemId(saleId, item, idx) {
    const explicitId = item.item_id || item.id_sale_item || item.sale_item_id;
    if (explicitId && typeof explicitId === 'string' && UUID_REGEX.test(explicitId)) {
        return explicitId;
    }
    if (item.id && typeof item.id === 'string' && UUID_REGEX.test(item.id)) {
        // If product_id is specified and distinct from item.id, item.id is the sale_item id
        if (item.product_id && item.product_id !== item.id) {
            return item.id;
        }
    }
    return deterministicUUID(`${saleId}_item_${idx}`);
}

export const SyncService = {
    _isSyncing: false,

    /**
     * Queues an action to be performed when online.
     * Uses SQLite (LocalDbService) as the primary queue.
     */
    queueAction: async (type, payload, metadata = {}, action = 'INSERT') => {
        try {
            // Mapping table_name based on action type
            const tableMap = {
                'sale': 'sales',
                'expense': 'expenses',
                'order': 'supplier_orders',
                'client': 'clients',
                'supplier': 'suppliers',
                'reminder': 'reminders',
                'promotion': 'promotions',
                'asset': 'assets',
                'test_product': 'test_products',
                'product': 'products',
                'shipping_package': 'shipping_packages',
                'supplier_order_item': 'supplier_order_items',
                'street_test_result': 'street_test_results'
            };

            const tableName = tableMap[type] || type;

            // 1. Save locally for immediate UI consistency (Optimistic)
            if (tableName !== 'pending_sync') {
                if (action === 'DELETE') {
                    await LocalDbService.deleteItem(tableName, payload.id);
                } else {
                    await LocalDbService.saveItem(tableName, payload);
                    if (type === 'sale' && metadata.items && action === 'INSERT') {
                        // Save items locally too if they exist with valid primary key
                        for (let idx = 0; idx < metadata.items.length; idx++) {
                            const item = metadata.items[idx];
                            const itemId = item.item_id || item.id_sale_item || `${payload.id}_${item.id || idx}_${idx}`;
                            await LocalDbService.saveItem('sale_items', {
                                id: itemId,
                                sale_id: payload.id,
                                product_id: item.id,
                                quantity: item.qty,
                                unit_price_at_sale: item.sale_price || item.unit_price || 0,
                                subtotal: (item.sale_price || item.unit_price || 0) * item.qty,
                                color: item.color || item.selectedColor || null
                            });
                        }
                    }
                }
            }

            // 2. Queue for remote sync
            await LocalDbService.queueForSync(tableName, action, payload, metadata);

            console.log(`[SyncService] Queued ${type} ${action} action in SQLite.`);

            // 3. Try to sync immediately. The queue remains durable if the
            // connectivity check itself fails, so don't leave an unhandled rejection.
            SyncService.syncPending().catch(syncError => {
                console.warn('[SyncService] Immediate sync deferred:', syncError?.message);
            });

            return payload.id;
        } catch (err) {
            console.error('[SyncService] Failed to queue action:', err);
            throw err;
        }
    },

    // Compatibility wrapper
    queueSale: (payload, items) => SyncService.queueAction('sale', payload, { items }),

    /**
     * Synchronizes all pending actions in the SQLite queue.
     */
    syncPending: async () => {
        const state = await NetInfo.fetch();
        if (!state.isConnected) return;
        if (SyncService._isSyncing) return;

        SyncService._isSyncing = true;

        try {
            const pending = await LocalDbService.getPendingSyncs();
            if (!pending || pending.length === 0) {
                SyncService._isSyncing = false;
                return;
            }

            console.log(`[SyncService] Syncing ${pending.length} actions from SQLite...`);

            for (const item of pending) {
                try {
                    const payload = JSON.parse(item.payload);
                    const metadata = JSON.parse(item.metadata);

                    // --- AUTO-FIX INVALID IDS (INSERT ONLY) ---
                    // If an INSERT payload has a non-UUID ID (e.g. legacy 'rem_...' or 'local-...'),
                    // Supabase will reject it as a UUID. We replace it with a deterministic valid UUID v4
                    // so that subsequent retries maintain stable IDs and do not duplicate rows.
                    // For UPDATE or DELETE, mutating the ID would target a nonexistent remote row.
                    if (item.action === 'INSERT' && payload && payload.id && typeof payload.id === 'string' && !UUID_REGEX.test(payload.id)) {
                        const oldId = payload.id;
                        const newId = deterministicUUID(oldId);
                        payload.id = newId;
                        console.log(`[SyncService] Auto-fixing invalid ID ${oldId} -> ${newId}`);
                    }

                    let success = false;

                    // Handle different actions
                    if (item.action === 'INSERT') {
                        switch (item.table_name) {
                            case 'sales':
                                success = await SyncService._processSaleSync(payload, metadata);
                                break;
                            default:
                                success = await SyncService._processGenericInsert(item.table_name, payload);
                                break;
                        }
                    } else if (item.action === 'UPDATE') {
                        success = await SyncService._processGenericUpdate(item.table_name, payload);
                    } else if (item.action === 'DELETE') {
                        success = await SyncService._processGenericDelete(item.table_name, payload.id);
                    }

                    if (success) {
                        await LocalDbService.removeSyncItem(item.id);
                    }
                } catch (err) {
                    console.error(`[SyncService] Error syncing item ${item.id}:`, err);
                }
            }
        } catch (err) {
            console.error('[SyncService] Global sync failure:', err);
        } finally {
            SyncService._isSyncing = false;
        }
    },

    _processSaleSync: async (payload, metadata) => {
        // Remove payment_method and joined relation fields not in Supabase schema
        const cleanPayload = { ...payload };
        delete cleanPayload.payment_method;
        delete cleanPayload.clients;
        delete cleanPayload.profiles;
        delete cleanPayload.sale_items;

        // Prepare line items with stable, deterministic UUIDs for idempotency
        let preparedItems = [];
        if (metadata && Array.isArray(metadata.items) && metadata.items.length > 0) {
            preparedItems = metadata.items.map((item, idx) => {
                const stableId = getStableItemId(cleanPayload.id, item, idx);
                return {
                    id: String(stableId),
                    sale_id: String(cleanPayload.id),
                    product_id: String(item.product_id || item.id),
                    quantity: parseInt(item.qty || item.quantity) || 1,
                    unit_price_at_sale: Number(item.sale_price || item.unit_price || 0),
                    subtotal: Number(item.sale_price || item.unit_price || 0) * (parseInt(item.qty || item.quantity) || 1),
                    color: item.color || item.selectedColor || null
                };
            });
        }

        // Call transactional atomic RPC in Supabase
        const { data, error } = await supabase.rpc('process_sale_atomic', {
            p_sale: cleanPayload,
            p_items: preparedItems,
            p_location: cleanPayload.sale_location || 'local',
            p_allow_oversell: false
        });

        if (error) {
            const errorMsg = error.message || error.code || 'RPC process_sale_atomic failed';
            console.error("[SyncService] RPC process_sale_atomic failed for sale " + cleanPayload.id + ":", errorMsg);
            const err = new Error(errorMsg);
            err.code = error.code;
            err.details = error;
            err.isRpcError = true;
            throw err;
        }

        if (!data || !data.success) {
            const errorMsg = [data?.error, data?.message].filter(Boolean).join(': ') || 'Unknown error in process_sale_atomic';
            console.error(`[SyncService] Transaction rejected in process_sale_atomic for sale ${cleanPayload.id}:`, errorMsg);
            throw new Error(`RPC_TRANSACTION_FAILED: ${errorMsg}`);
        }

        return true;
    },

    _processGenericInsert: async (tableName, payload) => {
        const dataToInsert = { ...payload };
        if (tableName === 'supplier_orders') {
            delete dataToInsert.total_amount;
        }
        if (tableName === 'products') {
            delete dataToInsert.variants_json;
            if (typeof dataToInsert.variants === 'string') {
                try { dataToInsert.variants = JSON.parse(dataToInsert.variants); } catch (_) {}
            }
        }
        if (tableName === 'reminders') {
            const allowedCols = ['id', 'title', 'notes', 'due_date', 'completed', 'notification_id'];
            Object.keys(dataToInsert).forEach(col => {
                if (!allowedCols.includes(col)) delete dataToInsert[col];
            });
            if (dataToInsert.completed !== undefined) {
                dataToInsert.completed = (dataToInsert.completed === 1 || dataToInsert.completed === true || dataToInsert.completed === '1') ? 1 : 0;
            }
            // Use upsert to handle retries cleanly
            const { error } = await supabase.from(tableName).upsert(dataToInsert);
            if (error) throw error;
            return true;
        }
        const { error } = await supabase.from(tableName).insert(dataToInsert);
        if (error) throw error;
        return true;
    },

    _processGenericUpdate: async (tableName, payload) => {
        const { id, ...updateData } = payload;
        if (tableName === 'supplier_orders') {
            delete updateData.total_amount;
        }
        if (tableName === 'sales') {
            delete updateData.clients;
            delete updateData.profiles;
            delete updateData.sale_items;
            delete updateData.payment_method;
        }
        if (tableName === 'products') {
            delete updateData.variants_json;
            if (typeof updateData.variants === 'string') {
                try { updateData.variants = JSON.parse(updateData.variants); } catch (_) {}
            }
        }
        if (tableName === 'reminders') {
            const allowedCols = ['title', 'notes', 'due_date', 'completed', 'notification_id'];
            Object.keys(updateData).forEach(col => {
                if (!allowedCols.includes(col)) delete updateData[col];
            });
            if (updateData.completed !== undefined) {
                updateData.completed = (updateData.completed === 1 || updateData.completed === true || updateData.completed === '1') ? 1 : 0;
            }
        }
        const { error } = await supabase.from(tableName).update(updateData).eq('id', id);
        if (error) throw error;
        return true;
    },

    _processGenericDelete: async (tableName, id) => {
        const { error } = await supabase.from(tableName).delete().eq('id', id);
        if (error) throw error;
        return true;
    },

    getQueueCount: async () => {
        const pending = await LocalDbService.getPendingSyncs();
        return pending.length;
    }
};

// Auto-sync listener
NetInfo.addEventListener(state => {
    if (state.isConnected) {
        SyncService.syncPending();
    }
});
