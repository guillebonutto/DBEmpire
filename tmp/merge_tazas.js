const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function mergeProducts() {
    console.log('--- Merging Duplicate Tazas ---');
    
    const { data: products } = await supabase.from('products').select('*').ilike('name', '%Taza calentadora%');
    
    if (!products || products.length < 2) {
        console.log('No duplicates found (need at least 2). Found:', products?.length || 0);
        return;
    }

    console.log('Found:', products.map(p => `${p.name} (Stock: ${p.stock_local}, ID: ${p.id})`));

    // Master is the one with highest stock or latest, let's take the first one or the one with 3
    const master = products.reduce((prev, current) => (parseInt(prev.stock_local) > parseInt(current.stock_local)) ? prev : current);
    const others = products.filter(p => p.id !== master.id);

    let totalLocal = parseInt(master.stock_local) || 0;
    let totalCba = parseInt(master.stock_cordoba) || 0;

    for (const victim of others) {
        totalLocal += (parseInt(victim.stock_local) || 0);
        totalCba += (parseInt(victim.stock_cordoba) || 0);
        
        console.log(`Merging ${victim.id} into ${master.id}...`);
        
        // Delete victim (careful if it has variants or sales, but user asked to organize)
        const { error: delError } = await supabase.from('products').delete().eq('id', victim.id);
        if (delError) {
            console.error('Could not delete victim:', delError.message);
            // If delete fails due to FK, mark it inactive
            await supabase.from('products').update({ active: false, name: victim.name + ' (DUPLICADO)' }).eq('id', victim.id);
        }
    }

    // Update Master
    const { error: upError } = await supabase.from('products').update({
        stock_local: totalLocal,
        stock_cordoba: totalCba,
        current_stock: totalLocal + totalCba
    }).eq('id', master.id);

    if (upError) console.error('Error updating master:', upError);
    else console.log(`SUCCESS: Master ${master.name} now has total stock: ${totalLocal + totalCba}`);

    console.log('--- Finished Merge ---');
}

mergeProducts();
