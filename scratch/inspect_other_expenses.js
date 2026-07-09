const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function inspectOther() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    console.log("--- OTHER CATEGORY EXPENSES ---");
    const others = (expenses || []).filter(e => 
        e.category !== 'Inventario' && 
        e.category !== 'Pago de Deuda' && 
        e.category !== 'Rendimiento Bancario'
    );
    
    others.sort((a,b) => new Date(a.created_at) - new Date(b.created_at));
    others.forEach(e => {
        console.log(`ID: ${e.id} | Date: ${e.created_at} | Cat: ${e.category} | Amt: $${e.amount} | Desc: ${e.description}`);
    });
}

inspectOther();
