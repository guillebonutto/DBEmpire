const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log('Fetching expenses from DB...');
    const { data: expenses, error } = await supabase.from('expenses').select('amount, description, created_at, category').order('created_at', { ascending: false });
    
    if (error) return console.error('Error:', error);
    
    const mpEgresos = [
        3100, 2100, 95556, 30, 4000, 32294.11, 27152, 10744.18
    ];
    
    console.log(`Found ${expenses.length} expenses in DB.`);
    
    // Dump all expenses nicely formatted
    expenses.forEach(e => {
        console.log(`- $${e.amount} | ${e.description} | Cat: ${e.category} | Date: ${new Date(e.created_at).toLocaleDateString()}`);
    });
    
    console.log('\nChecking which MercadoPago outflows might be MISSING in the DB...');
    // A simplistic check: see if there's any expense with the exact amount
    for (const amt of mpEgresos) {
        const found = expenses.find(e => parseFloat(e.amount) === amt);
        if (found) {
            console.log(`[FOUND in DB] MercadoPago $${amt} -> ${found.description}`);
        } else {
            console.log(`[MISSING in DB] MercadoPago $${amt} - Needs to be added!`);
        }
    }
}
run();
