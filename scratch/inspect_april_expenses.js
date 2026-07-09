const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: expenses } = await supabase.from('expenses').select('*');
    
    const startMs = new Date(2026, 3, 1).getTime(); // April 1st
    const endMs   = new Date(2026, 4, 0, 23, 59, 59, 999).getTime(); // April 30th

    const aprilExpenses = expenses.filter(e => {
        const eMs = new Date(e.created_at).getTime();
        return eMs >= startMs && eMs <= endMs;
    });

    console.log(`Found ${aprilExpenses.length} expenses in April 2026:`);
    aprilExpenses.forEach(e => {
        console.log(`ID: ${e.id} | Date: ${e.created_at} | Cat: ${e.category} | Amt: $${e.amount} | Desc: ${e.description}`);
    });
}
run();
