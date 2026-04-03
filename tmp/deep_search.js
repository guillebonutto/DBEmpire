const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function findFiltersDeep() {
    // 1. Buscar en TODOS los productos, activos o no
    const { data: allProds, error: pErr } = await supabase
        .from('products')
        .select('id, name, active')
        .ilike('name', '%Filtro%');

    console.log('--- BUSCANDO "FILTRO" EN BASE DE DATOS ---');
    if (allProds?.length > 0) {
        console.log(`Encontré ${allProds.length} productos con ese nombre.`);
        allProds.forEach(p => console.log(`- ${p.name} (Activo: ${p.active})`));
    } else {
        console.log('No hay nada con ese nombre en la tabla de productos.');
    }

    // 2. Si no hay, capaz el nombre está en una columna de "description" o en las ventas pasadas
    // Buscamos directamente en las ventas si alguien cargó un color Negro
    const { data: blackSales, error: sErr } = await supabase
        .from('sale_items')
        .select('*, products(name)')
        .ilike('color', '%negro%');

    if (blackSales?.length > 0) {
        console.log('\n--- VENTAS EN COLOR NEGRO ---');
        blackSales.forEach(s => {
            console.log(`- Producto: ${s.products?.name || 'ID ' + s.product_id} | Cantidad: ${s.quantity}`);
        });
    }
}

findFiltersDeep();
