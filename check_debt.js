const { createClient } = require('@supabase/supabase-js');
const s = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function checkDebt() {
    const { data: orders } = await s.from('supplier_orders').select('*');
    let totalDebt = 0;
    console.log('--- ALL SUPPLIER ORDERS ---');
    orders.forEach(o => {
        const totalInst = o.installments_total || 1;
        const paidInst = o.installments_paid || 0;
        const effectiveTotal = (parseFloat(o.total_cost) || 0) - (parseFloat(o.discount) || 0);
        const debt = (effectiveTotal / totalInst) * (totalInst - paidInst);
        if (debt > 0) {
            console.log(`Order ${o.id}: Provider: ${o.provider_name}, Total: ${effectiveTotal}, Paid Inst: ${paidInst}/${totalInst}, DEBT: ${debt}, Created: ${o.created_at}`);
            totalDebt += debt;
        }
    });
    console.log('TOTAL DEBT:', totalDebt);
}
checkDebt();
