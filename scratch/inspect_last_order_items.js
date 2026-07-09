const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- ITEMS DE LA COMPRA DE SECADORES (9767aa66-7cca-4473-9cc7-c324ea9cde19) ---");
    const { data: items, error } = await supabase
        .from('supplier_order_items')
        .select('*, products(name)')
        .eq('supplier_order_id', '9767aa66-7cca-4473-9cc7-c324ea9cde19');

    if (error) {
        console.error(error);
    } else {
        console.log(items);
    }
}

inspect();
