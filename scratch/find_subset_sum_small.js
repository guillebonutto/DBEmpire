const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    // Filter for yields
    const yields = expenses.filter(e => e.category === 'Rendimiento Bancario').map(e => ({
        id: e.id,
        amount: Math.abs(parseFloat(e.amount)),
        date: e.created_at
    }));

    const target = 207.06;
    console.log(`Searching for a subset of yields that sums to $${target}:`);

    // Let's use a simple subset sum algorithm
    const n = yields.length;
    // Since yields array is small (52 elements), a full 2^52 search is impossible.
    // Let's use a randomized search or branch and bound, or simple greedy check.
    // Let's search combinations of up to 4 yields:
    for (let i = 0; i < n; i++) {
        if (Math.abs(yields[i].amount - target) < 0.05) {
            console.log(`Match (1): ${yields[i].amount}`);
        }
        for (let j = i + 1; j < n; j++) {
            const sum2 = yields[i].amount + yields[j].amount;
            if (Math.abs(sum2 - target) < 0.05) {
                console.log(`Match (2): ${yields[i].amount} + ${yields[j].amount} = ${sum2}`);
            }
            for (let k = j + 1; k < n; k++) {
                const sum3 = sum2 + yields[k].amount;
                if (Math.abs(sum3 - target) < 0.05) {
                    console.log(`Match (3): ${yields[i].amount} + ${yields[j].amount} + ${yields[k].amount} = ${sum3}`);
                }
                for (let l = k + 1; l < n; l++) {
                    const sum4 = sum3 + yields[l].amount;
                    if (Math.abs(sum4 - target) < 0.05) {
                        console.log(`Match (4): ${yields[i].amount} + ${yields[j].amount} + ${yields[k].amount} + ${yields[l].amount} = ${sum4}`);
                    }
                }
            }
        }
    }
    console.log("Search complete.");
}
run();
