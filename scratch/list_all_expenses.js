const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    if (!expenses) {
        console.log("No expenses fetched");
        return;
    }
    console.log(`Total: ${expenses.length} expenses`);
    let sum = 0;
    expenses.forEach((e, idx) => {
        const val = parseFloat(e.amount) || 0;
        sum += val;
        console.log(`${idx+1}. ID: ${e.id} | Cat: ${e.category} | Desc: ${e.description} | Amt: ${e.amount} | Date: ${e.created_at}`);
    });
    console.log(`Sum of all expenses in Supabase: $${sum.toFixed(2)}`);
}

run();
