const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function analyzeCaja() {
    console.log("--- ANALYZING CAJA FUERTE (LIQUIDIDAD) ---");
    
    // Fetch all sales
    const { data: sales, error: salesErr } = await supabase
        .from('sales')
        .select('*');
    if (salesErr) {
        console.error("Sales fetch error:", salesErr);
        return;
    }
    
    // Fetch all expenses
    const { data: expenses, error: expErr } = await supabase
        .from('expenses')
        .select('*');
    if (expErr) {
        console.error("Expenses fetch error:", expErr);
        return;
    }
    
    // Fetch all supplier orders
    const { data: supplierOrders, error: ordersErr } = await supabase
        .from('supplier_orders')
        .select('*');
    if (ordersErr) {
        console.error("Orders fetch error:", ordersErr);
        return;
    }

    console.log(`Loaded ${sales.length} sales, ${expenses.length} expenses, ${supplierOrders.length} supplier orders.`);

    // Let's compute all-time balance (which corresponds to "Ver Año Completo" or similar all-time metrics)
    // To do this, let's see how the app calculates all-time.
    // If there is no filter or if we look at the entire range, startMs is 0 and endMs is null.
    // Let's see:
    const startMs = 0; // all-time
    
    let prevIncome = 0, prevExpCaja = 0;
    let currentIncome = 0;
    
    const finalSales = sales.filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    });

    const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
    const isBankYield     = (e) => e.category === 'Rendimiento Bancario';
    
    let totalSales = 0;
    let bankYields = 0;
    let operatingExpensesForCaja = 0;
    let debtPayments = 0;

    finalSales.forEach(s => {
        totalSales += (parseFloat(s.total_amount) || 0);
    });

    expenses.forEach(e => {
        const val = parseFloat(e.amount) || 0;
        const desc = (e.description || '').toLowerCase();
        const isInitialCreditStock = desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado') || desc.startsWith('inventario:');
        
        if (isBankYield(e)) {
            bankYields += val;
        } else if (isDebtPayment(e)) {
            debtPayments += val;
        } else if (!isInitialCreditStock) {
            operatingExpensesForCaja += val;
        } else {
            // It is initial credit stock expense (excluded from caja)
        }
    });

    const totalExpensesCaja = operatingExpensesForCaja + debtPayments;
    const netCaja = totalSales + bankYields - totalExpensesCaja;

    console.log("\n--- CAJA FUERTE ALL-TIME CALCULATION ---");
    console.log(`Total Sales Revenue (Completed): $${totalSales.toFixed(2)}`);
    console.log(`Total Bank Yields (Rendimiento Bancario): $${bankYields.toFixed(2)}`);
    console.log(`Total Operating Expenses (Actual Cash): $${operatingExpensesForCaja.toFixed(2)}`);
    console.log(`Total Debt Payments: $${debtPayments.toFixed(2)}`);
    console.log(`Total Expenses Deducted from Caja: $${totalExpensesCaja.toFixed(2)}`);
    console.log(`----------------------------------------`);
    console.log(`Calculated Caja Fuerte (Net Cash): $${netCaja.toFixed(2)}`);

    // Let's print out expenses grouped by category
    const catMap = {};
    expenses.forEach(e => {
        const cat = e.category || 'Sin Categoría';
        const val = parseFloat(e.amount) || 0;
        if (!catMap[cat]) catMap[cat] = { total: 0, count: 0 };
        catMap[cat].total += val;
        catMap[cat].count += 1;
    });
    console.log("\n--- EXPENSES BY CATEGORY ---");
    Object.keys(catMap).forEach(cat => {
        console.log(`${cat}: $${catMap[cat].total.toFixed(2)} (${catMap[cat].count} items)`);
    });

    // Let's print out recent expenses to inspect them
    console.log("\n--- RECENT EXPENSES (Last 15) ---");
    const sortedExpenses = [...expenses].sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    sortedExpenses.slice(0, 20).forEach(e => {
        console.log(`Date: ${e.created_at} | Category: ${e.category} | Amount: $${e.amount} | Desc: ${e.description}`);
    });
}

analyzeCaja();
