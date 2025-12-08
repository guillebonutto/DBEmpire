
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkJoins() {
    console.log("--- DEBUGGING JOINS ---");

    // Exact query from SalesScreen.js
    const { data, error } = await supabase
        .from('sales')
        .select('*, profiles(full_name), clients(name)');

    if (error) {
        console.error("QUERY FAILED:", error.message);
        console.error("Hint:", error.hint);
    } else {
        console.log("Query Successful. Rows:", data.length);
        if (data.length > 0) {
            console.log("Sample Row:", JSON.stringify(data[0], null, 2));
        }
    }
}

checkJoins();
