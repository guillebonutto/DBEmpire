const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  // Check the $400k sale specifically
  const { data: big } = await sb.from('sales')
    .select('id, total_amount, status, notes, created_at, profit_generated')
    .gte('total_amount', 390000)
    .order('created_at');

  console.log('=== VENTAS >= $390.000 ===');
  big.forEach(s => {
    const d = new Date(s.created_at);
    const valid = ['completed','exitosa','vended',''].includes((s.status||'').toLowerCase());
    console.log(`  $${s.total_amount} | ${s.created_at.substring(0,10)} | status: "${s.status}" | contada: ${valid ? '✅ SÍ' : '❌ NO'} | profit: ${s.profit_generated} | ${(s.notes||'').substring(0,40)}`);
  });

  // Full balance simulation including ALL months (to show where the $400k falls)
  const { data: sales } = await sb.from('sales').select('id,total_amount,status,created_at');
  const { data: expenses } = await sb.from('expenses').select('id,amount,created_at,category,description');

  const now = new Date();
  const year = 2026;
  // Simulate MONTH filter for each month of 2026
  for (let month = 0; month < 4; month++) {
    const startMs = new Date(year, month, 1).getTime();
    const endMs   = new Date(year, month + 1, 0, 23, 59, 59, 999).getTime();
    let prevIncome = 0, prevExpCaja = 0, totalSales = 0, bankYields = 0, opExp = 0, debtPay = 0;

    for (const s of sales) {
      const t = new Date(s.created_at).getTime();
      const st = (s.status||'').toLowerCase();
      const ok = st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
      if (!ok) continue;
      if (t < startMs) prevIncome += parseFloat(s.total_amount)||0;
      else if (t <= endMs) totalSales += parseFloat(s.total_amount)||0;
    }
    for (const e of expenses) {
      const t = new Date(e.created_at).getTime();
      const v = parseFloat(e.amount)||0;
      const isDebt  = e.category === 'Pago de Deuda';
      const isYield = e.category === 'Rendimiento Bancario';
      const desc = (e.description||'').toLowerCase();
      const isStock = desc.includes('consolidado')||desc.includes('consignacion')||desc.includes('crédito')||desc.includes('credito');
      if (t < startMs) { if (!isStock) prevExpCaja += v; }
      else if (t <= endMs) {
        if (isYield) bankYields += v;
        else if (isDebt) debtPay += v;
        else opExp += v;
      }
    }
    const netCaja = (prevIncome - prevExpCaja) + totalSales + bankYields - opExp - debtPay;
    const mNames = ['Enero','Febrero','Marzo','Abril'];
    console.log(`\n${mNames[month]} 2026: netCaja = $${netCaja.toFixed(2)}`);
    console.log(`  prevIncome=$${prevIncome.toFixed(0)}  prevExpCaja=$${prevExpCaja.toFixed(0)}  totalSales=$${totalSales.toFixed(0)}  debtPay=$${debtPay.toFixed(0)}  bankYields=$${bankYields.toFixed(0)}  opExp=$${opExp.toFixed(0)}`);
  }
}
run();
