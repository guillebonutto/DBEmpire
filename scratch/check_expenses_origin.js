const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const { data: exp } = await supabase.from('expenses')
        .select('*')
        .or('id.eq.92811f93-8526-40e6-9a74-1b0c6168280a,id.eq.9501cd72-52e5-4410-8cab-fc4a63b82203,id.eq.96feba6a-42eb-4b37-b517-9d5ff4eac3d9');
    
    console.log("Expenses found in Supabase:", JSON.stringify(exp, null, 2));
}

run();
