const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    const { data: products, error } = await supabase
        .from('products')
        .select('id, name, cost_price, sale_price, sale_price_cordoba, stock_local, stock_cordoba, current_stock');
    
    if (error) {
        console.error("Error:", error);
        return;
    }

    const filtered = products.filter(p => 
        p.name.toLowerCase().includes('secador') || 
        p.name.toLowerCase().includes('cargador')
    );

    console.log("Filtered Products:");
    console.log(JSON.stringify(filtered, null, 2));
}
check();
