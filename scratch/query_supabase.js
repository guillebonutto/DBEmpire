const https = require('https');

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

function makeRequest(path, label) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'kxnqheckujcoytnfmxcd.supabase.co',
      path: path,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const items = JSON.parse(data);
          console.log(`\n=== ${label} (${Array.isArray(items) ? items.length : 'error'}) ===`);
          if (Array.isArray(items)) {
            items.forEach((s) => {
              if (label === 'SALES') {
                console.log(`ID: ${s.id} | Amount: ${s.total_amount} | Created: ${s.created_at} | Notes: ${s.notes}`);
              } else if (label === 'ACTIVITY LOGS') {
                console.log(`Time: ${s.created_at} | Type: ${s.action_type} | Desc: ${s.description} | Meta: ${JSON.stringify(s.metadata)}`);
              }
            });
          } else {
            console.log("Unexpected response format:", data);
          }
        } catch (e) {
          console.error("Failed to parse response:", e.message);
          console.log("Raw Response:", data);
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.error(`HTTP Request Error [${label}]:`, e.message);
      resolve();
    });

    req.end();
  });
}

async function run() {
  await makeRequest('/rest/v1/sales?select=*&order=created_at.desc&limit=10', 'SALES');
  await makeRequest('/rest/v1/activity_logs?select=*&order=created_at.desc&limit=20', 'ACTIVITY LOGS');
}

run();

