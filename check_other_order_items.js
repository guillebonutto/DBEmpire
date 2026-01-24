
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const orderId = 'd2b59163-25bd-47f7-80b8-2f5f4c232abc';
    console.log(`Checking items for order ${orderId}...`);
    const { data: items, error: itemsError } = await supabase
        .from('supplier_order_items')
        .select('*')
        .eq('supplier_order_id', orderId);

    if (itemsError) {
        console.error('Error fetching items:', itemsError);
    } else {
        console.log('Items found:', items.length);
        console.log('Items:', JSON.stringify(items, null, 2));
    }
}

check();
