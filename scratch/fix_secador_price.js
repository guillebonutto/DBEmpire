const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    console.log("Restoring Secador de zapatillas prices...");
    const { error } = await supabase
        .from('products')
        .update({
            sale_price: 22000,
            profit_margin_percent: 100
        })
        .eq('id', 'b0679350-cd60-466d-acb8-b64261398ae6');

    if (error) {
        console.error("Error updating secador:", error);
    } else {
        console.log("Successfully restored Secador de zapatillas to $22000 sale price and 100% margin.");
    }
}

run();
