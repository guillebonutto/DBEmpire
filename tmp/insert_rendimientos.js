const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
    'https://kxnqheckujcoytnfmxcd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

const rendimientos = [
    { date: '2026-04-03', amount: 22.03 },
    { date: '2026-04-02', amount: 51.98 },
    { date: '2026-04-01', amount: 53.21 },
    { date: '2026-03-31', amount: 48.14 },
    { date: '2026-03-30', amount: 48.11 },
    { date: '2026-03-29', amount: 48.08 },
    { date: '2026-03-28', amount: 49.94 },
    { date: '2026-03-27', amount: 42.98 },
    { date: '2026-03-26', amount: 42.95 },
    { date: '2026-03-25', amount: 41.73 },
    { date: '2026-03-24', amount: 9.46 },
    { date: '2026-03-23', amount: 9.45 },
    { date: '2026-03-19', amount: 6.77 },
    { date: '2026-03-18', amount: 6.76 },
    { date: '2026-03-17', amount: 6.76 },
    { date: '2026-03-16', amount: 6.75 },
    { date: '2026-03-15', amount: 6.75 },
    { date: '2026-03-14', amount: 6.74 },
    { date: '2026-03-13', amount: 6.74 },
    { date: '2026-03-12', amount: 6.74 },
    { date: '2026-02-24', amount: 21.82 },
    { date: '2026-02-14', amount: 20.35 },
    { date: '2026-02-13', amount: 20.34 },
    { date: '2026-02-12', amount: 17.67 },
    { date: '2026-02-11', amount: 17.66 },
    { date: '2026-02-10', amount: 17.66 },
    { date: '2026-02-09', amount: 12.17 },
    { date: '2026-02-08', amount: 12.16 },
    { date: '2026-02-07', amount: 12.16 },
    { date: '2026-02-06', amount: 12.15 },
    { date: '2026-02-05', amount: 12.14 },
    { date: '2026-02-03', amount: 6.87 },
    { date: '2026-02-02', amount: 6.87 },
    { date: '2026-02-01', amount: 6.87 },
    { date: '2026-01-31', amount: 6.86 },
    { date: '2026-01-30', amount: 6.86 },
    { date: '2026-01-29', amount: 6.86 },
    { date: '2026-01-28', amount: 6.85 },
    { date: '2026-01-27', amount: 6.85 },
    { date: '2026-01-26', amount: 6.84 },
    { date: '2026-01-25', amount: 6.84 },
    { date: '2026-01-24', amount: 6.84 },
    { date: '2026-01-23', amount: 6.83 },
    { date: '2026-01-22', amount: 6.83 },
    { date: '2026-01-21', amount: 6.83 },
    { date: '2026-01-20', amount: 6.82 },
    { date: '2026-01-19', amount: 6.82 },
    { date: '2026-01-18', amount: 6.81 },
    { date: '2026-01-17', amount: 6.81 },
    { date: '2026-01-16', amount: 6.81 },
    { date: '2026-01-15', amount: 6.80 },
    { date: '2026-01-14', amount: 6.80 },
    { date: '2026-01-10', amount: 42.29 },
    { date: '2026-01-09', amount: 6.85 },
];

const total = rendimientos.reduce((s, r) => s + r.amount, 0);
console.log(`Insertando ${rendimientos.length} registros. Total: $${total.toFixed(2)}`);

const records = rendimientos.map(r => ({
    description: 'Rendimiento bancario (acreditado por billetera)',
    amount: r.amount,
    category: 'Rendimiento Bancario',
    created_at: `${r.date}T12:00:00.000Z`
}));

supabase.from('expenses').insert(records).then(({ error }) => {
    if (error) {
        console.error('ERROR:', error.message);
    } else {
        console.log(`✅ ${rendimientos.length} rendimientos insertados correctamente.`);
        console.log(`   Total sumado a Caja: $${total.toFixed(2)}`);
        console.log(`   Impacto en ROI: NINGUNO (correctamente excluidos)`);
    }
    process.exit(0);
});
