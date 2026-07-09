const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function checkDb() {
    const { data: sales } = await supabase.from('sales').select('*');
    const { data: expenses } = await supabase.from('expenses').select('*');

    console.log(`Total Sales in DB: ${sales?.length}`);
    console.log(`Total Expenses in DB: ${expenses?.length}`);

    // Print all expenses > 100000 or categories
    console.log("\n--- LARGE EXPENSES OR CATEGORIES ---");
    const categories = {};
    (expenses || []).forEach(e => {
        categories[e.category] = (categories[e.category] || 0) + (parseFloat(e.amount) || 0);
        if (Math.abs(parseFloat(e.amount) || 0) > 10000) {
            console.log(`Expense: ${e.category} | ${e.description} | Amount: ${e.amount} | Date: ${e.created_at}`);
        }
    });

    console.log("\n--- EXPENSES BY CATEGORY ---");
    console.log(categories);

    // Let's run calculations like in AdminScreen.js for June 2026
    const filter = 'month';
    const dateObj = new Date("2026-06-15T00:00:00"); // June 2026
    const allMonths = false;

    // getDateRange logic
    let startMs = new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime();
    let endMs = new Date(dateObj.getFullYear(), dateObj.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    console.log(`\n--- CALCULATIONS FOR JUNE 2026 ---`);
    console.log(`Start: ${new Date(startMs).toISOString()} | End: ${new Date(endMs).toISOString()}`);

    let prevIncome = 0, prevExpCaja = 0, prevExpROI = 0, prevYields = 0;
    const currentSales = [];
    const currentExpenses = [];

    for (const s of (sales || [])) {
        const sMs = new Date(s.paid_at || s.created_at).getTime();
        if (sMs < startMs) {
            const st = (s.status || '').toLowerCase();
            if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
                prevIncome += (parseFloat(s.total_amount) || 0);
            }
        } else if (!endMs || sMs <= endMs) {
            currentSales.push(s);
        }
    }

    for (const e of (expenses || [])) {
        const eMs = new Date(e.created_at).getTime();
        const val = parseFloat(e.amount) || 0;
        const isDebtPayment = e.category === 'Pago de Deuda';
        const isBankYield = e.category === 'Rendimiento Bancario';
        const desc = (e.description || '').toLowerCase();
        const isInitialCreditStock = desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado') || desc.startsWith('inventario:');

        if (eMs < startMs) {
            if (isBankYield) {
                prevYields += Math.abs(val);
            } else if (!isInitialCreditStock) {
                prevExpCaja += val;
            }
            if (!isDebtPayment && !isBankYield) prevExpROI += val;
        } else if (!endMs || eMs <= endMs) {
            currentExpenses.push(e);
        }
    }

    const histBalCaja = prevIncome - prevExpCaja + prevYields;
    const histBalROI = prevIncome - prevExpROI;

    const finalSales = currentSales.filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    });

    const totalSales = finalSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    const grossProfit = finalSales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);

    const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
    const isBankYield     = (e) => e.category === 'Rendimiento Bancario';

    const operatingExpenses = currentExpenses.reduce((sum, e) =>
        isDebtPayment(e) || isBankYield(e) ? sum : sum + (parseFloat(e.amount) || 0), 0);
    const debtPayments      = currentExpenses.reduce((sum, e) =>
        isDebtPayment(e) ? sum + (parseFloat(e.amount) || 0) : sum, 0);
    const bankYields        = currentExpenses.reduce((sum, e) =>
        isBankYield(e) ? sum + Math.abs(parseFloat(e.amount) || 0) : sum, 0);

    const operatingExpensesForCaja = currentExpenses.reduce((sum, e) => {
        const isInitialCreditStock = (e.description || '').toLowerCase().includes('crédito') || (e.description || '').toLowerCase().includes('consolidado') || (e.description || '').toLowerCase().startsWith('inventario:');
        return isDebtPayment(e) || isBankYield(e) || isInitialCreditStock ? sum : sum + (parseFloat(e.amount) || 0);
    }, 0);
        
    const totalExpensesCaja = operatingExpensesForCaja + debtPayments;

    const netCaja   = histBalCaja + totalSales + bankYields - totalExpensesCaja;
    const netProfit = totalSales - operatingExpenses;

    console.log(`totalSales: ${totalSales}`);
    console.log(`operatingExpenses: ${operatingExpenses}`);
    console.log(`netProfit (Rentabilidad): ${netProfit}`);
    console.log(`histBalROI: ${histBalROI}`);
    console.log(`histBalCaja: ${histBalCaja}`);
    console.log(`netCaja: ${netCaja}`);

    // Let's run calculations for "Todo" (All time)
    console.log(`\n--- CALCULATIONS FOR TODO (ALL TIME) ---`);
    let startMsAll = 0;
    let endMsAll = new Date().getTime();

    let prevIncomeAll = 0, prevExpCajaAll = 0, prevExpROIAll = 0, prevYieldsAll = 0;
    const currentSalesAll = [];
    const currentExpensesAll = [];

    for (const s of (sales || [])) {
        const sMs = new Date(s.paid_at || s.created_at).getTime();
        if (sMs < startMsAll) {
            // Should be none
        } else if (!endMsAll || sMs <= endMsAll) {
            currentSalesAll.push(s);
        }
    }

    for (const e of (expenses || [])) {
        const eMs = new Date(e.created_at).getTime();
        if (eMs < startMsAll) {
            // Should be none
        } else if (!endMsAll || eMs <= endMsAll) {
            currentExpensesAll.push(e);
        }
    }

    const finalSalesAll = currentSalesAll.filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    });

    const totalSalesAll = finalSalesAll.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    const operatingExpensesAll = currentExpensesAll.reduce((sum, e) =>
        isDebtPayment(e) || isBankYield(e) ? sum : sum + (parseFloat(e.amount) || 0), 0);
    const netProfitAll = totalSalesAll - operatingExpensesAll;

    console.log(`totalSalesAll: ${totalSalesAll}`);
    console.log(`operatingExpensesAll: ${operatingExpensesAll}`);
    console.log(`netProfitAll (Rentabilidad Todo): ${netProfitAll}`);
}

checkDb();
