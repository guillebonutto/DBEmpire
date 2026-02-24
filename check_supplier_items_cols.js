const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkColumns() {
    const { data: sample } = await supabase.from('supplier_order_items').select('*').limit(1);
    if (sample && sample.length > 0) {
        console.log('Columns:', Object.keys(sample[0]));
    } else {
        // Try to get one even if empty by just selecting everything and looking at metadata if possible
        // or just assuming it's empty and we can't get keys this way.
        // Let's try to insert a dummy and rollback? No.
        console.log('Table might be empty, trying to find another way');
        const { data: cols } = await supabase.from('supplier_order_items').select().limit(0);
        console.log('Keys if any:', Object.keys(cols || {}));
    }
}

checkColumns();
