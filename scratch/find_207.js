const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    const { data: sales } = await supabase.from('sales').select('*');

    const target = 207.06;
    console.log(`Target: ${target}`);

    expenses.forEach(e => {
        const amt = Math.abs(parseFloat(e.amount));
        if (Math.abs(amt - target) < 1.0) {
            console.log(`Expense Match: $${e.amount} | Cat: ${e.category} | Desc: ${e.description} | Date: ${e.created_at}`);
        }
    });

    sales.forEach(s => {
        const amt = Math.abs(parseFloat(s.total_amount));
        if (Math.abs(amt - target) < 1.0) {
            console.log(`Sale Match: $${s.total_amount} | Date: ${s.created_at}`);
        }
    });
}
run();
