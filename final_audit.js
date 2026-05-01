const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

const userList = [
  12500, 6.85, 64670, 42.29, 33170, -2100, 39.34, 39.37, -3100,
  2600, 57.7, -95556, 6.8, 6.8, 6.81, 6.81, 6.81, 6.82, 6.82,
  6.83, 6.83, 6.83, 6.84, 6.84, 6.84, 6.85, 6.85, 6.86, 6.86,
  6.86, 6.87, 6.87, 6.87, 6.88, 3200, 6400, 12.14, 12.15, 12.16,
  12.16, 12.17, 10000, 17.66, 17.66, 17.67, 20.34, -32294.11,
  20.35, 4000, -4000, 34600, -27152, 21.62, 3200, 6.74, 6.74,
  6.74, 6.75, 6.75, 6.76, 6.76, 6.77, -10744.18, 15000, 9.45,
  9.46, 51200, 41.73, 1900, 42.95, 42.98, -4000, 15000, -3000,
  49.94, 48.08, 48.11, 48.14, 8000, 53.21, -2000, 10816.92,
  6.01, 51.98, -58415.92, -3770.06, 22.03, -3770.06, 17.29,
  -5139.28, 17.3, 14.07, 30.59, 14.08, -2000, 12.85, 12.86,
  400000, 264.92, 242.03, 242.17
];

async function run() {
  const { data: sales } = await sb.from('sales').select('id, total_amount, status, notes');
  const { data: expenses } = await sb.from('expenses').select('id, amount, description, category');

  // Replicate audit_reverse approach - work out what's extra in DB
  let dbItems = [
    ...sales.map(s => ({ v: s.total_amount, id: s.id, label: `SALE ${s.total_amount} [${s.status}] ${(s.notes||'').substring(0,40)}`, type: 'sale' })),
    ...expenses.map(e => ({ v: -e.amount, id: e.id, label: `EXP ${-e.amount} [${e.category||''}] ${(e.description||'').substring(0,40)}`, type: 'expense' }))
  ];

  const remaining = [...userList];
  const extraInDb = [];

  for (const item of dbItems) {
    const idx = remaining.findIndex(u => Math.abs(u - item.v) < 0.05);
    if (idx > -1) {
      remaining.splice(idx, 1);
    } else {
      extraInDb.push(item);
    }
  }

  // Focus: positives in DB not in user list (these inflate balance)
  const extraPositive = extraInDb.filter(x => x.v > 0);
  const extraNegative = extraInDb.filter(x => x.v < 0);

  const posSum = extraPositive.reduce((a, b) => a + b.v, 0);
  const negSum = extraNegative.reduce((a, b) => a + b.v, 0);
  const missSum = remaining.reduce((a, b) => a + b, 0);

  console.log('=== EXTRA POSITIVE in DB (inflating balance) ===');
  extraPositive.forEach(x => console.log(`  +${x.v.toFixed(2)}  ${x.label}`));
  console.log(`  TOTAL EXTRA POSITIVE: +${posSum.toFixed(2)}`);

  console.log('\n=== MISSING from DB (in user list but not DB) ===');
  remaining.filter(x => x > 0).forEach(x => console.log(`  +${x.toFixed(2)}`));
  remaining.filter(x => x < 0).forEach(x => console.log(`  ${x.toFixed(2)}`));
  console.log(`  MISSING SUM: ${missSum.toFixed(2)}`);

  console.log(`\n=== NET EFFECT ===`);
  console.log(`  Extra positive in DB: +${posSum.toFixed(2)}`);
  console.log(`  Missing positives from DB: -${remaining.filter(x=>x>0).reduce((a,b)=>a+b,0).toFixed(2)}`);
  console.log(`  Extra negative in DB: ${negSum.toFixed(2)} (these REDUCE balance)`);
  console.log(`  Missing negatives from DB: +${Math.abs(remaining.filter(x=>x<0).reduce((a,b)=>a+b,0)).toFixed(2)} (these would REDUCE if added)`);
}
run();
