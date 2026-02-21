const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function debugCable() {
    console.log('--- BUSCANDO PRODUCTO ---');
    const { data: prods } = await s.from('products').select('*').ilike('name', '%giratorio%');
    console.log('Productos encontrados:', JSON.stringify(prods, null, 2));

    console.log('--- BUSCANDO ITEMS DE COMPRA ---');
    const { data: items } = await s.from('supplier_order_items').select('*, supplier_orders(status, provider_name)').ilike('temp_product_name', '%giratorio%');
    console.log('Items de compra encontrados:', JSON.stringify(items, null, 2));

    if (prods && prods.length > 0) {
        const prodId = prods[0].id;
        console.log(`--- BUSCANDO ITEMS VINCULADOS AL ID ${prodId} ---`);
        const { data: linkedItems } = await s.from('supplier_order_items').select('*, supplier_orders(status, provider_name)').eq('product_id', prodId);
        console.log('Items vinculados encontrados:', JSON.stringify(linkedItems, null, 2));
    }
}
debugCable();
