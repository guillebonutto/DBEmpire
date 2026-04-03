const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function formatAllCuotasToDebt() {
    console.log("Fetching expenses to fix...");
    const { data: allExp, error } = await supabase.from('expenses').select('*');
    if (error) {
        console.error("Fetch err:", error);
        return;
    }
    
    let changed = 0;
    for (const e of allExp) {
        if (e.description && e.description.toLowerCase().includes('cuota') && e.category !== 'Pago de Deuda') {
            console.log(`Fixing id ${e.id} - ${e.description}`);
            const { error: updErr } = await supabase.from('expenses').update({ category: 'Pago de Deuda' }).eq('id', e.id);
            if (updErr) {
                console.error("Update error:", updErr);
            } else {
                changed++;
            }
        }
    }
    console.log(`Successfully fixed ${changed} items. Done.`);
    process.exit(0);
}

formatAllCuotasToDebt();
