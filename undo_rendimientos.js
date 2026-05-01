const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

// Exact records inserted by fix_rendimientos.js - delete by amount + date prefix
const inserted = [
  { amount: -6.74,  date: '2026-03-12' },
  { amount: -6.74,  date: '2026-03-13' },
  { amount: -6.74,  date: '2026-03-14' },
  { amount: -6.75,  date: '2026-03-15' },
  { amount: -6.75,  date: '2026-03-16' },
  { amount: -6.76,  date: '2026-03-17' },
  { amount: -6.76,  date: '2026-03-18' },
  { amount: -6.77,  date: '2026-03-19' },
  { amount: -6.88,  date: '2026-01-17' },
  { amount: -21.62, date: '2026-02-24' },
  { amount: -39.34, date: '2026-04-04' },
  { amount: -39.37, date: '2026-04-05' },
  { amount: -57.70, date: '2026-01-10' },
  { amount: -6.01,  date: '2026-04-06' },
  { amount: -17.29, date: '2026-02-05' },
  { amount: -17.30, date: '2026-02-06' },
  { amount: -14.07, date: '2026-02-04' },
  { amount: -30.59, date: '2026-03-20' },
  { amount: -14.08, date: '2026-02-07' },
  { amount: -12.85, date: '2026-02-03' },
  { amount: -12.86, date: '2026-02-04' },
];

async function run() {
  // Fetch all rendimientos to find exact IDs of what I inserted
  const { data: rends } = await sb
    .from('expenses')
    .select('id, amount, created_at')
    .eq('category', 'Rendimiento Bancario');

  const toDeleteIds = [];
  const usedRends = [...rends];

  for (const ins of inserted) {
    const idx = usedRends.findIndex(r =>
      Math.abs(r.amount - ins.amount) < 0.005 &&
      r.created_at.startsWith(ins.date)
    );
    if (idx > -1) {
      toDeleteIds.push(usedRends[idx].id);
      usedRends.splice(idx, 1);
    } else {
      console.log(`NOT FOUND: amount=${ins.amount} date=${ins.date}`);
    }
  }

  console.log(`Found ${toDeleteIds.length} of 21 inserted records to delete`);

  for (const id of toDeleteIds) {
    const { error } = await sb.from('expenses').delete().eq('id', id);
    if (error) console.log(`ERROR deleting ${id}: ${error.message}`);
  }

  console.log('Records deleted. Por favor revisá el balance ahora.');
}
run();
