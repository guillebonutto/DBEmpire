const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function run() {
    const { data: sales } = await supabase.from('sales').select('*');
    const { data: expenses } = await supabase.from('expenses').select('*');

    const completedSales = (sales || []).filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    });

    const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
    const isBankYield     = (e) => e.category === 'Rendimiento Bancario';
    const isInitialCreditStock = (e) => {
        const desc = (e.description || '').toLowerCase();
        return desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado') || desc.startsWith('inventario:');
    };

    let totalSales = completedSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    
    // Correct way:
    // Expenses are positive values in the DB, so we subtract them.
    // Yields are negative values in the DB, so if we want to add them as income, we subtract them (i.e. -(-val) = +val).
    // Let's verify if all other expenses are positive.
    let totalNormalExpenses = 0;
    let totalDebtPayments = 0;
    let totalYields = 0;
    let totalInitialStockExcluded = 0;

    expenses.forEach(e => {
        const val = parseFloat(e.amount) || 0;
        if (isBankYield(e)) {
            totalYields += val; // val is negative, e.g. -48.14
        } else if (isInitialCreditStock(e)) {
            totalInitialStockExcluded += val;
        } else if (isDebtPayment(e)) {
            totalDebtPayments += val;
        } else {
            totalNormalExpenses += val;
        }
    });

    console.log(`--- SUMS ---`);
    console.log(`Total Sales: $${totalSales}`);
    console.log(`Total Yields (negative in DB): $${totalYields}`);
    console.log(`Total Initial Stock Excluded: $${totalInitialStockExcluded}`);
    console.log(`Total Debt Payments: $${totalDebtPayments}`);
    console.log(`Total Normal Expenses: $${totalNormalExpenses}`);

    // If yields are treated as positive income:
    // Net Caja = Sales - NormalExpenses - DebtPayments - Yields (since Yields is negative, subtracting it adds it!)
    // Wait, let's verify if there are other negative expenses.
    // We saw "Remeras (corre cuenta propia)" is -89000. Is it an income? Yes, a discount.
    // We saw "Descuento tiempo limitado Temu" is -20856.
    
    console.log(`\n--- SCENARIOS FOR NET CAJA ---`);
    
    // Scenario A: Yields treated as negative (as the app currently does, subtracting them)
    // netCaja = Sales - NormalExpenses - DebtPayments + Yields (where Yields is negative)
    const netCajaA = totalSales - totalNormalExpenses - totalDebtPayments + totalYields;
    console.log(`Scenario A (App logic - yields subtract): $${netCajaA}`);

    // Scenario B: Yields treated as positive (adding them)
    // netCaja = Sales - NormalExpenses - DebtPayments - Yields (since Yields is negative, this adds its absolute value)
    const netCajaB = totalSales - totalNormalExpenses - totalDebtPayments - totalYields;
    console.log(`Scenario B (Correct logic - yields add): $${netCajaB}`);
}
run();
