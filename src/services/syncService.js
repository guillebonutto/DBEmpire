import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';
import { LocalDbService } from './localDbService';

export const SyncService = {
    _isSyncing: false,

    /**
     * Queues an action to be performed when online.
     * Uses SQLite (LocalDbService) as the primary queue.
     */
    queueAction: async (type, payload, metadata = {}) => {
        try {
            // Mapping table_name based on action type
            const tableMap = {
                'sale': 'sales',
                'expense': 'expenses',
                'order': 'supplier_orders',
                'client': 'clients'
            };
            
            const tableName = tableMap[type] || type;

            // 1. Save locally for immediate UI consistency (Optimistic)
            if (tableName !== 'pending_sync') {
                await LocalDbService.saveItem(tableName, payload);
                if (type === 'sale' && metadata.items) {
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

            // 2. Queue for remote sync
            await LocalDbService.queueForSync(tableName, 'INSERT', payload, metadata);
            
            console.log(`[SyncService] Queued ${type} action in SQLite.`);
            
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
                    let success = false;

                    switch (item.table_name) {
                        case 'sales':
                            success = await SyncService._processSaleSync(payload, metadata);
                            break;
                        case 'expenses':
                            success = await SyncService._processGenericSync('expenses', payload);
                            break;
                        case 'supplier_orders':
                            success = await SyncService._processGenericSync('supplier_orders', payload);
                            break;
                        case 'clients':
                            success = await SyncService._processGenericSync('clients', payload);
                            break;
                        default:
                            console.warn(`[SyncService] Unknown table: ${item.table_name}`);
                            success = true;
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
        // Insert sale
        const { data: saleData, error: saleError } = await supabase
            .from('sales')
            .insert(payload)
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

            // Update remote stock
            for (const item of metadata.items) {
                const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.id).single();
                if (prod) {
                    await supabase.from('products').update({ current_stock: prod.current_stock - item.qty }).eq('id', item.id);
                }
            }
        }
        return true;
    },

    _processGenericSync: async (tableName, payload) => {
        const { error } = await supabase.from(tableName).insert(payload);
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

