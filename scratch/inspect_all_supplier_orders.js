const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- HISTORIAL DE TODAS LAS COMPRAS (SUPPLIER ORDERS) ---");
    const { data: orders, error: ordersError } = await supabase
        .from('supplier_orders')
        .select('*')
        .order('created_at', { ascending: false });

    if (ordersError) {
        console.error("Error fetching orders:", ordersError);
        return;
    }

    for (const order of orders) {
        console.log(`\nID: ${order.id} | Proveedor: ${order.provider_name} | Total: ${order.total_cost || order.total_amount} | Fecha: ${order.created_at} | Notas: ${order.notes}`);
        const { data: items, error: itemsError } = await supabase
            .from('supplier_order_items')
            .select('*, products(name)')
            .eq('supplier_order_id', order.id);
        if (itemsError) {
            console.error("Error fetching items:", itemsError);
        } else {
            items.forEach(it => {
                console.log(`   - Ítem: ${it.products?.name || 'Desconocido'} (ID: ${it.product_id}) | Cantidad: ${it.quantity} | Costo unitario: ${it.unit_cost}`);
            });
        }
    }
}

inspect();
