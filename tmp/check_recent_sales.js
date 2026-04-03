const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkRecentSales() {
    const { data, error } = await supabase
        .from('sales')
        .select('id, total_amount, created_at, notes, client_id')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching sales:', error);
        return;
    }

    console.log('--- ÚLTIMAS 10 VENTAS REGISTRADAS ---');
    data.forEach((s, index) => {
        console.log(`${index + 1}. ID: ${s.id} | Monto: $${s.total_amount} | Fecha: ${s.created_at} | Notas: ${s.notes || 'Sin notas'}`);
    });
}

checkRecentSales();
