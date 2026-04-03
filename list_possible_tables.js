const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function listTables() {
    const { data: products } = await supabase.from('products').select('name').limit(1);
    console.log('Products check:', products ? 'OK' : 'Error');

    const { data: logs } = await supabase.from('activity_log').select('*').limit(1);
    console.log('activity_log check:', logs ? 'OK' : 'Error');

    const { data: logs2 } = await supabase.from('logs').select('*').limit(1);
    console.log('logs check:', logs2 ? 'OK' : 'Error');
}
listTables();
