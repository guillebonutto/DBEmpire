const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    const { data: items, error } = await supabase.from('supplier_order_items').select('*, supplier_orders(*)').eq('product_id', 'b0679350-cd60-466d-acb8-b64261398ae6');
    if (error) {
        console.error(error);
    } else {
        console.log("Order items:", JSON.stringify(items, null, 2));
    }
}
check();
