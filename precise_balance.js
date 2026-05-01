const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

// These are the EXACT records added by add_missing_rendimientos.js
const toRemove = [
  { amount: -6.74, date: '2026-03-12' }, { amount: -6.74, date: '2026-03-13' },
  { amount: -6.74, date: '2026-03-14' }, { amount: -6.86, date: '2026-01-22' },
  { amount: -6.86, date: '2026-01-23' }, { amount: -6.87, date: '2026-01-24' },
  { amount: -6.87, date: '2026-01-25' }, { amount: -6.87, date: '2026-01-26' },
  { amount: -6.88, date: '2026-01-27' }, { amount: -12.85, date: '2026-02-03' },
  { amount: -12.86, date: '2026-02-04' }, { amount: -14.07, date: '2026-02-05' },
  { amount: -14.08, date: '2026-02-06' }, { amount: -17.29, date: '2026-02-07' },
  { amount: -17.30, date: '2026-02-08' }, { amount: -30.59, date: '2026-03-20' },
  { amount: -48.14, date: '2026-03-31' }, { amount: -39.34, date: '2026-04-04' },
  { amount: -39.37, date: '2026-04-05' }, { amount:  -6.01, date: '2026-04-07' },
  { amount: -57.70, date: '2026-01-11' },
];

// Also replicate the EXACT AdminScreen.js formula to see what the app shows
// Filter: month = April 2026, viewAllMonths = false
async function run() {
  const { data: expenses } = await sb.from('expenses').select('id, amount, created_at, category, description');
  const { data: sales } = await sb.from('sales').select('id, total_amount, status, created_at');

  // --- Delete the 21 wrong records ---
  const pool = [...expenses];
  const deleted = [];
  for (const rem of toRemove) {
    const idx = pool.findIndex(e =>
      Math.abs(e.amount - rem.amount) < 0.005 &&
      e.created_at.startsWith(rem.date) &&
      e.category === 'Rendimiento Bancario'
    );
    if (idx > -1) {
      deleted.push(pool[idx]);
      pool.splice(idx, 1);
    }
  }
  console.log(`Found ${deleted.length} of 21 records to delete`);
  for (const rec of deleted) {
    await sb.from('expenses').delete().eq('id', rec.id);
  }
  console.log('Records deleted.\n');

  // --- Simulate the app formula for MONTH (April 2026) view ---
  const filterMonth = 3; // April = index 3 (0-based)
  const filterYear  = 2026;
  const startMs = new Date(filterYear, filterMonth, 1).getTime();
  const endMs   = new Date(filterYear, filterMonth + 1, 0, 23, 59, 59, 999).getTime();

  let prevIncome = 0, prevExpCaja = 0;
  let totalSales = 0, bankYields = 0, operatingExpenses = 0;

  const reloadedExpenses = pool; // use pool (expenses minus deleted)
  for (const e of reloadedExpenses) {
    const eMs = new Date(e.created_at).getTime();
    const val = parseFloat(e.amount) || 0;
    const isDebt = e.category === 'Pago de Deuda';
    const isYield = e.category === 'Rendimiento Bancario';
    const desc = (e.description || '').toLowerCase();
    const isStock = desc.includes('crédito') || desc.includes('credito') ||
                    desc.includes('consignacion') || desc.includes('consignación') ||
                    desc.includes('consolidado');
    if (eMs < startMs) {
      if (!isStock) prevExpCaja += val;
    } else if (eMs <= endMs) {
      if (isYield) bankYields += val;
      else if (!isDebt) operatingExpenses += val;
    }
  }

  for (const s of sales) {
    const sMs = new Date(s.created_at).getTime();
    const st = (s.status || '').toLowerCase();
    const isFinal = st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
    if (sMs < startMs && isFinal) prevIncome += (parseFloat(s.total_amount) || 0);
    else if (sMs <= endMs && isFinal) totalSales += (parseFloat(s.total_amount) || 0);
  }

  const histBalCaja = prevIncome - prevExpCaja;
  const netCaja = histBalCaja + totalSales + bankYields - operatingExpenses;

  console.log('=== SIMULACIÓN FÓRMULA APP (filtro Abril 2026) ===');
  console.log(`prevIncome:       $${prevIncome.toFixed(2)}`);
  console.log(`prevExpCaja:      $${prevExpCaja.toFixed(2)}`);
  console.log(`histBalCaja:      $${histBalCaja.toFixed(2)}`);
  console.log(`totalSales(Apr):  $${totalSales.toFixed(2)}`);
  console.log(`bankYields(Apr):  $${bankYields.toFixed(2)}`);
  console.log(`opExp(Apr):       $${operatingExpenses.toFixed(2)}`);
  console.log(`─────────────────────────────`);
  console.log(`NET CAJA (app):   $${netCaja.toFixed(2)}`);
  console.log(`TARGET:           $421123.63`);
  console.log(`DIFERENCIA:       $${(netCaja - 421123.63).toFixed(2)}`);
}
run();
