const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkProfit() {
    console.log('--- SALES STATS ---');
    const { data: sales, error: sError } = await supabase.from('sales').select('total_amount, profit_generated, commission_amount');
    if (sError) console.error(sError);

    let totalSales = 0;
    let grossProfit = 0;
    let totalCommissions = 0;

    sales.forEach(s => {
        totalSales += parseFloat(s.total_amount) || 0;
        grossProfit += parseFloat(s.profit_generated) || 0;
        totalCommissions += parseFloat(s.commission_amount) || 0;
    });

    console.log('Total Sales:', totalSales);
    console.log('Gross Profit:', grossProfit);
    console.log('Total Commissions:', totalCommissions);

    console.log('\n--- EXPENSES STATS ---');
    const { data: expenses, error: eError } = await supabase.from('expenses').select('amount, description');
    if (eError) console.error(eError);

    let totalExpenses = 0;
    expenses.forEach(e => {
        console.log(`- ${e.description}: ${e.amount}`);
        totalExpenses += parseFloat(e.amount) || 0;
    });
    console.log('Total Expenses:', totalExpenses);

    console.log('\n--- CALCULATION ---');
    console.log('Net Profit = Gross Profit - Commissions - Expenses');
    console.log(`${grossProfit} - ${totalCommissions} - ${totalExpenses} = ${grossProfit - totalCommissions - totalExpenses}`);
}

checkProfit();
