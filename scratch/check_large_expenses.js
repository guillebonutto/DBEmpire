const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  'https://kxnqheckujcoytnfmxcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8'
);

async function run() {
  const { data: expenses } = await sb.from('expenses').select('*').order('amount', { ascending: false });
  console.log("Total expenses fetched:", expenses.length);
  console.log("Top 15 largest expenses:");
  expenses.slice(0, 15).forEach((e, idx) => {
    console.log(`${idx+1}. Date: ${e.created_at} | Amount: $${e.amount} | Cat: ${e.category} | Desc: ${e.description}`);
  });
}
run();
