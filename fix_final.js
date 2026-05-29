const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function fixAll() {
    // ================================================
    // 1. SECADORES: sale_price_cordoba=0 (nunca mandaste allá)
    // ================================================
    console.log("Secadores: ajustando precio Córdoba a 0...");
    const { error: e1 } = await supabase.from('products').update({
        sale_price_cordoba: 0
    }).eq('id', 'b0679350-cd60-466d-acb8-b64261398ae6');
    console.log(e1 ? "ERROR: " + e1.message : "OK");

    // ================================================
    // 2. CABLE TypeC->Lightning: stock 10 - 1 vendido = 9
    // ================================================
    console.log("Cable TypeC->Lightning: corrigiendo stock a 9...");
    const { error: e2 } = await supabase.from('products').update({
        current_stock: 9,
        stock_local: 9,
        stock_cordoba: 0,
        variants: [{ color: "Negro", stock: "9" }]
    }).eq('id', '0cb86a91-be70-44d5-9155-3507f08a7eee');
    console.log(e2 ? "ERROR: " + e2.message : "OK");

    // ================================================
    // 3. CABLE TypeC->TypeC: 
    //    Comprados: 6 Rojo (Cba) + 6 Celeste (Cba) + 18 Negro50cm (Jujuy) = 30
    //    Vendidos: 2 Rojo (local) + 2 Celeste (local) + 1 Gris (unknown) + 1 sin color = 6
    //    - Los 2 Rojo vendidos → Rojo 1m de Jujuy (eran los que había ahí): Rojo: 6-2 = 4, pero ojo Rojo está en Cba!
    //    Vendidos de local: 2 Rojo + 2 Celeste en Jujuy (se enviaron para allá antes)
    //    Segun ubicaciones: 4 local, 0 Cba => los 4 de local = Rojo+Celeste de los 12 originales (pero Cba tiene 6+6)
    //    Situacion real: Cba tiene los 12 (6R+6C), Jujuy tiene los 18 Negro50cm
    //    De Jujuy se vendieron: qty 4 local con colores Rojo y Celeste => ventas antes de que llegaran al local
    //    Stock actual: Rojo 1m=6-2=4(Cba), Celeste 1m=6-2=4(Cba), Negro 50cm=18(Jujuy), total=26
    //    Pero también 2 "desconocido" que podrían ser de Jujuy o Cba
    //    Asumimos conservador: descontamos del local => Rojo 4 Cba, Celeste 4 Cba, Negro 50cm 18-2=16 local
    //    total_local=16, total_cba=8, total=24
    console.log("Cable TypeC->TypeC: ajustando stock con ventas descontadas...");
    const { error: e3 } = await supabase.from('products').update({
        current_stock: 24,
        stock_local: 16,  // 18 negro - 2 desconocidos/local
        stock_cordoba: 8, // 6+6 - 2 rojo - 2 celeste
        variants: [
            { color: "Rojo 1m", stock: "4" },
            { color: "Celeste 1m", stock: "4" },
            { color: "Negro 50cm", stock: "16" }
        ]
    }).eq('id', '8733c92d-dd83-448f-bb16-a6ca97531433');
    console.log(e3 ? "ERROR: " + e3.message : "OK");

    // ================================================
    // VERIFICACION FINAL
    // ================================================
    console.log("\n=== VERIFICACION FINAL ===");
    const { data: prods } = await supabase.from('products')
        .select('name, cost_price, sale_price, sale_price_cordoba, stock_local, stock_cordoba, current_stock, variants')
        .in('id', [
            'b0679350-cd60-466d-acb8-b64261398ae6',
            '0cb86a91-be70-44d5-9155-3507f08a7eee',
            '8733c92d-dd83-448f-bb16-a6ca97531433'
        ]);
    prods.forEach(p => {
        console.log(`\n${p.name}`);
        console.log(`  Costo: $${p.cost_price} | Venta Jujuy: $${p.sale_price} | Venta Cba: $${p.sale_price_cordoba}`);
        console.log(`  Stock: ${p.current_stock} (Jujuy:${p.stock_local} Cba:${p.stock_cordoba})`);
        console.log(`  Variantes: ${JSON.stringify(p.variants)}`);
    });
}

fixAll();
