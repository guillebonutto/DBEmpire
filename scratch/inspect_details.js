const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- DETALLES ULTIMA VENTA ---");
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', '098942f8-267c-426a-b573-223577d62e05')
        .single();

    if (saleError) {
        console.error("Error fetching sale:", saleError);
    } else {
        console.log(JSON.stringify(sale, null, 2));

        // Fetch sale items
        const { data: items, error: itemsError } = await supabase
            .from('sale_items')
            .select('*, products(name)')
            .eq('sale_id', sale.id);

        if (itemsError) {
            console.error("Error fetching sale items:", itemsError);
        } else {
            console.log("Ítems de la venta:");
            items.forEach(item => {
                console.log(`- Producto: ${item.products?.name || 'Desconocido'} (ID: ${item.product_id}) | Cantidad: ${item.quantity} | Precio Unitario: ${item.unit_price}`);
            });
        }
    }

    console.log("\n--- DETALLES ULTIMA COMPRA (SUPPLIER ORDER) ---");
    const { data: purchase, error: purchaseError } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('id', '9767aa66-7cca-4473-9cc7-c324ea9cde19')
        .single();

    if (purchaseError) {
        console.error("Error fetching purchase:", purchaseError);
    } else {
        console.log(JSON.stringify(purchase, null, 2));

        // Fetch supplier order items
        const { data: orderItems, error: orderItemsError } = await supabase
            .from('supplier_order_items')
            .select('*, products(name)')
            .eq('supplier_order_id', purchase.id);

        if (orderItemsError) {
            console.error("Error fetching supplier order items:", orderItemsError);
        } else {
            console.log("Ítems de la compra:");
            orderItems.forEach(item => {
                console.log(`- Producto: ${item.products?.name || 'Desconocido'} (ID: ${item.product_id}) | Cantidad: ${item.quantity} | Costo Unitario: ${item.unit_cost}`);
            });
        }
    }
}

inspect();
