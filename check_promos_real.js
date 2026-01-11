const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkData() {
    console.log('--- PROMOTIONS ---');
    const { data: promos, error: pError } = await supabase
        .from('promotions')
        .select(`
            *,
            promotion_products (
                product_id
            )
        `);
    if (pError) console.error(pError);
    else console.log(JSON.stringify(promos, null, 2));

    console.log('\n--- PROMOTION_PRODUCTS ---');
    const { data: links, error: lError } = await supabase
        .from('promotion_products')
        .select('*');
    if (lError) console.error(lError);
    else console.log(JSON.stringify(links, null, 2));
}

checkData();
