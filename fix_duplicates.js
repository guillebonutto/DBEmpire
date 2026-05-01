const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

// How many times each rendimiento amount appears in the user's list
// (only the small cents-like values that are clearly bank yields)
const userRendimientoCount = {
  6.80: 2, 6.81: 3, 6.82: 2, 6.83: 3, 6.84: 3,
  6.85: 3, 6.86: 3, 6.87: 3, 6.88: 1,
  9.45: 1, 9.46: 1,
  12.14: 1, 12.15: 1, 12.16: 2, 12.17: 1,
  17.66: 2, 17.67: 1,
  20.34: 1, 20.35: 1,
  21.62: 1, 21.82: 1,
  22.03: 1,
  39.34: 1, 39.37: 1,
  41.73: 1,
  42.29: 1, 42.95: 1, 42.98: 1,
  48.08: 1, 48.11: 1, 48.14: 1,
  49.94: 1,
  51.98: 1,
  53.21: 1,
  57.70: 1,
  264.92: 1, 242.03: 1, 242.17: 1,
  6.01: 1, 17.29: 1, 17.30: 1, 14.07: 1, 30.59: 1, 14.08: 1,
  12.85: 1, 12.86: 1,
};

async function run() {
  // Fetch all rendimiento records
  const { data: rends } = await sb
    .from('expenses')
    .select('id, amount, created_at, description')
    .eq('category', 'Rendimiento Bancario')
    .order('amount', { ascending: true });

  console.log(`Total rendimiento records in DB: ${rends.length}`);

  // Group by absolute amount value (they're negative in DB)
  const groups = {};
  rends.forEach(r => {
    const key = Math.round(Math.abs(r.amount) * 100) / 100;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  const toDelete = [];
  const issues = [];

  for (const [amtKey, records] of Object.entries(groups)) {
    const amt = parseFloat(amtKey);
    const expected = userRendimientoCount[amt] || 0;
    const actual = records.length;

    if (actual > expected) {
      const excess = actual - expected;
      // Delete the most recently inserted ones (sort by created_at desc, delete first N)
      const sorted = records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      for (let i = 0; i < excess; i++) {
        toDelete.push(sorted[i]);
      }
      console.log(`DUPLICATE: amount=${amt} | DB has ${actual}, list expects ${expected} → deleting ${excess}`);
    } else if (actual < expected) {
      issues.push({ amt, expected, actual, missing: expected - actual });
      console.log(`MISSING: amount=${amt} | DB has ${actual}, list expects ${expected}`);
    }
  }

  // Also check for amounts in user list not in DB at all
  for (const [amt, count] of Object.entries(userRendimientoCount)) {
    const dbCount = groups[parseFloat(amt)]?.length || 0;
    if (dbCount === 0 && count > 0) {
      issues.push({ amt: parseFloat(amt), expected: count, actual: 0, missing: count });
      console.log(`COMPLETELY MISSING: amount=${amt} | needs ${count} in DB`);
    }
  }

  if (toDelete.length === 0) {
    console.log('\nNo duplicates found to delete.');
  } else {
    console.log(`\nDeleting ${toDelete.length} duplicate records...`);
    const duplicateSum = toDelete.reduce((a, b) => a + Math.abs(b.amount), 0);
    console.log(`Total being removed from balance: -$${duplicateSum.toFixed(2)}`);
    for (const rec of toDelete) {
      const { error } = await sb.from('expenses').delete().eq('id', rec.id);
      if (error) console.log(`  ERROR deleting ${rec.id}: ${error.message}`);
      else console.log(`  Deleted: id=${rec.id}, amount=${rec.amount}, date=${rec.created_at.substring(0, 10)}`);
    }
  }

  if (issues.length > 0) {
    console.log('\n⚠️  Items in your list NOT in DB (need to add):');
    issues.forEach(i => console.log(`  +$${i.amt} × ${i.missing}`));
  }

  console.log('\nDONE');
}
run();
