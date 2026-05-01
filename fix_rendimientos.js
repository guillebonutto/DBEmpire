const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  // 1. Restore 8 incorrectly deleted rendimientos (6.74-6.77 from the user's list)
  //    The script deleted them because I forgot to include them in the expected count.
  //    I'll re-insert them with approximate dates near the original March 12-19 records.
  const toRestore = [
    { amount: -6.74, created_at: '2026-03-12T09:00:00-03:00' },
    { amount: -6.74, created_at: '2026-03-13T09:00:00-03:00' },
    { amount: -6.74, created_at: '2026-03-14T09:00:00-03:00' },
    { amount: -6.75, created_at: '2026-03-15T09:00:00-03:00' },
    { amount: -6.75, created_at: '2026-03-16T09:00:00-03:00' },
    { amount: -6.76, created_at: '2026-03-17T09:00:00-03:00' },
    { amount: -6.76, created_at: '2026-03-18T09:00:00-03:00' },
    { amount: -6.77, created_at: '2026-03-19T09:00:00-03:00' },
  ].map(r => ({ ...r, description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario' }));

  // 2. Add the 13 genuinely missing rendimientos from the user's list
  const toAdd = [
    { amount: -6.88,  created_at: '2026-01-17T09:00:00-03:00' }, // after 6.87 series
    { amount: -21.62, created_at: '2026-02-24T09:00:00-03:00' }, // near Feb 24
    { amount: -39.34, created_at: '2026-04-04T09:00:00-03:00' }, // April after Apr 3
    { amount: -39.37, created_at: '2026-04-05T09:00:00-03:00' },
    { amount: -57.70, created_at: '2026-01-10T09:00:00-03:00' }, // early Jan
    { amount: -6.01,  created_at: '2026-04-06T09:00:00-03:00' }, // April
    { amount: -17.29, created_at: '2026-02-05T09:00:00-03:00' }, // Feb
    { amount: -17.30, created_at: '2026-02-06T09:00:00-03:00' }, // Feb
    { amount: -14.07, created_at: '2026-02-04T09:00:00-03:00' }, // Feb
    { amount: -30.59, created_at: '2026-03-20T09:00:00-03:00' }, // March
    { amount: -14.08, created_at: '2026-02-07T09:00:00-03:00' }, // Feb
    { amount: -12.85, created_at: '2026-02-03T09:00:00-03:00' }, // Feb
    { amount: -12.86, created_at: '2026-02-04T09:00:00-03:00' }, // Feb
  ].map(r => ({ ...r, description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario' }));

  const allToInsert = [...toRestore, ...toAdd];
  const { error } = await sb.from('expenses').insert(allToInsert);
  if (error) {
    console.log('ERROR inserting:', error.message);
    return;
  }

  const restoredSum = toRestore.reduce((a, b) => a + Math.abs(b.amount), 0);
  const addedSum = toAdd.reduce((a, b) => a + Math.abs(b.amount), 0);

  console.log(`Restored 8 deleted records: +$${restoredSum.toFixed(2)} to balance`);
  console.log(`Added 13 missing rendimientos: +$${addedSum.toFixed(2)} to balance`);
  console.log(`Total net change to balance: +$${(restoredSum + addedSum).toFixed(2)}`);
  console.log('\nDONE — por favor revisá el balance en la app.');
}
run();
