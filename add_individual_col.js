const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

// Create client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runSQL() {
    console.log('Attempting to add column via RPC...');
    const { data, error } = await supabase.rpc('exec_sql', { 
        sql: 'ALTER TABLE products ADD COLUMN is_individual BOOLEAN DEFAULT false;' 
    });
    
    if (error) {
        console.error('RPC Error:', error);
        console.log('Trying direct query as fallback (unlikely to work with anon key)...');
        const { error: directError } = await supabase.from('products').select('*').limit(0);
        if (directError) console.error('Direct query also failed (expected). Please add the column in Supabase SQL Editor.');
    } else {
        console.log('Column added successfully!', data);
    }
}

runSQL();
