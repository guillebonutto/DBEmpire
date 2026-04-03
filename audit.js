const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log('--- STARTING AUDIT ---');
    const { data: sales, error: err1 } = await supabase.from('sales').select('status, total_amount');
    if (err1) return console.error('Sales error:', err1);
    
    let realSales = 0;
    for (const s of sales) {
        const st = (s.status || '').toLowerCase();
        if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
            realSales += parseFloat(s.total_amount) || 0;
        }
    }
    
    const { data: expenses, error: err2 } = await supabase.from('expenses').select('amount, category, description');
    if (err2) return console.error('Expenses error:', err2);
    
    let totalCaja = 0;
    let totalROI = 0;
    let debtAmount = 0;
    for (const e of expenses) {
        const amt = parseFloat(e.amount) || 0;
        const isDebt = e.category === 'Pago de Deuda';
        if (isDebt) {
            debtAmount += amt;
        } else {
            totalROI += amt;
        }
        totalCaja += amt;
    }

    console.log(`\n========= RESULTS =========`);
    console.log(`TOTAL REVENUE (Completed sales):  $${realSales.toFixed(2)} ([Count: ${sales.length}])`);
    console.log(`TOTAL EXPENSES IN DB:             $${totalCaja.toFixed(2)} ([Count: ${expenses.length}])`);
    console.log(`DEBT EXPENSES (Pago de Deuda):    $${debtAmount.toFixed(2)}`);
    console.log(`OPERATIONAL EXPENSES:             $${totalROI.toFixed(2)}`);
    console.log(`\nLIQUIDEZ ANTIGUA (incl. Deudas):  $${(realSales - totalCaja).toFixed(2)}`);
    console.log(`LIQUIDEZ NUEVA (Excl. Deudas):    $${(realSales - totalROI).toFixed(2)}`);
    
    // Sort expenses descending by amount to see what is draining
    expenses.sort((a,b) => b.amount - a.amount);
    console.log('\n--- TOP 10 EXPENSES ---');
    for(let i = 0; i < Math.min(10, expenses.length); i++) {
        console.log(`- $${expenses[i].amount} [${expenses[i].category}] ${expenses[i].description}`);
    }
}
run();
