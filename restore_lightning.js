const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

// Cable tipo C a Lightning: 0cb86a91-be70-44d5-9155-3507f08a7eee
// El order item correspondiente: fb619f6d-0f1d-4246-8ca5-bd58f761df0d
// Orden: 42d9afa3-8754-4e35-95f4-e06861c5ceef (Gabriela AliExpress)

async function fix() {
    // 1. Restaurar el producto Cable tipo C a Lightning (que yo eliminé por error)
    console.log("Restaurando cable tipo C a Lightning...");
    const { error: e1 } = await supabase.from('products').update({
        active: true,
        current_stock: 10,
        stock_local: 10,
        stock_cordoba: 0,
        variants: [{ color: "Negro", stock: "10" }]
    }).eq('id', '0cb86a91-be70-44d5-9155-3507f08a7eee');
    console.log(e1 ? "ERROR: " + e1.message : "Cable Lightning restaurado OK");

    // 2. Restaurar el order item de la compra de AliExpress al producto correcto (Lightning)
    // Este item fue reasignado al tipo C por error, hay que volver al lightning
    console.log("Restaurando item de la compra de Gabriela AliExpress...");
    const { error: e2 } = await supabase.from('supplier_order_items').update({
        product_id: '0cb86a91-be70-44d5-9155-3507f08a7eee',
        quantity: 10,
        cost_per_unit: 8166.25,
        color: 'Negro',
        temp_product_name: 'Cable de carga rápida USB tipo C a lightning giratorio 180°'
    }).eq('id', 'fb619f6d-0f1d-4246-8ca5-bd58f761df0d');
    console.log(e2 ? "ERROR: " + e2.message : "Item de compra restaurado OK");

    // 3. Verificar el estado final de ambos cables
    console.log("\n--- ESTADO FINAL DE CABLES ---");
    const { data: cables } = await supabase.from('products').select('id, name, stock_local, stock_cordoba, current_stock, variants, active').ilike('name', '%cable%');
    cables.forEach(c => {
        console.log(`[${c.active ? 'ACTIVO' : 'INACTIVO'}] ${c.name}`);
        console.log(`  Stock: ${c.current_stock} (Jujuy: ${c.stock_local} | Cba: ${c.stock_cordoba})`);
        console.log(`  Variantes: ${JSON.stringify(c.variants)}`);
    });
}

fix();
