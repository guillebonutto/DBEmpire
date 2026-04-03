const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fixExpenseDates() {
    // 1. Corregir gasto de $35,000 (Rollo 1mt robado) -> 28 de Febrero
    const dateFeb = new Date('2026-02-28T12:00:00-03:00').toISOString();
    const { data: data1, error: error1 } = await supabase
        .from('expenses')
        .update({ date: dateFeb, created_at: dateFeb })
        .eq('amount', 35000)
        .ilike('description', '%robado%')
        .select();

    if (error1) console.error('Error en gasto $35k:', error1);
    else console.log(`✅ Gosto de $35.000 movido al 28 de Febrero.`);

    // 2. Corregir gasto de $178,000 (2 rollos + remeras) -> 17 de Marzo
    const dateMar = new Date('2026-03-17T12:00:00-03:00').toISOString();
    const { data: data2, error: error2 } = await supabase
        .from('expenses')
        .update({ date: dateMar, created_at: dateMar })
        .eq('amount', 178000)
        .ilike('description', '%remeras%')
        .select();

    if (error2) console.error('Error en gasto $178k:', error2);
    else console.log(`✅ Gasto de $178.000 movido al 17 de Marzo.`);
}

fixExpenseDates();
