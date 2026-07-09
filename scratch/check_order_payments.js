const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const { data: orders } = await supabase.from('supplier_orders').select('*');
    console.log("All Supplier Orders:");
    (orders || []).forEach(o => {
        console.log(`Order ID: ${o.id} | Provider: ${o.provider_name} | Total Amt: ${o.total_amount} | Cost: ${o.total_cost} | Paid: ${o.installments_paid}/${o.installments_total} | Status: ${o.status}`);
    });
}

run();
