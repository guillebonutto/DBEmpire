const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log('Fetching negative expenses...');
    const { data: expenses, error } = await supabase.from('expenses').select('id, amount, description, category');
    if (error) {
        return console.error('Error fetching:', error);
    }

    let updateCount = 0;

    for (const e of expenses) {
        const amt = parseFloat(e.amount) || 0;
        const desc = (e.description || '').toLowerCase();
        
        // Target specifically the negative expenses (discounts)
        const isTarget = amt < 0 && !desc.includes('consolidado');

        if (isTarget) {
            console.log(`Updating: $${e.amount} - ${e.description}`);
            const newDesc = `${e.description} (Stock Consolidado)`;
            
            const { error: updError } = await supabase.from('expenses').update({ description: newDesc }).eq('id', e.id);
            if (updError) {
                console.error(`Failed to update ${e.id}:`, updError);
            } else {
                updateCount++;
                console.log(`Success -> ${newDesc}`);
            }
        }
    }
    
    console.log(`\nDONE! Updated ${updateCount} negative expenses.`);
}

run();
