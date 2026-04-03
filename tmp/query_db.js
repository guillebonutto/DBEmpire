const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log('--- BUSCANDO PERFILES ---');
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) console.error('Error p:', pError);
    else console.log('Perfiles:', JSON.stringify(profiles, null, 2));

    console.log('\n--- BUSCANDO VENTAS DE HOY (2026-03-31) ---');
    const today = '2026-03-31';
    const { data: sales, error: sError } = await supabase
        .from('sales')
        .select('*, sale_items(*)')
        .gte('created_at', today + 'T00:00:00Z')
        .lte('created_at', today + 'T23:59:59Z')
        .order('created_at', { ascending: false });
    
    if (sError) console.error('Error s:', sError);
    else console.log('Ventas:', JSON.stringify(sales, null, 2));
}

run();
