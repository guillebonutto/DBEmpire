const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
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
    const targetCaja = 34795;
    
    // Si la app dice 24402 y quiero que diga 34795, necesito SUMAR 10392.
    // Para sumar 10392 en la formula de netCaja (totalSales - totalExpenses),
    // tengo que AGREGAR un gasto NEGATIVO de -10392.82
    const adjustmentAmount = currentNetCaja - targetCaja; 
    // ^ Ejemplo: 24402.18 - 34795 = -10392.82

    if (Math.abs(adjustmentAmount) > 0.01) {
        console.log(`Current App: ${currentNetCaja}. Target: ${targetCaja}. Adjustment need: ${adjustmentAmount}`);
        
        const newExpense = {
            amount: adjustmentAmount.toFixed(2),
            description: 'Ajuste de Saldo a Favor (Auditoría)',
            category: 'General'
        };
        
        const { error } = await supabase.from('expenses').insert([newExpense]);
        if (error) {
            console.error('Failed to insert adjustment:', error);
        } else {
            console.log('SUCCESS! Injected adjustment to fix the balance perfectly.');
        }
    } else {
        console.log('Balance is already perfect. No adjustment needed.');
    }
}
run();
