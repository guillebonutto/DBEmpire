
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("Checking sales since March 20th...");
    const { data, error } = await supabase
        .from('sales')
        .select('*')
        .gte('created_at', '2026-03-20T00:00:00Z')
        .order('created_at', { ascending: true });

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Found", data.length, "sales.");
    data.forEach(s => {
        console.log(`[${s.created_at}] Status: ${s.status}, Total: ${s.total_amount}, ID: ${s.id.slice(0,8)}`);
    });
}

run();
