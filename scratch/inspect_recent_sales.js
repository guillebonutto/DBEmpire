const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- VENTAS DESDE EL 1 DE JUNIO DE 2026 ---");
    const { data: sales, error: salesError } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', '2026-06-01T00:00:00Z')
        .order('created_at', { ascending: false });

    if (salesError) {
        console.error("Error fetching sales:", salesError);
        return;
    }

    console.log(`Total ventas encontradas en junio: ${sales.length}`);
    for (const sale of sales) {
        console.log(`\nVenta ID: ${sale.id} | Fecha: ${sale.created_at} | Total: ${sale.total_amount}`);
        const { data: items, error: itemsError } = await supabase
            .from('sale_items')
            .select('*, products(name)')
            .eq('sale_id', sale.id);
        if (itemsError) {
            console.error("Error fetching items:", itemsError);
        } else {
            items.forEach(it => {
                console.log(`   - Producto: ${it.products?.name} (ID: ${it.product_id}) | Cantidad: ${it.quantity} | Total: ${it.subtotal || it.unit_price * it.quantity}`);
            });
        }
    }
}

inspect();
