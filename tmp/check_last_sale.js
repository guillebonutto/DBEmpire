const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
        .from('sales')
        .select('id, status, total_amount, created_at, clients(name)')
        .gte('created_at', today.toISOString())
        .order('created_at', { ascending: false });

    console.log(`\n📅 VENTAS DE HOY (${today.toLocaleDateString()}):\n`);
    let totalContado = 0;
    data.forEach(s => {
        const cuenta = ['completed','exitosa','vended',''].includes((s.status||'').toLowerCase());
        if (cuenta) totalContado += s.total_amount || 0;
        console.log(`${cuenta ? '✅ SUMA' : '⛔ NO SUMA'}  | ${(s.status||'vacío').padEnd(12)} | $${s.total_amount} | ${s.clients?.name || 'Sin cliente'} | #${s.id.slice(0,8)}`);
    });
    console.log(`\n💰 TOTAL QUE CUENTA EN EL GRÁFICO HOY: $${totalContado}`);
})();
