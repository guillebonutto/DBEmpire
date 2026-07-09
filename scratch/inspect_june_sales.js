const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: sales } = await supabase.from('sales').select('*').order('created_at', { ascending: true });
    
    const startMs = new Date(2026, 5, 1).getTime(); // June 1st
    const endMs   = new Date(2026, 6, 0, 23, 59, 59, 999).getTime(); // June 30th

    const juneSales = sales.filter(s => {
        const sMs = new Date(s.created_at).getTime();
        return sMs >= startMs && sMs <= endMs;
    });

    console.log(`Found ${juneSales.length} sales in June 2026:`);
    juneSales.forEach(s => {
        console.log(`ID: ${s.id} | Date: ${s.created_at} | Status: ${s.status} | Amt: $${s.total_amount}`);
    });
}
run();
