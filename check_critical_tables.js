const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkTables() {
    console.log('Checking activity_logs...');
    const { error: err1 } = await supabase.from('activity_logs').select('count', { count: 'exact', head: true });
    if (err1) console.log('activity_logs ERROR:', err1.message);
    else console.log('activity_logs exists!');

    console.log('Checking authorized_devices...');
    const { error: err2 } = await supabase.from('authorized_devices').select('count', { count: 'exact', head: true });
    if (err2) console.log('authorized_devices ERROR:', err2.message);
    else console.log('authorized_devices exists!');
}
checkTables();
