const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findMissingSale() {
    // Buscamos cualquier venta donde el color sea negro
    // y el producto tenga que ver con café
    const { data, error } = await supabase
        .from('sale_items')
        .select('*, products(name), sales(status)')
        .ilike('color', '%negro%');

    if (error) return;

    let totalMatch = 0;
    console.log('--- BUSCANDO RÉCORDS DE COLOR NEGRO (VENTAS CERRADAS) ---');
    data.forEach(item => {
        const prodName = item.products?.name || 'Desconocido';
        const isSalesRecord = item.sales?.status !== 'budget' && item.sales?.status !== 'cancelled';
        
        if (prodName.toLowerCase().includes('café') && isSalesRecord) {
            totalMatch += item.quantity;
            console.log(`- Item ID: ${item.id} | Prod: ${prodName} | Cant: ${item.quantity} | Color: ${item.color}`);
        }
    });

    console.log(`\nCANTIDAD TOTAL VENDIDA (NEGRO + CAFÉ): ${totalMatch}`);
}

findMissingSale();
