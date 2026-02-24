const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function checkCommissions() {
    try {
        const { data: sales, error: salesError } = await supabase
            .from('sales')
            .select('commission_amount, seller_id, profiles(full_name), status');

        if (salesError) throw salesError;

        const commissionBySeller = {};
        sales.forEach(sale => {
            const status = (sale.status || '').toLowerCase();
            const isFinalized = status === 'completed' || status === 'exitosa' || status === '' || status === 'vended';

            if (!isFinalized) return;

            const name = sale.profiles?.full_name || 'Desconocido';
            if (!commissionBySeller[name]) commissionBySeller[name] = 0;
            commissionBySeller[name] += (parseFloat(sale.commission_amount) || 0);
        });

        console.log('--- COMISIONES FINALES ---');
        console.log(JSON.stringify(commissionBySeller, null, 2));
    } catch (err) {
        console.error('Error:', err.message);
    }
}

checkCommissions();
