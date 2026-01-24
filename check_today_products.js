
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    const today = new Date().toISOString().split('T')[0];
    console.log(`Checking for products created on or after ${today}...`);
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .gte('created_at', today);

    if (productsError) {
        console.error('Error fetching products:', productsError);
    } else {
        console.log('Products found:', products.length);
        console.log('Products:', JSON.stringify(products, null, 2));
    }
}

check();
