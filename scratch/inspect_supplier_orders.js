const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const { data: orders } = await supabase.from('supplier_orders').select('*');
    console.log(orders.map(o => ({
        id: o.id,
        provider: o.provider_name,
        total_cost: o.total_cost,
        total_amount: o.total_amount,
        installments_total: o.installments_total,
        installments_paid: o.installments_paid,
        status: o.status,
        created_at: o.created_at
    })));
}
run();
