const https = require('https');

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const options = {
  hostname: 'kxnqheckujcoytnfmxcd.supabase.co',
  path: '/rest/v1/ai_action_logs?select=*&limit=5',
  method: 'GET',
  headers: {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
  }
};

console.log("Checking if ai_action_logs table exists and listing rows...");
const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log("Response status:", res.statusCode);
    try {
      const rows = JSON.parse(data);
      console.log("Result rows count:", Array.isArray(rows) ? rows.length : 'error');
      if (Array.isArray(rows)) {
        console.log("Sample row keys:", rows.length > 0 ? Object.keys(rows[0]) : "No rows found");
        console.log("Rows:", JSON.stringify(rows, null, 2));
      } else {
        console.log("Response:", data);
      }
    } catch (e) {
      console.log("Raw Response:", data);
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});

req.end();
