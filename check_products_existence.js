
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const productIds = [
    '4d3f9434-8061-4323-82e9-dc9e1d5a2c69',
    'a75d4040-65ae-4942-8da5-193190b03099',
    'a2a6262f-770d-48ed-89b8-5992cddc6c77',
    'cc260c6e-8e98-422d-8a90-920398994298',
    'b312d52b-ec02-4a94-a3e6-dcbca64b7486'
];

async function check() {
    console.log('Checking products...');
    const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, name')
        .in('id', productIds);

    if (productsError) {
        console.error('Error fetching products:', productsError);
    } else {
        console.log('Products found:', products.length);
        console.log('Products:', JSON.stringify(products, null, 2));

        const foundIds = products.map(p => p.id);
        const missingIds = productIds.filter(id => !foundIds.includes(id));
        console.log('Missing IDs:', missingIds);
    }
}

check();
