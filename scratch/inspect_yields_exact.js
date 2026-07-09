const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function inspectExact() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    console.log("Searching for expenses with amount close to 207.07:");
    expenses.forEach(e => {
        const amt = Math.abs(parseFloat(e.amount));
        if (Math.abs(amt - 207.07) < 5) {
            console.log(`Expense: ID: ${e.id} | Amt: $${e.amount} | Cat: ${e.category} | Desc: ${e.description} | Date: ${e.created_at}`);
        }
    });

    console.log("\nSearching for any yield sums or other details...");
    // Let's sum bank yields again
    const yields = expenses.filter(e => e.category === 'Rendimiento Bancario');
    console.log(`Total yields count: ${yields.length}`);
}

inspectExact();
