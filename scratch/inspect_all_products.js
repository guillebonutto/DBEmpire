const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- TODOS LOS PRODUCTOS REGISTRADOS ---");
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name');

    if (productsError) {
        console.error("Error fetching products:", productsError);
    } else {
        products.forEach(p => {
            console.log(`ID: ${p.id} | Nombre: ${p.name} | Stock: ${p.current_stock} | Costo: ${p.cost_price || 'N/A'} | Venta: ${p.sale_price || 'N/A'}`);
        });
    }

    console.log("\n--- HISTORIAL DE COMPRAS RECIENTES (DETALLADAS) ---");
    const { data: orders, error: ordersError } = await supabase
        .from('supplier_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (ordersError) {
        console.error("Error fetching orders:", ordersError);
    } else {
        for (const order of orders) {
            console.log(`\nCompra ID: ${order.id} | Proveedor: ${order.provider_name} | Total: ${order.total_cost} | Creado: ${order.created_at} | Estado: ${order.status} | Notas: ${order.notes}`);
            const { data: items, error: itemsError } = await supabase
                .from('supplier_order_items')
                .select('*, products(name)')
                .eq('supplier_order_id', order.id);
            if (itemsError) {
                console.error("Error fetching order items:", itemsError);
            } else {
                items.forEach(it => {
                    console.log(`   - Ítem: ${it.products?.name || 'Desconocido'} (ID: ${it.product_id}) | Cantidad: ${it.quantity} | Costo unitario: ${it.unit_cost}`);
                });
            }
        }
    }
}

inspect();
