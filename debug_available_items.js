const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking availableItems query result ---');
    const { data, error } = await supabase
        .from('supplier_order_items')
        .select(`
            id,
            quantity,
            temp_product_name,
            product_id,
            products(name, current_stock, stock_local, stock_cordoba),
            supplier_orders!inner(id, provider_name, status)
        `)
        .eq('supplier_orders.status', 'received')
        .is('shipping_package_id', null);

    if (error) {
        console.error('Error:', error);
    } else {
        console.log('Available Items:', JSON.stringify(data, null, 2));
    }
}

checkData();
