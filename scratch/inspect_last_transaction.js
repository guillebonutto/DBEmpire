const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- ULTIMAS VENTAS ---");
    const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (salesError) {
        console.error("Error fetching sales:", salesError);
    } else {
        sales.forEach(sale => {
            console.log(`ID: ${sale.id} | Fecha: ${sale.created_at} | Cliente: ${sale.customer_name || sale.client_name || 'Sin nombre'} | Total: ${sale.total_amount}`);
        });
    }

    console.log("\n--- ULTIMAS COMPRAS / PEDIDOS A PROVEEDORES ---");
    const { data: purchases, error: purchasesError } = await supabase
        .from('supplier_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (purchasesError) {
        console.error("Error fetching supplier orders:", purchasesError);
    } else {
        purchases.forEach(order => {
            console.log(`ID: ${order.id} | Fecha: ${order.created_at} | Proveedor: ${order.supplier_name || 'Sin proveedor'} | Total: ${order.total_amount || order.total_cost || 'N/A'}`);
        });
    }
}

inspect();
