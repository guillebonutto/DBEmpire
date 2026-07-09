const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const idsToUpdate = [
        '53954f90-5ac3-4d8a-b333-e32addf66478', // Cargador de 40W
        '13162f0d-576f-4c08-857f-8bbcd7bc0e8b'  // Cargador de 65W GaN
    ];

    console.log("Updating Córdoba prices for charger products...");
    
    for (const id of idsToUpdate) {
        const { error } = await supabase
            .from('products')
            .update({ sale_price_cordoba: 0 })
            .eq('id', id);

        if (error) {
            console.error(`Error updating product ${id}:`, error);
        } else {
            console.log(`Successfully updated product ${id} (Córdoba price set to 0).`);
        }
    }
}

run();
