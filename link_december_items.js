const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const orderId = 'd2b59163-25bd-47f7-80b8-2f5f4c232abc';

async function linkData() {
    // 1. Fetch products to try and match names
    const { data: products } = await supabase.from('products').select('id, name');

    function findProd(name) {
        if (!products) return null;
        return products.find(p => p.name.toLowerCase().includes(name.toLowerCase()))?.id || null;
    }

    const items = [
        { name: 'Juego de 3 tazas de acero inoxidable', qty: 3, total: 23292 },
        { name: 'Máquina de café portátil', qty: 3, total: 21966 },
        { name: 'Cable de carga rápida USB a tipo-C giratorio 180°', qty: 3, total: 22119 },
        { name: 'Juego de 8 adaptadores', qty: 2, total: 11030 },
        { name: 'Luz de noche', qty: 10, total: 6181 }
    ];

    const payloads = items.map(it => ({
        supplier_order_id: orderId,
        product_id: findProd(it.name),
        temp_product_name: findProd(it.name) ? null : it.name,
        quantity: it.qty,
        cost_per_unit: it.total / it.qty,
        created_at: '2025-12-13T00:05:00+00:00'
    }));

    console.log('Inserting payloads:', payloads);
    const { error } = await supabase.from('supplier_order_items').insert(payloads);

    if (error) {
        console.error('Error inserting items:', error);
    } else {
        console.log('Items linked successfully!');

        // Optional: mark order as received if it wasn't? It already is 'received'.
    }
}

linkData();
