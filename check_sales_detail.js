const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

// User's list income items that are clearly SALES (not rendimentos)
const userSales = [
  12500, 64670, 33170, 2600, 3200, 6400, 10000, 4000, 34600,
  3200, 15000, 51200, 1900, 4000, 15000, 8000, 10816.92,
  51.98, 400000
];

async function run() {
  const { data: sales } = await sb.from('sales')
    .select('id, total_amount, status, notes, created_at')
    .order('created_at', { ascending: true });

  const startApr = new Date('2026-04-01T00:00:00-03:00').getTime();

  // Pre-April completed sales (these go into prevIncome)
  const priorCompleted = sales.filter(s => {
    const sMs = new Date(s.created_at).getTime();
    const st = (s.status || '').toLowerCase();
    const isFinal = st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    return sMs < startApr && isFinal;
  });

  const prevIncome = priorCompleted.reduce((a, b) => a + (parseFloat(b.total_amount) || 0), 0);
  console.log(`\n=== VENTAS COMPLETADAS PRE-ABRIL (prevIncome = $${prevIncome.toFixed(2)}) ===`);
  priorCompleted.forEach(s => {
    const amt = parseFloat(s.total_amount) || 0;
    const inList = userSales.some(u => Math.abs(u - amt) < 1 || Math.abs(34600 - amt) < 1);
    const tag = inList ? '✅ en tu lista' : '❓ NO está en tu lista';
    console.log(`  $${amt.toFixed(2).padStart(12)} | ${s.created_at.substring(0,10)} | ${tag} | ${(s.notes||'Sin nota').substring(0,50)}`);
  });

  console.log(`\nTotal prevIncome DB: $${prevIncome.toFixed(2)}`);

  // List which amounts are extra vs user's list
  const remaining = [...userSales];
  const extra = [];
  for (const s of priorCompleted) {
    const amt = parseFloat(s.total_amount) || 0;
    const idx = remaining.findIndex(u => Math.abs(u - amt) < 1);
    if (idx > -1) remaining.splice(idx, 1);
    else extra.push(s);
  }

  console.log(`\n=== VENTAS EN DB PERO NO EN TU LISTA (inflando prevIncome) ===`);
  extra.forEach(s => {
    const amt = parseFloat(s.total_amount) || 0;
    console.log(`  $${amt.toFixed(2)} | ${s.created_at.substring(0,10)} | ID: ${s.id} | ${(s.notes||'').substring(0,60)}`);
  });
  const extraSum = extra.reduce((a, b) => a + (parseFloat(b.total_amount) || 0), 0);
  console.log(`  TOTAL EXTRA: $${extraSum.toFixed(2)}`);

  console.log(`\n=== VENTAS EN TU LISTA PERO SIN MATCH EN DB ===`);
  remaining.forEach(u => console.log(`  $${u}`));
}
run();
