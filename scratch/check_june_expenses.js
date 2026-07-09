const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  const { data: expenses } = await sb.from('expenses').select('*');
  const juneExpenses = expenses.filter(e => e.created_at.startsWith('2026-06'));
  console.log("June 2026 Expenses count:", juneExpenses.length);
  juneExpenses.forEach(e => {
    console.log(`Date: ${e.created_at} | Amount: $${e.amount} | Cat: ${e.category} | Desc: ${e.description}`);
  });
}
run();
