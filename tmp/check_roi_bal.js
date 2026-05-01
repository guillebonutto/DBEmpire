const { createClient } = require('@supabase/supabase-js');
const sb = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');
async function run() {
  const {data: sales} = await sb.from('sales').select('*');
  const {data: expenses} = await sb.from('expenses').select('*');
  let prevIncome = 0;
  let prevExpROI = 0;
  let startMs = new Date(2026, 3, 1).getTime(); // April 1st
  let prevProfit = 0;
  
  sales.forEach(s => {
    if(new Date(s.created_at).getTime() < startMs && ['completed','exitosa','vended',''].includes((s.status||'').toLowerCase())) {
        prevIncome += parseFloat(s.total_amount)||0;
        prevProfit += parseFloat(s.profit_generated)||0;
    }
  });
  expenses.forEach(e => {
    let eMs = new Date(e.created_at).getTime();
    if(eMs < startMs) {
      if(e.category !== 'Pago de Deuda') {
          prevExpROI += parseFloat(e.amount)||0;
      }
    }
  });
  console.log('April histBalROI (using Income):', prevIncome - prevExpROI);
  console.log('April histBalROI (using Profit):', prevProfit - prevExpROI);
  console.log('prevIncome:', prevIncome, 'prevProfit:', prevProfit, 'prevExpROI:', prevExpROI);
}
run();
