const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const saleId = '098942f8-267c-426a-b573-223577d62e05';
    const clientId = 'f61ed449-8c87-42c8-ba3c-8bc43f2f3bbe'; // Ema La Madrid

    console.log(`Actualizando venta ${saleId} con cliente ${clientId} (Ema La Madrid)...`);
    const { data, error } = await supabase
        .from('sales')
        .update({ client_id: clientId })
        .eq('id', saleId)
        .select('*')
        .single();

    if (error) {
        console.error("Error updating sale:", error);
    } else {
        console.log("¡Venta actualizada con éxito!");
        console.log(data);
    }
}

run();
