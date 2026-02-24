const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data, error } = await supabase.rpc('get_table_columns', { t_name: 'expenses' });
    if (error) {
        // Fallback to a direct query via a sneaky trick if RPC doesn't exist
        console.log('Fetching via select limit 1');
        const { data: sample } = await supabase.from('expenses').select('*').limit(1);
        if (sample && sample.length > 0) {
            console.log('Columns:', Object.keys(sample[0]));
        } else {
            const { data: sample2 } = await supabase.from('expenses').select('*').limit(0);
            // This might not work to get keys if empty, but let's try
            console.log('Columns (empty):', Object.keys(sample2 || {}));
        }
    } else {
        console.log(data);
    }
}

checkColumns();
