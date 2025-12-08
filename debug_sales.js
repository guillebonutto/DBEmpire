
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkSales() {
    console.log("--- DEBUGGING SALES ---");

    // 1. Check Profiles
    const { data: profiles, error: pError } = await supabase.from('profiles').select('*');
    if (pError) console.error("Profiles Error:", pError.message);
    else console.log("Profiles found:", profiles ? profiles.length : 0);

    // 2. Check Sales
    const { data: sales, error: sError } = await supabase.from('sales').select('*');
    if (sError) console.error("Sales Error:", sError.message);
    else {
        console.log("Sales found:", sales ? sales.length : 0);
        if (sales && sales.length > 0) {
            console.log("Last Sale:", sales[0]);
        } else {
            console.log("NO SALES IN DATABASE.");
        }
    }
}

checkSales();
