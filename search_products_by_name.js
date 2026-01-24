
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const names = [
    "Powerbank portátil 2 interfaces de salida (blanco)",
    "Cable de carga rápida USB a tipo-C giratorio 180° rojo",
    "Cable de carga rápida USB a tipo-C giratorio 180° (celeste agua)",
    "Powerbank portátil 2 interfaces de salida (negro)",
    "Powerbank portátil 2 interfaces de salida (rosa)"
];

async function check() {
    console.log('Searching for products by name...');
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('name', names);

    if (productsError) {
        console.error('Error searching products:', productsError);
    } else {
        console.log('Products found:', products.length);
        console.log('Products:', JSON.stringify(products, null, 2));
    }
}

check();
