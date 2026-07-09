const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function inspectPayments() {
    const { data: expenses } = await supabase
        .from('expenses')
        .select('*')
        .eq('category', 'Pago de Deuda')
        .order('created_at', { ascending: true });

    console.log("--- REGISTRY OF PAGO DE DEUDA EXPENSES ---");
    expenses.forEach((e, idx) => {
        console.log(`${idx + 1}. Date: ${e.created_at} | Amount: $${e.amount} | Desc: ${e.description}`);
    });
}

inspectPayments();
