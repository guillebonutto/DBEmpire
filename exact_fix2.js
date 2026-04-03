const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    await supabase.from('expenses').delete().eq('description', 'Ajuste Quirúrgico Definitivo (Ignorando Rendimientos Bancarios)');
    
    // Total Rendimientos calculados:
    // Old: 615.74
    // New: 48.14+48.11+48.08+49.94+42.98+42.95+41.73+9.46+22.03+51.98+53.21 = 458.61
    // Total: 1074.35
    
    const rendimientoTotal = 1074.35;
    const targetCaja = 34795 - rendimientoTotal; // 33720.65
    
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

    let totalExpensesCaja = 0;
    expenses.forEach(e => {
        if (!isExpenseCreditStock(e)) {
            totalExpensesCaja += (parseFloat(e.amount) || 0);
        }
    });

    const currentNetCaja = totalSales - totalExpensesCaja;
    const adjustmentAmount = currentNetCaja - targetCaja; 
    
    console.log(`Current App (excluding the fake 10.3k): ${currentNetCaja}. Target: ${targetCaja}. Adjustment need: ${adjustmentAmount}`);
    
    const newExpense = {
        amount: adjustmentAmount.toFixed(2),
        description: 'Ajuste Quirúrgico Definitivo (Ignorando Rendimientos Bancarios)',
        category: 'General'
    };
    
    const { error } = await supabase.from('expenses').insert([newExpense]);
    if (!error) console.log('SUCCESS');
}
run();
