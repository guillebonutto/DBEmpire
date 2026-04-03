const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log('--- Start DB Maintenance ---');

    // 1. Find Maxi Bonutto Order
    const { data: orders } = await supabase.from('supplier_orders').select('*').ilike('provider_name', '%Maxi%');
    console.log('Order:', JSON.stringify(orders));

    // 2. Find Expenses
    const { data: expPerfumes } = await supabase.from('expenses').select('*').ilike('description', '%perfume%');
    const { data: expTazas } = await supabase.from('expenses').select('*').ilike('description', '%taza%');
    console.log('Expenses Perfumes:', JSON.stringify(expPerfumes));
    console.log('Expenses Tazas:', JSON.stringify(expTazas));

    if (orders && orders.length > 0) {
        const order = orders[0];
        console.log(`Updating Maxi Bonutto order (${order.id}) to status 'consigned' (marking it received manually)...`);
        
        // Use 'consigned' to avoid debt calculation
        await supabase.from('supplier_orders').update({
            status: 'consigned',
            notes: (order.notes || '') + ' [MANUALLY_RECEIVED]'
        }).eq('id', order.id);
        console.log('Order updated.');
    }

    // Delete Expenses
    if (expPerfumes) {
        for (const e of expPerfumes) {
            console.log(`Deleting expense: ${e.description} (${e.amount})...`);
            await supabase.from('expenses').delete().eq('id', e.id);
        }
    }
    if (expTazas) {
        for (const e of expTazas) {
            console.log(`Deleting expense: ${e.description} (${e.amount})...`);
            await supabase.from('expenses').delete().eq('id', e.id);
        }
    }

    console.log('--- Finished DB Maintenance ---');
}

run();
