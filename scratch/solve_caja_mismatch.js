const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function solveMismatch() {
    const targetCaja = 129281.61;
    const bankBalance = 94628.49;
    const diffToExplain = targetCaja - bankBalance;
    console.log(`Difference between App Caja ($${targetCaja}) and Bank ($${bankBalance}) = $${diffToExplain.toFixed(2)}`);

    const { data: sales } = await supabase.from('sales').select('*');
    const { data: expenses } = await supabase.from('expenses').select('*');
    const { data: orders } = await supabase.from('supplier_orders').select('*');

    // Yields
    const yields = expenses.filter(e => e.category === 'Rendimiento Bancario');
    const totalYields = yields.reduce((sum, e) => sum + parseFloat(e.amount), 0); // e.amount is negative

    // We know:
    // If yields bug is fixed: bank yields should be added to Caja (which is -totalYields, i.e. +1670.89)
    // Currently, it does +totalYields (which is -1670.89).
    // Let's analyze the exact numbers.

    // Let's compute all possible order mismatches:
    // 1. Fully paid order aa95: $11637.56
    // 2. Original cost difference on 42d9: $1939.60 (Calculated $71391.21 vs Actual $69451.61)
    // 3. Mismatch in d2b5: Calculated $84588 vs Actual $42294? No, we saw all 6 cuotas are present.
    // 4. Mismatch in 95ff: Calculated $212617.20 vs Actual $141744.80? All 6 cuotas are present.
    // 5. Mismatch in 023f: Calculated $114042.49 vs Actual $91234? All 5 cuotas are present.
    // But what if the 6th cuota of 023f was paid? That's $22808.50.
    // What if the 2nd cuota of 42d9 was paid? That's $71391.21.
    // What if the 2nd cuota of 9767 was paid? That's $55000.00.

    // Let's test combinations of:
    // - aa95 order payment: $11,637.56
    // - 6th cuota of 023f: $22,808.50
    // - 42d9 difference: $1,939.60
    // - bank yields sign error: $1,670.89 or $3,341.78
    // Let's write a loop to print sums of different subsets:
    const elements = [
        { name: "Order aa95 (missing cash payment)", val: 11637.56 },
        { name: "6th installment of 023f (unregistered)", val: 22808.50 },
        { name: "42d9 installment difference", val: 1939.60 },
        { name: "9767 installment difference", val: 5000.00 },
        { name: "Bank yields sign discrepancy (single)", val: -totalYields }, // +1670.89
        { name: "Bank yields sign discrepancy (double)", val: -2 * totalYields }, // +3341.78
    ];

    console.log("\nTesting subsets of mismatches:");
    const n = elements.length;
    for (let i = 0; i < (1 << n); i++) {
        let sum = 0;
        let desc = [];
        for (let j = 0; j < n; j++) {
            if ((i & (1 << j)) !== 0) {
                sum += elements[j].val;
                desc.push(`${elements[j].name} ($${elements[j].val.toFixed(2)})`);
            }
        }
        if (Math.abs(sum - diffToExplain) < 10) {
            console.log(`Match! Sum: $${sum.toFixed(2)} (Diff: $${(sum - diffToExplain).toFixed(2)})`);
            console.log(`Components:\n  - ${desc.join('\n  - ')}`);
        }
    }
}

solveMismatch();
