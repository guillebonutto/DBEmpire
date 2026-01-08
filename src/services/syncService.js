import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import NetInfo from '@react-native-community/netinfo';

const OFFLINE_SALES_KEY = '@offline_sales';

export const SyncService = {
    // 1. Queue a sale locally
    queueSale: async (salePayload, cartItems) => {
        try {
            const existing = await AsyncStorage.getItem(OFFLINE_SALES_KEY);
            const queue = existing ? JSON.parse(existing) : [];

            const offlineSale = {
                id: `offline_${Date.now()}`,
                payload: salePayload,
                items: cartItems,
                timestamp: new Date().toISOString()
            };

            queue.push(offlineSale);
            await AsyncStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(queue));
            return offlineSale.id;
        } catch (err) {
            console.error('Failed to queue offline sale:', err);
            throw err;
        }
    },

    // 2. Synchronize all pending sales
    syncPending: async () => {
        const state = await NetInfo.fetch();
        if (!state.isConnected) return;

        try {
            const existing = await AsyncStorage.getItem(OFFLINE_SALES_KEY);
            if (!existing) return;

            const queue = JSON.parse(existing);
            if (queue.length === 0) return;

            console.log(`Syncing ${queue.length} offline sales...`);

            const remaining = [];

            for (const sale of queue) {
                try {
                    // Try to push to Supabase
                    const { data: saleData, error: saleError } = await supabase
                        .from('sales')
                        .insert(sale.payload)
                        .select()
                        .single();

                    if (saleError) throw saleError;

                    const items = sale.items.map(item => ({
                        sale_id: saleData.id,
                        product_id: item.id,
                        quantity: item.qty,
                        unit_price_at_sale: item.sale_price,
                        subtotal: item.sale_price * item.qty
                    }));

                    const { error: itemsError } = await supabase.from('sale_items').insert(items);
                    if (itemsError) throw itemsError;

                    // Update stock for each item
                    for (const item of sale.items) {
                        const { data: prod } = await supabase.from('products').select('current_stock').eq('id', item.id).single();
                        const currentStock = prod?.current_stock || 0;
                        await supabase.from('products').update({ current_stock: currentStock - item.qty }).eq('id', item.id);
                    }

                } catch (err) {
                    console.error('Error syncing individual sale, keeping in queue:', err);
                    remaining.push(sale);
                }
            }

            await AsyncStorage.setItem(OFFLINE_SALES_KEY, JSON.stringify(remaining));
            return remaining.length === 0;
        } catch (err) {
            console.error('Sync process failed:', err);
        }
    }
};
