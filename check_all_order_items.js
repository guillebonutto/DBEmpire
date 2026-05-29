const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    const { data: items, error } = await supabase.from('supplier_order_items').select('*');
    if (error) {
        console.error(error);
    } else {
        console.log("All items matching secador or 22000 cost:");
        const matches = items.filter(i => (i.temp_product_name && i.temp_product_name.toLowerCase().includes('secador')) || i.cost_per_unit === 22000 || i.cost_per_unit === 11000);
        console.log(JSON.stringify(matches, null, 2));
    }
}
check();
