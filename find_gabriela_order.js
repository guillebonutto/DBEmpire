
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    console.log('Searching for order from Gabriela Castelli...');
    const { data: orders, error: orderError } = await supabase
        .from('supplier_orders')
        .select('*')
        .ilike('provider_name', '%Gabriela Castelli%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (orderError) {
        console.error('Error fetching order:', orderError);
        return;
    }

    if (!orders || orders.length === 0) {
        console.log('No orders found for Gabriela Castelli.');
        return;
    }

    const lastOrder = orders[0];
    console.log('Order:', JSON.stringify(lastOrder, null, 2));

    console.log('Fetching items for this order...');
    const { data: items, error: itemsError } = await supabase
        .from('supplier_order_items')
        .select('*')
        .eq('supplier_order_id', lastOrder.id);

    if (itemsError) {
        console.error('Error fetching items:', itemsError);
    } else {
        console.log('Items:', JSON.stringify(items, null, 2));
    }
}

check();
