const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function inspect() {
    console.log("--- BUSCANDO EMA LA MADRID EN CLIENTES ---");
    const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('*');

    if (clientsError) {
        console.error("Error fetching clients:", clientsError);
    } else {
        console.log(`Total clientes: ${clients.length}`);
        clients.forEach(c => {
            console.log(`ID: ${c.id} | Nombre: ${c.name} | Teléfono: ${c.phone || 'N/A'}`);
        });

        const ema = clients.find(c => c.name?.toLowerCase().includes('ema') || c.name?.toLowerCase().includes('madrid'));
        if (ema) {
            console.log("\nEncontrada cliente:", ema);
        } else {
            console.log("\nNo se encontró a Ema La Madrid. Tendremos que crearla.");
            if (clients.length > 0) {
                console.log("Estructura de columnas del primer cliente:", Object.keys(clients[0]));
            }
        }
    }
}

inspect();
