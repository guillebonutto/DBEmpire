const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: sales, error: salesErr } = await supabase.from('sales').select('*');
    const { data: expenses, error: expErr } = await supabase.from('expenses').select('*');
    const { data: orders, error: ordersErr } = await supabase.from('supplier_orders').select('*');

    if (salesErr || expErr || ordersErr) {
        console.error("Supabase error:", salesErr || expErr || ordersErr);
        return;
    }

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

    // Let's create a list of items to combine
    const candidates = [];

    // 1. All expenses (if we missed some)
    expenses.forEach(e => {
        candidates.push({
            type: 'Expense',
            id: e.id,
            amount: parseFloat(e.amount),
            desc: `${e.category}: ${e.description}`
        });
    });

    // 2. All sales (if we double counted or missed some)
    completedSales.forEach(s => {
        candidates.push({
            type: 'Sale',
            id: s.id,
            amount: parseFloat(s.total_amount),
            desc: `Sale: ${s.id.slice(0, 8)}`
        });
    });

    // 3. Let's look for combinations of items that sum to exactly 34653.12
    const target = 34653.12;
    console.log(`Target: $${target}`);

    // Let's first search for single candidate matching
    console.log("\n--- SINGLE ITEM MATCHES ---");
    candidates.forEach(c => {
        if (Math.abs(c.amount - target) < 1.0) {
            console.log(`Single match: ${c.type} | Amount: ${c.amount} | Desc: ${c.desc}`);
        }
    });

    // Let's search for pairs matching
    console.log("\n--- PAIR MATCHES ---");
    for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
            const sum1 = candidates[i].amount + candidates[j].amount;
            const sum2 = candidates[i].amount - candidates[j].amount;
            const sum3 = -candidates[i].amount + candidates[j].amount;
            const sum4 = -candidates[i].amount - candidates[j].amount;

            if (Math.abs(sum1 - target) < 0.1) {
                console.log(`Pair sum: ${candidates[i].desc} ($${candidates[i].amount}) + ${candidates[j].desc} ($${candidates[j].amount}) = $${sum1}`);
            }
            if (Math.abs(sum2 - target) < 0.1) {
                console.log(`Pair diff: ${candidates[i].desc} ($${candidates[i].amount}) - ${candidates[j].desc} ($${candidates[j].amount}) = $${sum2}`);
            }
            if (Math.abs(sum3 - target) < 0.1) {
                console.log(`Pair diff: -${candidates[i].desc} ($${candidates[i].amount}) + ${candidates[j].desc} ($${candidates[j].amount}) = $${sum3}`);
            }
        }
    }
}
run();
