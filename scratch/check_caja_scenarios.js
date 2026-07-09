const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function checkScenarios() {
    const targetDiff = 34653.12;
    console.log(`Target difference to explain: $${targetDiff.toFixed(2)}`);

    const { data: expenses } = await supabase.from('expenses').select('*');
    const { data: orders } = await supabase.from('supplier_orders').select('*');
    const { data: sales } = await supabase.from('sales').select('*');

    // Scenario 1: Look for single expenses of this amount
    console.log("\n1. Searching for single expenses close to the difference:");
    expenses.forEach(e => {
        const amt = parseFloat(e.amount);
        if (Math.abs(amt - targetDiff) < 100) {
            console.log(`- Expense: $${amt} | Cat: ${e.category} | Desc: ${e.description} | Date: ${e.created_at}`);
        }
    });

    // Scenario 2: Check combinations of two expenses
    console.log("\n2. Searching for combinations of two expenses that sum to the difference:");
    for (let i = 0; i < expenses.length; i++) {
        for (let j = i + 1; j < expenses.length; j++) {
            const sum = parseFloat(expenses[i].amount) + parseFloat(expenses[j].amount);
            if (Math.abs(sum - targetDiff) < 0.05) {
                console.log(`- Sum: $${sum.toFixed(2)} | Exp1: $${expenses[i].amount} (${expenses[i].description}) | Exp2: $${expenses[j].amount} (${expenses[j].description})`);
            }
        }
    }

    // Scenario 3: Mismatches between supplier order installments paid vs actual Pago de Deuda expenses
    console.log("\n3. Checking if the difference comes from order payment differences:");
    // Let's compute calculated payments for all orders vs actual expenses
    let totalCalc = 0;
    let totalActual = 0;
    
    const orderMismatches = [];
    orders.forEach(o => {
        const totalCost = parseFloat(o.total_cost || o.total_amount) || 0;
        const instTotal = parseInt(o.installments_total) || 1;
        const instPaid = parseInt(o.installments_paid) || 0;
        const calcPaid = (totalCost / instTotal) * instPaid;
        totalCalc += calcPaid;

        const matched = expenses.filter(e => 
            e.category === 'Pago de Deuda' && 
            (e.details === o.id || (e.description && e.description.includes(o.id.slice(0, 4))))
        );
        const actualPaid = matched.reduce((sum, e) => sum + parseFloat(e.amount), 0);
        totalActual += actualPaid;

        const diff = calcPaid - actualPaid;
        if (Math.abs(diff) > 0.01) {
            orderMismatches.push({
                provider: o.provider_name,
                id: o.id,
                calcPaid,
                actualPaid,
                diff
            });
        }
    });

    console.log(`Total calculated installments paid: $${totalCalc.toFixed(2)}`);
    console.log(`Total actual 'Pago de Deuda' expenses: $${totalActual.toFixed(2)}`);
    console.log(`Difference in payments: $${(totalCalc - totalActual).toFixed(2)}`);

    // Let's see if a subset of these mismatches sums up to the target difference
    console.log("\nSubset of mismatches matching target difference:");
    // Let's print all mismatches first
    orderMismatches.forEach(m => {
        console.log(`- Provider: ${m.provider} (${m.id.slice(0,4)}) | Calc Paid: $${m.calcPaid.toFixed(2)} | Actual Paid: $${m.actualPaid.toFixed(2)} | Diff: $${m.diff.toFixed(2)}`);
    });

    // Scenario 4: Look for missing order payments. 
    // What if some orders are fully paid in supplier_orders but don't have expenses in the database?
    // We saw:
    // aa95f7a8: Gabriela AliExpress ($11637.56)
    // 83ad89d7: Temu ($116412.02)
    // 3a8d3c38: Claudia Lidia Mamani ($162499.92)
    // 6762e646: Nico ($300000.00 / $50000.00)
    // d2b59163: Gabriela ($42294.00)
    // 95ffc793: Gabriela ($70872.40)
    // 023f38c7: Gabriela ($22808.49)
    // 9767aa66: Gabriela ($5000.00)

    // Let's find if a combination of order payment differences is close to $34,653.12:
    // Let's look at order 023f38c7 difference: $22,808.49
    // Let's look at order aa95f7a8 difference: $11,637.56
    // Sum of these two: 22808.49 + 11637.56 = 34,446.05. Close but not exact.
    
    // What about:
    // Order 95ffc793 difference: $70872.40 (which is 2 cuotas of 35436.20)
    // Order 023f38c7 difference: $22808.49 (which is 1 cuota of 22808.50)
    
    // Let's look at the actual transactions of "Rendimiento Bancario":
    console.log("\n4. Checking Rendimiento Bancario details:");
    const yields = expenses.filter(e => e.category === 'Rendimiento Bancario');
    const totalYields = yields.reduce((sum, e) => sum + parseFloat(e.amount), 0);
    console.log(`Total Rendimiento Bancario: $${totalYields.toFixed(2)}`);
    // Print all yields
    yields.forEach(y => {
        // console.log(`- Date: ${y.created_at} | Amount: $${y.amount} | Desc: ${y.description}`);
    });
}

checkScenarios();
