const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    const targets = [116412.02, 162499.92, 300000, 11637.56, 11637, 116412, 162500];
    
    console.log("Searching for target amounts in expenses:");
    expenses.forEach(e => {
        const amt = Math.abs(parseFloat(e.amount));
        const match = targets.some(t => Math.abs(amt - t) < 10);
        if (match) {
            console.log(`Match: ID: ${e.id} | Amt: ${e.amount} | Cat: ${e.category} | Desc: ${e.description} | Date: ${e.created_at}`);
        }
    });
}
run();
