const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkAdaptadores() {
    // Buscamos el producto "Adaptadores"
    const { data: prod } = await supabase
        .from('products')
        .select('id, name, variants')
        .eq('name', 'Adaptadores')
        .single();

    if (!prod) {
        console.log('No encontré el producto "Adaptadores".');
        return;
    }

    console.log(`Producto: ${prod.name}`);
    console.log(`Variantes configuradas:`, prod.variants);

    // Sumamos sus ventas en negro
    const { data: sales } = await supabase
        .from('sale_items')
        .select('quantity, color')
        .eq('product_id', prod.id)
        .ilike('color', '%negro%');

    const total = sales?.reduce((acc, curr) => acc + curr.quantity, 0) || 0;
    console.log(`\nCANTIDAD VENDIDA EN NEGRO: ${total}`);
}

checkAdaptadores();
