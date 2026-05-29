const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function checkSales() {
    const productIds = {
        'Secador': 'b0679350-cd60-466d-acb8-b64261398ae6',
        'Cable USB→TypeC (negro)': 'b312d52b-ec02-4a94-a3e6-dcbca64b7486',
        'Cable TypeC→TypeC': '8733c92d-dd83-448f-bb16-a6ca97531433',
        'Cable TypeC→Lightning': '0cb86a91-be70-44d5-9155-3507f08a7eee',
    };

    for (const [name, id] of Object.entries(productIds)) {
        const { data: items } = await supabase
            .from('sale_items')
            .select('*, sales(sale_location, status, created_at)')
            .eq('product_id', id);

        const valid = (items || []).filter(i => i.sales?.status !== 'cancelled');
        const totalQty = valid.reduce((acc, i) => acc + (i.quantity || 0), 0);
        const byLocation = {};
        for (const i of valid) {
            const loc = i.sales?.sale_location || 'desconocido';
            byLocation[loc] = (byLocation[loc] || 0) + (i.quantity || 0);
        }

        console.log(`\n=== ${name} ===`);
        console.log(`  Total vendido: ${totalQty}`);
        console.log(`  Por ubicación: ${JSON.stringify(byLocation)}`);
        if (valid.length > 0) {
            console.log(`  Detalle de ventas:`);
            valid.forEach(i => {
                console.log(`    - qty:${i.quantity} color:${i.color || '-'} loc:${i.sales?.sale_location} fecha:${i.sales?.created_at?.substring(0,10)}`);
            });
        }
    }

    // Secadores: mostrar precio de costo vs precio de venta
    console.log("\n=== SECADORES - PRECIO ===");
    const { data: sec } = await supabase.from('products')
        .select('name, cost_price, sale_price, sale_price_cordoba, stock_local, stock_cordoba, current_stock')
        .eq('id', 'b0679350-cd60-466d-acb8-b64261398ae6').single();
    console.log(JSON.stringify(sec, null, 2));
}

checkSales();
