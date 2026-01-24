
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking for orders marked as received on or after ${today}...`);
    // Note: There is no 'received_at' field, but we can check 'updated_at' if it exists, 
    // or just look for 'received' status orders and check their items.
    const { data: orders, error: orderError } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('status', 'received');

    if (orderError) {
        console.error('Error fetching orders:', orderError);
    } else {
        console.log('Received orders found:', orders.length);
        console.log('Orders:', JSON.stringify(orders, null, 2));
    }
}

check();
