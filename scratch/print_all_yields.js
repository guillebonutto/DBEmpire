const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    const { data: yields } = await supabase.from('expenses').select('*').eq('category', 'Rendimiento Bancario').order('created_at', { ascending: true });
    
    console.log(`Total yields: ${yields.length}`);
    yields.forEach((y, idx) => {
        console.log(`${idx + 1}. Date: ${y.created_at} | Amount: $${y.amount}`);
    });
}
run();
