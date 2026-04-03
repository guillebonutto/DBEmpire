const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function applyFix() {
    // 1. $35,000 robado (Rollo 1mt) -> 28/02/2026
    const febDate = '2026-02-28T12:00:00.000000+00:00';
    const { data: d1, error: e1 } = await supabase
        .from('expenses')
        .update({ created_at: febDate })
        .eq('amount', 35000)
        .ilike('description', '%robado%');

    if (e1) console.log('Err 35k:', e1.message);
    else console.log('✅ Gasto $35.000 -> 28 de Febrero (OK)');

    // 2. $178,000 (2 rollos + remeras) -> 17/03/2026
    const marDate = '2026-03-17T12:00:00.000000+00:00';
    const { data: d2, error: e2 } = await supabase
        .from('expenses')
        .update({ created_at: marDate })
        .eq('amount', 178000)
        .ilike('description', '%remeras%');

    if (e2) console.log('Err 178k:', e2.message);
    else console.log('✅ Gasto $178.000 -> 17 de Marzo (OK)');
}

applyFix();
