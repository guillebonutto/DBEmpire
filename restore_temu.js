const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  // 1. Restore the deleted Temu discount income record
  const { data: ins, error: insErr } = await sb.from('expenses').insert({
    amount: -20856,
    description: 'Descuento tiempo limitado Temu',
    category: 'Ingreso',
    created_at: '2026-01-14T12:00:00Z'
  });
  console.log('Temu restored:', insErr ? insErr.message : 'OK');

  // 2. Fix Mariela Castelli sale from 9600 to 10000
  const { error: marErr } = await sb.from('sales')
    .update({ total_amount: 10000 })
    .eq('id', '370e4f41-a4cd-4211-ada3-38c973fd7fbd');
  console.log('Mariela fixed:', marErr ? marErr.message : 'OK');

  // 3. Add the 3 new rendimientos (264.92, 242.03, 242.17)
  const { error: rendErr } = await sb.from('expenses').insert([
    { amount: -264.92, description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario', created_at: '2026-04-10T12:00:00Z' },
    { amount: -242.03, description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario', created_at: '2026-04-11T12:00:00Z' },
    { amount: -242.17, description: 'Rendimiento bancario (acreditado por billetera)', category: 'Rendimiento Bancario', created_at: '2026-04-12T12:00:00Z' }
  ]);
  console.log('Rendimientos added:', rendErr ? rendErr.message : 'OK');

  // 4. Check final balance
  const { data: s } = await sb.from('sales').select('total_amount');
  const { data: e } = await sb.from('expenses').select('amount');
  const bal = s.reduce((a,b)=>a+(b.total_amount||0),0) - e.reduce((a,b)=>a+(b.amount||0),0);
  console.log('BALANCE FINAL:', bal);
}
run();
