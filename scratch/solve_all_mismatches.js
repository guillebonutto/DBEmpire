const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: sales } = await supabase.from('sales').select('*');
    const { data: expenses } = await supabase.from('expenses').select('*');
    const { data: orders } = await supabase.from('supplier_orders').select('*');

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

    const totalSales = completedSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
    const totalNormalExpenses = expenses.reduce((sum, e) => !isBankYield(e) && !isInitialCreditStock(e) && !isDebtPayment(e) ? sum + parseFloat(e.amount) : sum, 0);
    const totalDebtPayments = expenses.reduce((sum, e) => isDebtPayment(e) ? sum + parseFloat(e.amount) : sum, 0);
    const totalYields = expenses.reduce((sum, e) => isBankYield(e) ? sum + parseFloat(e.amount) : sum, 0); // negative in DB, e.g. -1670.89

    console.log(`totalSales: ${totalSales}`);
    console.log(`totalNormalExpenses: ${totalNormalExpenses}`);
    console.log(`totalDebtPayments: ${totalDebtPayments}`);
    console.log(`totalYields: ${totalYields}`);

    const baseCajaNoYields = totalSales - totalNormalExpenses - totalDebtPayments;
    console.log(`baseCajaNoYields: ${baseCajaNoYields}`);

    const targetBank = 94628.49;

    // We want to find a combination of adjustments that equals targetBank.
    // Possible adjustments:
    // 1. Yields sign: can be +totalYields (-1670.89), -totalYields (+1670.89), or 0.
    // 2. Specific supplier orders:
    //    For each supplier order, we could:
    //    - Subtract its calculated paid amount (as if it was a cash payment from bank)
    //    - Subtract its actual DB 'Pago de Deuda' expenses
    //    - Add back its actual DB 'Pago de Deuda' expenses
    // Let's build a list of options for each supplier order.
    const orderOptions = orders.map(o => {
        const totalCost = parseFloat(o.total_cost || o.total_amount) || 0;
        const instTotal = parseInt(o.installments_total) || 1;
        const instPaid = parseInt(o.installments_paid) || 0;
        const calcPaid = (totalCost / instTotal) * instPaid;

        const matched = expenses.filter(e => 
            e.category === 'Pago de Deuda' && 
            (e.details === o.id || (e.description && e.description.includes(o.id.slice(0, 4))))
        );
        const actualPaid = matched.reduce((sum, e) => sum + parseFloat(e.amount), 0);

        return {
            id: o.id,
            provider: o.provider_name,
            totalCost,
            calcPaid,
            actualPaid,
            choices: [
                { name: `None`, val: 0 },
                { name: `Subtract Calc Paid ($${calcPaid.toFixed(2)})`, val: -calcPaid },
                { name: `Subtract Actual Paid ($${actualPaid.toFixed(2)})`, val: -actualPaid },
                { name: `Subtract Diff ($${(calcPaid - actualPaid).toFixed(2)})`, val: -(calcPaid - actualPaid) },
                { name: `Add Actual Paid ($${actualPaid.toFixed(2)})`, val: actualPaid }
            ]
        };
    });

    // Let's do a recursive search over yields options and order choices
    const yieldOptions = [
        { name: "Yields added (correct): +$1670.89", val: -totalYields },
        { name: "Yields subtracted (current app): -$1670.89", val: totalYields },
        { name: "No Yields: $0", val: 0 }
    ];

    function search(index, currentSum, path) {
        if (index === orderOptions.length) {
            yieldOptions.forEach(yOption => {
                const finalSum = currentSum + yOption.val;
                const diff = finalSum - targetBank;
                if (Math.abs(diff) < 2) {
                    console.log(`\nMatch found! Final Sum: $${finalSum.toFixed(2)} | Diff: $${diff.toFixed(2)}`);
                    console.log(`Yield: ${yOption.name}`);
                    path.forEach(p => {
                        if (p.val !== 0) {
                            console.log(`Order: ${p.provider} (${p.id.slice(0,4)}): ${p.name}`);
                        }
                    });
                }
            });
            return;
        }

        const o = orderOptions[index];
        o.choices.forEach(choice => {
            path.push({ provider: o.provider, id: o.id, name: choice.name, val: choice.val });
            search(index + 1, currentSum + choice.val, path);
            path.pop();
        });
    }

    console.log("\nSearching for matches...");
    search(0, baseCajaNoYields, []);
    console.log("Search finished.");
}
run();
