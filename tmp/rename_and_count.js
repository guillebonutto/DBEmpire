const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function renameCoffeeMachine() {
    const oldName = 'Máquina de café portátil';
    const newName = 'Filtro de café';

    // 1. Buscamos el ID para estar seguros
    const { data: prod } = await supabase
        .from('products')
        .select('id, name')
        .eq('name', oldName)
        .single();

    if (!prod) {
        console.log('No se encontró el producto original.');
        return;
    }

    // 2. Renombramos el producto
    const { error: pErr } = await supabase
        .from('products')
        .update({ name: newName })
        .eq('id', prod.id);

    if (pErr) console.error('Error al renombrar:', pErr);
    else console.log(`✅ ¡Producto renombrado a "${newName}" con éxito!`);

    // 3. Contamos las ventas en negro DE ESE ID
    const { data: sales, error: sErr } = await supabase
        .from('sale_items')
        .select('quantity, color')
        .eq('product_id', prod.id)
        .ilike('color', '%negro%');

    if (sErr) {
        console.error('Error al traer ventas:', sErr);
        return;
    }

    const totalSold = sales.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

    console.log(`--- REPORTE FINAL ---`);
    console.log(`🖤 Color: NEGRO`);
    console.log(`📈 CANTIDAD VENDIDA (como Filtro de café): ${totalSold} unidades.`);
}

renameCoffeeMachine();
