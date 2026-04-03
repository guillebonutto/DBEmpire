const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data: sales } = await supabase.from('sales').select('status, total_amount, created_at, id, device_sig');
    let totalSales = 0;
    
    console.log(`=== VENTAS COMPLETADAS EN LA APP ===`);
    for (const s of sales) {
        const st = (s.status || '').toLowerCase();
        if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
            const amt = parseFloat(s.total_amount) || 0;
            totalSales += amt;
        }
    }
    console.log(`TOTAL INGRESOS (App): $${totalSales}`);

    const { data: expenses } = await supabase.from('expenses').select('amount, category, description, created_at');
    let totalExpensesCaja = 0;
    
    console.log(`\n=== GASTOS QUE RESTAN LIQUIDEZ ===`);
    expenses.forEach(e => {
        const desc = (e.description || '').toLowerCase();
        const isExpenseCreditStock = desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado');
        
        if (!isExpenseCreditStock) {
            const amt = parseFloat(e.amount) || 0;
            totalExpensesCaja += amt;
            console.log(`- $${amt} | ${e.description} | ${new Date(e.created_at).toLocaleDateString()}`);
        }
    });
    console.log(`TOTAL EGRESOS (Caja): $${totalExpensesCaja}`);
    
    console.log(`\nMATEMATICA PURA: $${totalSales} (Ingresos App) - $${totalExpensesCaja} (Egresos App) = $${totalSales - totalExpensesCaja}`);
}
run();
