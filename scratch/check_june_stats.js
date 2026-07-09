const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  const { data: sales } = await sb.from('sales').select('*');
  const { data: expenses } = await sb.from('expenses').select('*');

  // June 2026
  const targetYear = 2026;
  const targetMonth = 5; // June is 0-indexed index 5
  
  const startMs = new Date(targetYear, targetMonth, 1).getTime();
  const endMs = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999).getTime();

  console.log(`Filtering from ${new Date(startMs).toISOString()} to ${new Date(endMs).toISOString()}`);

  let prevIncome = 0, prevExpCaja = 0, prevExpROI = 0, prevYields = 0;
  const currentSales = [];
  const currentExpenses = [];

  for (const s of (sales || [])) {
      const saleDate = s.paid_at || s.created_at;
      const sMs = new Date(saleDate).getTime();
      if (sMs < startMs) {
          const st = (s.status || '').toLowerCase();
          if (st === 'completed' || st === 'exitosa' || st === 'vended' || st === '') {
              prevIncome += (parseFloat(s.total_amount) || 0);
          }
      } else if (!endMs || sMs <= endMs) {
          currentSales.push(s);
      }
  }

  for (const e of (expenses || [])) {
      const eMs = new Date(e.created_at).getTime();
      const val = parseFloat(e.amount) || 0;
      const isDebtPayment = e.category === 'Pago de Deuda';
      const isBankYield = e.category === 'Rendimiento Bancario';
      const desc = (e.description || '').toLowerCase();
      const isInitialCreditStock = desc.includes('crédito') || desc.includes('credito') || desc.includes('consignacion') || desc.includes('consignación') || desc.includes('consolidado') || desc.startsWith('inventario:');

      if (eMs < startMs) {
          if (isBankYield) {
              prevYields += Math.abs(val);
          } else if (!isInitialCreditStock) {
              prevExpCaja += val;
          }
          if (!isDebtPayment && !isBankYield) prevExpROI += val;
      } else if (!endMs || eMs <= endMs) {
          currentExpenses.push(e);
      }
  }

  const histBalCaja = prevIncome - prevExpCaja + prevYields;
  const histBalROI = prevIncome - prevExpROI;

  const finalSales = currentSales.filter(s => {
      const st = (s.status || '').toLowerCase();
      return st === 'completed' || st === 'exitosa' || st === 'vended' || st === '';
  });

  const totalSales = finalSales.reduce((sum, s) => sum + (parseFloat(s.total_amount) || 0), 0);
  const grossProfit = finalSales.reduce((sum, s) => sum + (parseFloat(s.profit_generated) || 0), 0);
  
  const isDebtPayment   = (e) => e.category === 'Pago de Deuda';
  const isBankYield     = (e) => e.category === 'Rendimiento Bancario';

  const operatingExpenses = currentExpenses.reduce((sum, e) =>
      isDebtPayment(e) || isBankYield(e) ? sum : sum + (parseFloat(e.amount) || 0), 0);
  const debtPayments      = currentExpenses.reduce((sum, e) =>
      isDebtPayment(e) ? sum + (parseFloat(e.amount) || 0) : sum, 0);
  const bankYields        = currentExpenses.reduce((sum, e) =>
      isBankYield(e) ? sum + Math.abs(parseFloat(e.amount) || 0) : sum, 0);

  const operatingExpensesForCaja = currentExpenses.reduce((sum, e) => {
      const isInitialCreditStock = (e.description || '').toLowerCase().includes('crédito') || (e.description || '').toLowerCase().includes('consolidado') || (e.description || '').toLowerCase().startsWith('inventario:');
      return isDebtPayment(e) || isBankYield(e) || isInitialCreditStock ? sum : sum + (parseFloat(e.amount) || 0);
  }, 0);
      
  const totalExpensesCaja = operatingExpensesForCaja + debtPayments;

  const netCaja   = histBalCaja + totalSales + bankYields - totalExpensesCaja;
  const netProfit = histBalROI  + totalSales - operatingExpenses;

  console.log(`\n=== STASTS FOR JUNE 2026 ===`);
  console.log(`prevIncome:       $${prevIncome.toFixed(2)}`);
  console.log(`prevExpROI:       $${prevExpROI.toFixed(2)}`);
  console.log(`histBalROI:       $${histBalROI.toFixed(2)}`);
  console.log(`totalSales (Jun): $${totalSales.toFixed(2)}`);
  console.log(`grossProfit(Jun): $${grossProfit.toFixed(2)}`);
  console.log(`opExpenses (Jun): $${operatingExpenses.toFixed(2)}`);
  console.log(`-----------------------------`);
  console.log(`netProfit (ROI):  $${netProfit.toFixed(2)}`);
  console.log(`netCaja (Caja):   $${netCaja.toFixed(2)}`);

  console.log(`\n=== ALL SALES IN JUNE ===`);
  finalSales.forEach(s => {
      console.log(`Sale ID: ${s.id.slice(0,8)} | Total: $${s.total_amount} | Paid At: ${s.paid_at || s.created_at} | Created At: ${s.created_at}`);
  });
}
run();
