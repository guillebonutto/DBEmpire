const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

// Rendimientos from user's list that are CONFIRMED MISSING from DB
// Stored as NEGATIVE amounts (as per the rest of the rendimiento records)
// Dates are estimated based on chronological position in the yield series
const toAdd = [
  // 6.74 x3 — deleted by fix_duplicates.js, in user's list
  { amount: -6.74, created_at: '2026-03-12T09:00:00-03:00' },
  { amount: -6.74, created_at: '2026-03-13T09:00:00-03:00' },
  { amount: -6.74, created_at: '2026-03-14T09:00:00-03:00' },
  // 6.86 x2 — missing from DB, January series
  { amount: -6.86, created_at: '2026-01-22T09:00:00-03:00' },
  { amount: -6.86, created_at: '2026-01-23T09:00:00-03:00' },
  // 6.87 x3 — missing from DB, January series
  { amount: -6.87, created_at: '2026-01-24T09:00:00-03:00' },
  { amount: -6.87, created_at: '2026-01-25T09:00:00-03:00' },
  { amount: -6.87, created_at: '2026-01-26T09:00:00-03:00' },
  // 6.88 x1 — last of January series
  { amount: -6.88, created_at: '2026-01-27T09:00:00-03:00' },
  // February rendimientos missing
  { amount: -12.85, created_at: '2026-02-03T09:00:00-03:00' },
  { amount: -12.86, created_at: '2026-02-04T09:00:00-03:00' },
  { amount: -14.07, created_at: '2026-02-05T09:00:00-03:00' },
  { amount: -14.08, created_at: '2026-02-06T09:00:00-03:00' },
  { amount: -17.29, created_at: '2026-02-07T09:00:00-03:00' },
  { amount: -17.30, created_at: '2026-02-08T09:00:00-03:00' },
  // March rendimiento missing
  { amount: -30.59, created_at: '2026-03-20T09:00:00-03:00' },
  // March 31 — 48.14 (follows 48.08 on 29/03 and 48.11 on 30/03)
  { amount: -48.14, created_at: '2026-03-31T09:00:00-03:00' },
  // April rendimientos
  { amount: -39.34, created_at: '2026-04-04T09:00:00-03:00' },
  { amount: -39.37, created_at: '2026-04-05T09:00:00-03:00' },
  { amount: -6.01,  created_at: '2026-04-07T09:00:00-03:00' },
  // 57.70 — appears before Temu purchase, probable January
  { amount: -57.70, created_at: '2026-01-11T09:00:00-03:00' },
].map(r => ({
  ...r,
  description: 'Rendimiento bancario (acreditado por billetera)',
  category: 'Rendimiento Bancario',
}));

async function run() {
  const total = toAdd.reduce((a, b) => a + Math.abs(b.amount), 0);
  console.log(`Insertando ${toAdd.length} rendimientos faltantes...`);
  console.log(`Suma absoluta: $${total.toFixed(2)}`);
  console.log(`El balance debería BAJAR aprox. $${total.toFixed(2)}\n`);

  const { error } = await sb.from('expenses').insert(toAdd);
  if (error) {
    console.log('ERROR:', error.message);
    return;
  }

  console.log('✅ Todos los rendimientos insertados correctamente.');
  console.log('Por favor revisá el balance en la app y decime cuánto muestra.');
}
run();
