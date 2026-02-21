const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findRFIDItems() {
    console.log('Searching for RFID/NFC items in supplier orders...');

    const { data: orders, error } = await supabase
        .from('supplier_order_items')
        .select('*, supplier_orders(provider_name, items_description)')
        .or('temp_product_name.ilike.%rfid%,temp_product_name.ilike.%nfc%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (orders.length === 0) {
        // Try searching in the order description if items don't have it
        const { data: ordersByDesc, error: descError } = await supabase
            .from('supplier_orders')
            .select('*, supplier_order_items(*)')
            .or('items_description.ilike.%rfid%,items_description.ilike.%nfc%');

        if (descError) {
            console.error('Error searching by description:', descError);
            return;
        }

        console.log('Found in order descriptions:', JSON.stringify(ordersByDesc, null, 2));
    } else {
        console.log('Found in items:', JSON.stringify(orders, null, 2));
    }
}

findRFIDItems();
