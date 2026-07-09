const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function inspectCajaDetails() {
    console.log("--- INVESTIGATING DISCREPANCY ---");

    // Fetch all sales
    const { data: sales } = await supabase.from('sales').select('*');
    const completedSales = (sales || []).filter(s => {
        const st = (s.status || '').toLowerCase();
        return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    });
    const totalSales = completedSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    console.log(`Total Sales (completed): $${totalSales.toFixed(2)}`);

    // Fetch all expenses
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    // Group expenses by category
    const catSum = {};
    (expenses || []).forEach(e => {
        const cat = e.category || 'General';
        const val = parseFloat(e.amount) || 0;
        if (!catSum[cat]) catSum[cat] = 0;
        catSum[cat] += val;
    });

    console.log("\nExpenses Sums:");
    Object.keys(catSum).forEach(cat => {
        console.log(`- ${cat}: $${catSum[cat].toFixed(2)}`);
    });

    // Fetch all supplier orders
    const { data: orders } = await supabase.from('supplier_orders').select('*');
    console.log("\nSupplier Orders Payments Check:");
    let totalCalculatedOrderPayments = 0;
    (orders || []).forEach(o => {
        const totalCost = parseFloat(o.total_cost || o.total_amount) || 0;
        const instTotal = parseInt(o.installments_total) || 1;
        const instPaid = parseInt(o.installments_paid) || 0;
        const instAmount = totalCost / instTotal;
        const paidAmount = instAmount * instPaid;
        totalCalculatedOrderPayments += paidAmount;
        console.log(`Order ID: ${o.id.slice(0,8)} | Provider: ${o.provider_name} | Total Cost: $${totalCost.toFixed(2)} | Installments: ${instPaid}/${instTotal} | Paid Amount (Calc): $${paidAmount.toFixed(2)}`);
    });

    console.log(`\nTotal calculated payments based on Order Installments: $${totalCalculatedOrderPayments.toFixed(2)}`);
    console.log(`Total actual 'Pago de Deuda' expenses in database: $${(catSum['Pago de Deuda'] || 0).toFixed(2)}`);

    // Let's check for any missing 'Pago de Deuda' expenses!
    // Or let's see: are there payments that were made in orders but have no corresponding expense row?
    console.log("\nChecking mismatch for each order:");
    (orders || []).forEach(o => {
        const totalCost = parseFloat(o.total_cost || o.total_amount) || 0;
        const instTotal = parseInt(o.installments_total) || 1;
        const instPaid = parseInt(o.installments_paid) || 0;
        const instAmount = totalCost / instTotal;
        const paidAmount = instAmount * instPaid;

        // Find actual expenses referencing this order ID
        // Note: the description or details of the expense contains the order ID
        const matchedExpenses = (expenses || []).filter(e => 
            e.category === 'Pago de Deuda' && 
            (e.details === o.id || (e.description && e.description.includes(o.id.slice(0, 4))))
        );
        const actualExpensesSum = matchedExpenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

        if (Math.abs(paidAmount - actualExpensesSum) > 0.01) {
            console.log(`⚠️ MISMATCH in Order ${o.id.slice(0,8)} (${o.provider_name}):`);
            console.log(`   - Paid Installments: ${instPaid}/${instTotal} -> Calculated paid: $${paidAmount.toFixed(2)}`);
            console.log(`   - Actual 'Pago de Deuda' expenses found: ${matchedExpenses.length} items, sum: $${actualExpensesSum.toFixed(2)}`);
            console.log(`   - Difference: $${(paidAmount - actualExpensesSum).toFixed(2)}`);
        }
    });

    // Let's also check if there are other expenses excluded or included
    // Wait, the safe balance is:
    // netCaja = totalSales + bankYields - (operatingExpensesForCaja + debtPayments);
    // where operatingExpensesForCaja excludes: 'Pago de Deuda', 'Rendimiento Bancario', and InitialCreditStock
    const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
    const isBankYield     = (e) => e.category === 'Rendimiento Bancario';
    const isInitialCreditStock = (e) => {
        const desc = (e.description || '').toLowerCase();
        return desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado') || desc.startsWith('inventario:');
    };

    const operatingExpensesForCaja = (expenses || []).reduce((sum, e) => {
        const val = parseFloat(e.amount) || 0;
        return isDebtPayment(e) || isBankYield(e) || isInitialCreditStock(e) ? sum : sum + val;
    }, 0);
    const debtPayments = (expenses || []).reduce((sum, e) => isDebtPayment(e) ? sum + parseFloat(e.amount) : sum, 0);
    const bankYields = (expenses || []).reduce((sum, e) => isBankYield(e) ? sum + parseFloat(e.amount) : sum, 0);

    console.log(`\nRe-calculating Net Caja:`);
    console.log(`Sales: $${totalSales}`);
    console.log(`Yields: $${bankYields}`);
    console.log(`Operating Expenses (Caja): $${operatingExpensesForCaja}`);
    console.log(`Debt Payments (Caja): $${debtPayments}`);
    const netCaja = totalSales + bankYields - (operatingExpensesForCaja + debtPayments);
    console.log(`Net Caja: $${netCaja}`);
}

inspectCajaDetails();
