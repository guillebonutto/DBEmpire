const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

// User's manual list - note the "+17,3+14,07" is split into two values
const listRaw = `+12500 +6.85 +64670 +42.29 +33170 -2100 +39.34 +39.37 -3100 +2600 +57.7 -95556 +6.8 +6.8 +6.81 +6.81 +6.81 +6.82 +6.82 +6.83 +6.83 +6.83 +6.84 +6.84 +6.84 +6.85 +6.85 +6.86 +6.86 +6.86 +6.87 +6.87 +6.87 +6.88 +3200 +6400 +12.14 +12.15 +12.16 +12.16 +12.17 +10000 +17.66 +17.66 +17.67 +20.34 -32294.11 +20.35 +4000 -4000 +34600 -27152 +21.62 +3200 +6.74 +6.74 +6.74 +6.75 +6.75 +6.76 +6.76 +6.77 -10744.18 +15000 +9.45 +9.46 +51200 +41.73 +1900 +42.95 +42.98 -4000 +15000 -3000 +49.94 +48.08 +48.11 +48.14 +8000 +53.21 -2000 +10816.92 +6.01 +51.98 -58415.92 -3770.06 +22.03 -3770.06 +17.29 -5139.28 +17.3 +14.07 +30.59 +14.08 -2000 +12.85 +12.86 +400000 +264.92 +242.03 +242.17`;

const userItems = listRaw.trim().split(/\s+/).filter(Boolean).map(x => {
  const v = parseFloat(x.replace('−', '-'));
  return v;
}).filter(x => !isNaN(x));

const userSum = userItems.reduce((a, b) => a + b, 0);
console.log('User list sum:', userSum.toFixed(2));
console.log('User item count:', userItems.length);

async function run() {
  const { data: sales } = await sb.from('sales').select('total_amount, id, notes, status');
  const { data: expenses } = await sb.from('expenses').select('amount, id, description, category');

  // Build DB items using the same sign convention as the user list
  // Sales = positive (income)
  // Expenses = negative (outgo), but some expenses have negative amounts (= income like rendimientos)
  let dbItems = [
    ...sales.map(x => ({ v: x.total_amount, id: x.id, label: `SALE: ${x.notes || x.status || ''}`, type: 'sale' })),
    ...expenses.map(x => ({ v: -x.amount, id: x.id, label: `EXP: ${x.description || x.category}`, type: 'expense' }))
  ];

  const userCopy = [...userItems];
  const extraInDb = [];

  dbItems.forEach(dbItem => {
    const idx = userCopy.findIndex(u => Math.abs(u - dbItem.v) < 0.05);
    if (idx > -1) {
      userCopy.splice(idx, 1);
    } else {
      extraInDb.push(dbItem);
    }
  });

  const extraSum = extraInDb.reduce((a, b) => a + b.v, 0);
  console.log('\n== Items in DB but NOT in your list ==');
  extraInDb.forEach(x => console.log(`  ${x.v > 0 ? '+' : ''}${x.v.toFixed(2)}  [${x.type}] ${x.label.substring(0, 60)}`));
  console.log('\nExtra sum in DB:', extraSum.toFixed(2));

  const missingSum = userCopy.reduce((a, b) => a + b, 0);
  console.log('\n== Items in your list NOT in DB ==');
  userCopy.forEach(x => console.log(`  ${x > 0 ? '+' : ''}${x.toFixed(2)}`));
  console.log('Missing sum:', missingSum.toFixed(2));
  console.log('\nNet difference (DB extra - Missing from DB):', (extraSum - missingSum).toFixed(2));
}
run();
