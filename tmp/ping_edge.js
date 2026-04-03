const fetch = require('node-fetch');

(async () => {
    try {
        const res = await fetch('https://kxnqheckujcoytnfmxcd.supabase.co/functions/v1/evaluate-ai-actions', {
            method: 'POST',
            body: '{}'
        });
        const text = await res.text();
        console.log(`STATUS: ${res.status}`);
        console.log(`BODY: ${text}`);
    } catch (e) {
        console.error('Error:', e.message);
    }
})();
