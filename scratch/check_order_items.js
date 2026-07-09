const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    const { data: items, error } = await supabase
        .from('supplier_order_items')
        .select('id, quantity, cost_per_unit, temp_product_name, product_id, shipping_package_id');
    
    if (error) {
        console.error("Error:", error);
        return;
    }

    const filtered = items.filter(i => 
        (i.temp_product_name && i.temp_product_name.toLowerCase().includes('secador')) ||
        (i.temp_product_name && i.temp_product_name.toLowerCase().includes('cargador')) ||
        i.product_id === 'b0679350-cd60-466d-acb8-b64261398ae6' || // Secador
        i.product_id === '53954f90-5ac3-4d8a-b333-e32addf66478' || // Cargador 40W
        i.product_id === '13162f0d-576f-4c08-857f-8bbcd7bc0e8b'    // Cargador 65W
    );

    console.log("Filtered Order Items:");
    console.log(JSON.stringify(filtered, null, 2));
}
check();
