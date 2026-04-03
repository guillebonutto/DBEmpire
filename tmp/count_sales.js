const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function countFilters() {
    // Buscamos productos que digan "Filtro"
    const { data: prods, error: pErr } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', '%Filtro%');

    if (pErr || !prods.length) {
        console.log('No encontré productos con el nombre "Filtro".');
        return;
    }

    const prodIds = prods.map(p => p.id);

    // Buscamos ítems de venta con ese ID y color "Negro" o "negro"
    const { data: sales, error: sErr } = await supabase
        .from('sale_items')
        .select('quantity, color')
        .in('product_id', prodIds)
        .or('color.ilike.Negro,color.ilike.%negro%');

    if (sErr) {
        console.error('Error al traer ventas:', sErr);
        return;
    }

    const totalSold = sales.reduce((acc, curr) => acc + (curr.quantity || 0), 0);

    console.log(`--- REPORTE DE VENTAS ---`);
    console.log(`🔍 Productos analizados: ${prods.map(p => p.name).join(', ')}`);
    console.log(`🖤 Color: NEGRO`);
    console.log(`📈 CANTIDAD TOTAL VENDIDA: ${totalSold} unidades.`);
}

countFilters();
