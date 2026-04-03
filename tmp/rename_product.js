const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function renameProduct() {
    const oldName = 'Juego de 8 adaptadores';
    const newName = 'Adaptadores';

    // 1. Actualizar en Inventario (products)
    const { data: prodData, error: prodError } = await supabase
        .from('products')
        .update({ name: newName })
        .eq('name', oldName)
        .select();

    if (prodError) {
        console.error('Error actualizando productos:', prodError);
    } else {
        console.log(`✅ ¡Inventario actualizado! ${prodData.length} productos renombrados.`);
    }

    // 2. Nota: Las tablas de ventas (sale_items) suelen usar IDs, no nombres.
    // Pero si hay registros que guarden el nombre como texto (como las facturas generadas),
    // también los corregiremos si existen tablas de ese tipo.
}

renameProduct();
