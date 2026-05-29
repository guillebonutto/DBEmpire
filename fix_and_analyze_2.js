const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function fixAndAnalyze() {
    console.log("--- CORRIGIENDO SECADORES ---");
    const { error: e1 } = await supabase.from('products').update({
        cost_price: 10000,
        sale_price_cordoba: 0
    }).eq('id', 'b0679350-cd60-466d-acb8-b64261398ae6');
    console.log("Secadores actualizados:", e1 ? e1 : "OK");

    console.log("--- BUSCANDO CABLES EN ORDENES RECIENTES ---");
    const { data: orders } = await supabase.from('supplier_orders').select('*').order('created_at', { ascending: false }).limit(10);
    
    for (let o of orders) {
        const { data: items } = await supabase.from('supplier_order_items').select('*').eq('supplier_order_id', o.id);
        const cableItems = items.filter(i => i.temp_product_name?.toLowerCase().includes('cable'));
        if (cableItems.length > 0) {
            console.log(`Orden ${o.id} (${o.created_at}) [${o.provider_name}]:`);
            console.log(JSON.stringify(cableItems, null, 2));
        }
    }
}
fixAndAnalyze();
