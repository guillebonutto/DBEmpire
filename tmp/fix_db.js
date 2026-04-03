const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fix() {
    console.log('--- ANULANDO ACCESO AL ALIADO ---');
    const { error: pError } = await supabase
        .from('profiles')
        .update({ role: 'blocked' })
        .eq('id', '00000000-0000-0000-0000-000000000002');
    
    if (pError) console.error('Error anulando:', pError);
    else console.log('Acceso aliado anulado (rol a blocked).');

    console.log('\n--- CORRIGIENDO VENTAS DE HOY ---');
    
    // VENTA 1: cdccdbc4-7ed2-4c35-acdf-746288a68bf4
    const { error: s1Error } = await supabase
        .from('sales')
        .update({ 
            total_amount: 4000, 
            profit_generated: 817.64,
            status: 'completed'
        })
        .eq('id', 'cdccdbc4-7ed2-4c35-acdf-746288a68bf4');
    
    if (s1Error) console.error('Error s1:', s1Error);
    else console.log('Venta s1 corregida.');

    // VENTA 2: 71f5b3b5-2622-424d-a3b4-d41be4a8e685 (Estaba cancelada, la pasamos a completa y corregimos)
    const { error: s2Error } = await supabase
        .from('sales')
        .update({ 
            total_amount: 4000, 
            profit_generated: 817.64,
            status: 'completed'
        })
        .eq('id', '71f5b3b5-2622-424d-a3b4-d41be4a8e685');

    if (s2Error) console.error('Error s2:', s2Error);
    else console.log('Venta s2 corregida.');
}

fix();
