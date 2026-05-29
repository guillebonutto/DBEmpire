const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    console.log("--- SECADORES EN PRODUCTOS ---");
    const { data: secadores } = await supabase.from('products').select('*').ilike('name', '%secador%');
    console.log(JSON.stringify(secadores, null, 2));

    console.log("--- SECADORES EN ORDENES ---");
    const { data: items } = await supabase.from('supplier_order_items').select('*').ilike('temp_product_name', '%secador%');
    console.log(JSON.stringify(items, null, 2));

    console.log("--- CABLES EN PRODUCTOS ---");
    const { data: cables } = await supabase.from('products').select('*').ilike('name', '%cable%');
    console.log(JSON.stringify(cables, null, 2));

    console.log("--- CABLES EN ORDENES ---");
    const { data: citems } = await supabase.from('supplier_order_items').select('*').ilike('temp_product_name', '%cable%');
    console.log(JSON.stringify(citems, null, 2));
}
check();
