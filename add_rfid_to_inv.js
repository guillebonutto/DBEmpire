const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function addRFIDToInventory() {
    const itemData = {
        name: "Tarjeta de bloqueo RFID/NFC",
        description: "Tarjeta de seguridad para bloquear señales RFID y NFC en billeteras.",
        sale_price: 4500,
        cost_price: 1982.36,
        stock_local: 14,
        stock_cordoba: 0,
        current_stock: 14,
        provider: "Temu",
        active: true,
        variants: [
            { color: "Negro", stock: 14 }
        ]
    };

    console.log('Adding RFID cards to products (attempt 2)...');

    // 1. Insert into products
    const { data: newProd, error: prodError } = await supabase
        .from('products')
        .insert([itemData])
        .select()
        .single();

    if (prodError) {
        console.error('Error inserting product:', prodError);
        return;
    }

    console.log('✅ Product created with ID:', newProd.id);

    // 2. Link the supplier order item
    const { error: linkError } = await supabase
        .from('supplier_order_items')
        .update({ product_id: newProd.id })
        .eq('id', "72efbc24-0b56-44b4-9b1c-a29b12ad70a8");

    if (linkError) {
        console.error('Error linking supplier item:', linkError);
    } else {
        console.log('✅ Supplier order item linked successfully.');
    }
}

addRFIDToInventory();
