const fetch = require('node-fetch');
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

(async () => {
    try {
        const res = await fetch('https://kxnqheckujcoytnfmxcd.supabase.co/functions/v1/evaluate-ai-actions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${ANON}`,
                'Content-Type': 'application/json'
            },
            body: '{}'
        });
        const text = await res.text();
        console.log(`STATUS: ${res.status}`);
        console.log(`BODY: ${text}`);
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
