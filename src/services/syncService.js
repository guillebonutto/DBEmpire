import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';
import { LocalDbService } from './localDbService';

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
                        // Save items locally too if they exist
                        for (const item of metadata.items) {
                            await LocalDbService.saveItem('sale_items', {
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
            
            // 3. Try to sync immediately
            SyncService.syncPending();
            
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
                    
                    // --- AUTO-FIX INVALID IDS ---
                    // If the payload has a non-UUID ID (e.g. legacy 'rem_...' or 'local-...'),
                    // Supabase will reject it as a UUID. We replace it with a valid UUID v4 on the fly.
                    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                    if (payload && payload.id && typeof payload.id === 'string' && !uuidRegex.test(payload.id)) {
                        const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                            const r = Math.random() * 16 | 0;
                            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
                        });
                        const oldId = payload.id;
                        const newId = generateUUID();
                        payload.id = newId;
                        console.log(`[SyncService] Auto-fixing invalid ID ${oldId} -> ${newId}`);
                        
                        // If it's a sale, we might need to fix it in metadata too, though usually processed in _processSaleSync
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
        // Remove payment_method since it only exists in local SQLite, not in Supabase schema
        const cleanPayload = { ...payload };
        delete cleanPayload.payment_method;

        // Insert sale
        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert(cleanPayload)
            .select()
            .single();

        if (saleError) throw saleError;

        // Insert items
        if (metadata.items && metadata.items.length > 0) {
            const items = metadata.items.map(item => ({
                sale_id: saleData.id,
                product_id: item.id,
                quantity: item.qty,
                unit_price_at_sale: item.sale_price || item.unit_price || 0,
                subtotal: (item.sale_price || item.unit_price || 0) * item.qty,
                color: item.color || item.selectedColor || null
            }));

            const { error: itemsError } = await supabase.from('sale_items').insert(items);
            if (itemsError) throw itemsError;

            // --- ROBUST REMOTE STOCK DEDUCTION ---
            for (const item of metadata.items) {
                // Fetch fresh product data from Supabase
                const { data: prod, error: fetchErr } = await supabase
                    .from('products')
                    .select('stock_local, stock_cordoba, current_stock, variants')
                    .eq('id', item.id)
                    .single();
                
                if (!fetchErr && prod) {
                    const updatePayload = {};
                    const qty = parseInt(item.qty) || 0;

                    // 1. Location based deduction
                    if (payload.sale_location === 'cordoba') {
                        updatePayload.stock_cordoba = Math.max(0, (prod.stock_cordoba || 0) - qty);
                        updatePayload.stock_local = prod.stock_local || 0;
                    } else {
                        updatePayload.stock_local = Math.max(0, (prod.stock_local || 0) - qty);
                        updatePayload.stock_cordoba = prod.stock_cordoba || 0;
                    }

                    // Recalculate total
                    updatePayload.current_stock = updatePayload.stock_local + updatePayload.stock_cordoba;

                    // 2. Variants deduction
                    if (item.color && prod.variants) {
                        let variants = [];
                        try {
                            variants = Array.isArray(prod.variants)
                                ? prod.variants
                                : (typeof prod.variants === 'string' ? JSON.parse(prod.variants) : []);
                        } catch (e) {
                            console.log('Error parsing prod.variants in syncService:', e);
                        }

                        if (Array.isArray(variants)) {
                            const cleanColor = item.color.trim().toLowerCase();
                            const vIdx = variants.findIndex(v => v.color?.trim().toLowerCase() === cleanColor);
                            if (vIdx >= 0) {
                                const currentVarStock = parseInt(variants[vIdx].stock) || 0;
                                variants[vIdx].stock = Math.max(0, currentVarStock - qty).toString();
                                updatePayload.variants = variants;
                            }
                        }
                    }

                    // Perform update in Supabase
                    await supabase.from('products').update(updatePayload).eq('id', item.id);
                }
            }
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
