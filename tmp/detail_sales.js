const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function detailCoffeeSales() {
    // 1. Buscamos el ID del Filtro de café
    const { data: prod } = await supabase
        .from('products')
        .select('id')
        .eq('name', 'Filtro de café')
        .single();

    if (!prod) return;

    // 2. Buscamos los items de venta de ese producto en NEGRO
    // Traemos también la info de la venta (fecha) y el cliente
    const { data, error } = await supabase
        .from('sale_items')
        .select(`
            quantity, 
            color,
            sales (
                created_at,
                clients ( name )
            )
        `)
        .eq('product_id', prod.id)
        .ilike('color', '%negro%');

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- DETALLE DE VENTAS: FILTRO DE CAFÉ (NEGRO) ---');
    if (data.length === 0) {
        console.log('No se encontraron registros detallados.');
        return;
    }

    data.forEach((item, index) => {
        const date = new Date(item.sales.created_at).toLocaleDateString();
        const clientName = item.sales.clients?.name || 'Cliente de paso';
        console.log(`${index + 1}. [${date}] - Cliente: ${clientName} | Unidades: ${item.quantity}`);
    });
}

detailCoffeeSales();
