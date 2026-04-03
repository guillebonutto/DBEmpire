const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

supabase.from('sales')
    .select('id, created_at, total_amount, profit_generated, commission_amount, status, device_sig')
    .limit(1)
    .then(res => {
        console.log("First try:", res.error ? res.error : "SUCCESS: " + res.data.length);
        if (res.error) {
            supabase.from('sales')
                .select('id, created_at, total_amount, profit_generated, commission_amount, status')
                .limit(1).then(r2 => console.log("Second try:", r2.error || "SUCCESS"));
        }
        process.exit();
    });
