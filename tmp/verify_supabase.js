const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyInSupabase() {
    const saleId = '76994603-afd3-4b50-931b-1cdb44e3ff48';
    
    const { data, error } = await supabase
        .from('sales')
        .select('id, total_amount, status, created_at')
        .eq('id', saleId)
        .single();

    if (error) {
        console.error('Error al verificar:', error);
        return;
    }

    console.log('--- ESTADO ACTUAL EN SUPABASE ---');
    console.log(`🆔 ID: ${data.id}`);
    console.log(`💰 Monto: $${data.total_amount}`);
    console.log(`🔴 ESTADO: ${data.status.toUpperCase()}`);
    console.log(`📅 Creado el: ${data.created_at}`);
}

verifyInSupabase();
