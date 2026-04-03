const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log('Calculating exactly as AdminScreen.js does...');
    const { data: sales } = await supabase.from('sales').select('status, total_amount');
    
    let totalSales = 0;
    for (const s of sales) {
        const st = (s.status || '').toLowerCase();
        if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
            totalSales += parseFloat(s.total_amount) || 0;
        }
    }
    
    const { data: expenses } = await supabase.from('expenses').select('amount, category, description');
    
    const isExpenseCreditStock = (e) => {
        const desc = (e.description || '').toLowerCase();
        return desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado');
    };
    const isExpenseDebtPayment = (e) => e.category === 'Pago de Deuda';

    let totalExpensesCaja = 0;
    expenses.forEach(e => {
        if (!isExpenseCreditStock(e)) {
            totalExpensesCaja += (parseFloat(e.amount) || 0);
        }
    });

    const netCaja = totalSales - totalExpensesCaja;

    console.log(`\n========= APP CALCULATION =========`);
    console.log(`TOTAL REVENUE:    $${totalSales}`);
    console.log(`TOTAL EXP CJA:    $${totalExpensesCaja}`);
    console.log(`=> NET CAJA APP:  $${netCaja}`);
}
run();
