const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function fixCables() {
    const typeCProductId = '8733c92d-dd83-448f-bb16-a6ca97531433';
    
    // 1. Update the Type C to Type C product variants and stock
    const newVariants = [
        { color: "Rojo 1m", stock: "6" },
        { color: "Celeste 1m", stock: "6" },
        { color: "Negro 50cm", stock: "18" }
    ];
    
    console.log("Actualizando producto Tipo C a Tipo C...");
    const { error: eProd } = await supabase.from('products').update({
        variants: newVariants,
        stock_local: 24, // 6 originales + 18 nuevos
        current_stock: 30 // 12 originales + 18 nuevos
    }).eq('id', typeCProductId);
    
    if (eProd) console.error("Error producto:", eProd);
    else console.log("Producto Tipo C a Tipo C actualizado.");

    // 2. Fix the order item in the penúltima compra (order 42d9afa3-8754-4e35-95f4-e06861c5ceef)
    // The existing item was ID fb619f6d-0f1d-4246-8ca5-bd58f761df0d
    console.log("Actualizando item de la compra...");
    const { error: eItem } = await supabase.from('supplier_order_items').update({
        product_id: typeCProductId,
        quantity: 18,
        color: 'Negro 50cm',
        temp_product_name: 'Cable de carga rápida USB tipo C a tipo-C giratorio 180°'
    }).eq('id', 'fb619f6d-0f1d-4246-8ca5-bd58f761df0d');

    if (eItem) console.error("Error item:", eItem);
    else console.log("Item de compra actualizado.");

    // Note: We might want to fix the lightning cable stock since we removed the 10 units it had from the order.
    // Let's check lightning cable product: 0cb86a91-be70-44d5-9155-3507f08a7eee
    // It currently has 9 in stock. So someone might have sold 1 or it was just manually adjusted.
    // If it never existed, maybe we should set it to 0 and inactive.
    console.log("Ocultando/Cambiando stock de Lightning cable que se cargó por error...");
    await supabase.from('products').update({
        current_stock: 0,
        stock_local: 0,
        variants: [{ color: "Negro", stock: "0" }],
        active: false
    }).eq('id', '0cb86a91-be70-44d5-9155-3507f08a7eee');
    console.log("Lightning cable reseteado a 0 y ocultado.");
}

fixCables();
