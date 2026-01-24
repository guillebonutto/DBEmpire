
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    console.log('Listing last 10 supplier orders...');
    const { data: orders, error: orderError } = await supabase
        .from('supplier_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (orderError) {
        console.error('Error fetching orders:', orderError);
        return;
    }

    console.log('Orders:', JSON.stringify(orders, null, 2));
}

check();
