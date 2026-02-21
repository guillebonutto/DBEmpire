const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function checkOrders() {
    const { data: orders } = await s.from('supplier_orders').select('*').order('created_at', { ascending: false }).limit(10);
    console.log('--- RECENT ORDERS ---');
    console.log(JSON.stringify(orders, null, 2));

    const { data: items } = await s.from('supplier_order_items').select('*, supplier_orders(provider_name)').order('created_at', { ascending: false }).limit(10);
    console.log('--- RECENT ITEMS ---');
    console.log(JSON.stringify(items, null, 2));
}
checkOrders();
