const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('--- Checking Cups ---');
    const { data: items, error: itemsError } = await supabase
        .from('supplier_order_items')
        .select('*, supplier_orders(provider_name, status)')
        .ilike('temp_product_name', '%taza%');

    if (itemsError) console.error('Error fetching items:', itemsError);
    else console.log('Found Items:', JSON.stringify(items, null, 2));

    const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .ilike('name', '%taza%');

    if (prodError) console.error('Error fetching products:', prodError);
    else console.log('Found Products:', JSON.stringify(products, null, 2));

    console.log('\n--- Checking Sales Table Columns ---');
    const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .limit(1);

    if (salesError) console.error('Error fetching sales:', salesError);
    else if (sales && sales.length > 0) console.log('Sales Columns:', Object.keys(sales[0]));
    else console.log('Sales table is empty');

    console.log('\n--- Checking Settings Table ---');
    const { data: settings, error: setError } = await supabase
        .from('settings')
        .select('*');
    if (setError) console.error('Error fetching settings:', setError);
    else console.log('Settings keys:', settings.map(s => s.key));
}

checkData();
