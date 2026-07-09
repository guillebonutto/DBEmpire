const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function inspectTemu() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    console.log("Searching for 'Temu', 'Claudia', 'Nico', 'Maxi' in expenses:");
    expenses.forEach(e => {
        const desc = (e.description || '').toLowerCase();
        if (desc.includes('temu') || desc.includes('claudia') || desc.includes('nico') || desc.includes('maxi')) {
            console.log(`ID: ${e.id} | Date: ${e.created_at} | Cat: ${e.category} | Amt: $${e.amount} | Desc: ${e.description}`);
        }
    });
}

inspectTemu();
