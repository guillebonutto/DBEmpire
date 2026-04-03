const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function updateOldCuotas() {
    const { data: expenses, error: fetchErr } = await supabase
        .from('expenses')
        .select('id, description, category');

    if (fetchErr) {
        console.error('Error fetching expenses:', fetchErr.message);
        return;
    }

    let updatedCount = 0;
    for (const exp of expenses) {
        if (exp.description && exp.description.toLowerCase().includes('cuota') && exp.category !== 'Pago de Deuda') {
            console.log(`Updating ${exp.description} (category: ${exp.category} -> Pago de Deuda)`);
            const { error: updateErr } = await supabase
                .from('expenses')
                .update({ category: 'Pago de Deuda' })
                .eq('id', exp.id);
            
            if (updateErr) {
                console.error(`Error updating id ${exp.id}:`, updateErr.message);
            } else {
                updatedCount++;
            }
        }
    }
    console.log(`✅ Finished updating ${updatedCount} old install payment expenses.`);
}

updateOldCuotas();
