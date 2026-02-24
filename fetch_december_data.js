const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchData() {
    console.log('--- EXPENSES (Dec 11-14) ---');
    const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .gte('created_at', '2025-12-11')
        .lte('created_at', '2025-12-14');
    console.log(JSON.stringify(expenses, null, 2));

    console.log('\n--- SUPPLIER ORDERS (Dec 11-14) ---');
    const { data: orders } = await supabase
        .from('supplier_orders')
        .select('*')
        .gte('created_at', '2025-12-11')
        .lte('created_at', '2025-12-14');
    console.log(JSON.stringify(orders, null, 2));
}

fetchData();
