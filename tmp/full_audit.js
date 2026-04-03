const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function scanAllCoffeeSales() {
    const { data: prod } = await supabase.from('products').select('id').eq('name', 'Filtro de café').single();
    if (!prod) return;

    // Buscamos ABSOLUTAMENTE TODAS las ventas de este producto
    const { data, error } = await supabase
        .from('sale_items')
        .select(`
            quantity, 
            color,
            sales (
                created_at,
                status,
                clients ( name )
            )
        `)
        .eq('product_id', prod.id);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- AUDITORÍA INTEGRAL DE FILTROS DE CAFÉ ---');
    data.forEach((item, index) => {
        const date = new Date(item.sales.created_at).toLocaleDateString();
        const client = item.sales.clients?.name || 'Venta Express';
        const colorText = item.color || 'No especificado';
        const status = item.sales.status === 'budget' ? '⚠️ PRESUPUESTO' : '✅ VENTA REAL';
        
        console.log(`${index + 1}. [${date}] ${status} - ${client} | Color: ${colorText} | Cantidad: ${item.quantity}`);
    });
}

scanAllCoffeeSales();
