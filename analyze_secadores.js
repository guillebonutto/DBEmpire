const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function analyze() {
    console.log("--- BUSCANDO ORDEN DE SECADORES ---");
    console.log("--- BUSCANDO ITEMS DE SECADORES ---");
    const { data: items } = await supabase.from('supplier_order_items').select('*').limit(1000);
    const secadorItems = items.filter(i => 
        i.temp_product_name?.toLowerCase().includes('secador') || 
        i.product_id?.toLowerCase().includes('secador')
    );
    console.log("Items encontrados:", JSON.stringify(secadorItems, null, 2));

    if (secadorItems.length > 0) {
        const orderIds = [...new Set(secadorItems.map(i => i.supplier_order_id))];
        const { data: orders } = await supabase.from('supplier_orders').select('*').in('id', orderIds);
        console.log("Órdenes relacionadas:", JSON.stringify(orders, null, 2));

        for (let o of orders) {
            console.log(`\n--- BUSCANDO GASTOS PARA ORDEN ${o.id} ---`);
            const { data: expenses } = await supabase.from('expenses').select('*').limit(1000);
            const relatedExpenses = expenses.filter(e => 
                e.description?.includes(o.id) || 
                e.details?.includes(o.id) || 
                e.amount === 55000 || 
                e.amount === 50000 ||
                e.description?.toLowerCase().includes('secador') ||
                e.description?.toLowerCase().includes('cuota')
            );
            console.log("Gastos relacionados:", JSON.stringify(relatedExpenses, null, 2));
        }
    } else {
        // Just search orders by amount without limit just in case
        const { data: allOrders } = await supabase.from('supplier_orders').select('*');
        const exactAmountOrders = allOrders.filter(o => o.total_amount === 330000 || o.total_amount === 300000);
        console.log("Órdenes por monto exacto 330000 o 300000:", JSON.stringify(exactAmountOrders, null, 2));
    }

}

analyze();
