const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Let's parse src/services/supabase.js using regular expressions to find URL and KEY
const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

if (!urlMatch || !keyMatch) {
    console.error("Could not find SUPABASE_URL or SUPABASE_ANON_KEY in supabase.js!");
    process.exit(1);
}

const SUPABASE_URL = urlMatch[1];
const SUPABASE_ANON_KEY = keyMatch[1];

console.log("URL:", SUPABASE_URL);
console.log("KEY LENGTH:", SUPABASE_ANON_KEY.length);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    const { data, error } = await supabase.from('expenses').select('count');
    if (error) {
        console.error("Error connecting with parsed key:", error);
    } else {
        console.log("Success! Count data:", data);
    }
}
run();
