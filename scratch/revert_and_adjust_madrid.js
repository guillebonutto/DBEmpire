const https = require('https');

const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

function patchRequest(path, payload) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify(payload);
        const options = {
            hostname: 'kxnqheckujcoytnfmxcd.supabase.co',
            path: path,
            method: 'PATCH',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch (e) {
                    resolve({ status: res.statusCode, raw: data });
                }
            });
        });

        req.on('error', (e) => {
            reject(e);
        });

        req.write(postData);
        req.end();
    });
}

async function run() {
    try {
        console.log("=== AJUSTANDO VENTA DE GABRIEL LA MADRID (MARZO 28 CON PAGO JUNIO 15) ===");
        
        const saleUpdate = {
            status: 'completed',
            created_at: '2026-03-28T13:21:52.918507-03:00', // Revertir a fecha original
            paid_at: '2026-06-15T20:00:00.000-03:00',      // Asignar cobro a ayer 15/06
            notes: 'Deuda original del 28/03/2026. Pagado con dinero de Nico por trueque con su papá Gabriel La Madrid.'
        };
        
        console.log("Enviando PATCH a Supabase...");
        const res = await patchRequest('/rest/v1/sales?id=eq.70ef9e8c-0820-411d-9310-2a4c5e238d04', saleUpdate);
        
        console.log("Status Code:", res.status);
        if (res.data) {
            console.log("Resultado:", JSON.stringify(res.data, null, 2));
        } else {
            console.log("Raw Response:", res.raw);
        }
        
        if (res.status === 200) {
            console.log("\n🎉 Venta de Gabriel La Madrid actualizada exitosamente en Supabase!");
        } else {
            console.log("\n❌ Falló la actualización. Asegúrate de haber agregado la columna paid_at en Supabase.");
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
}

run();
