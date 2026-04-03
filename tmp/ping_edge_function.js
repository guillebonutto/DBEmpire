/**
 * ping_edge_function.js
 * Verifica que la Edge Function evaluate-ai-actions responde.
 * Corre: node tmp/ping_edge_function.js
 */
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const URL = 'https://kxnqheckujcoytnfmxcd.supabase.co/functions/v1/evaluate-ai-actions';

async function ping() {
    console.log('\n🏓 Haciendo ping a la Edge Function...\n');
    console.log(`  URL: ${URL}\n`);
    try {
        const res = await fetch(URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ANON_KEY}`
            },
            body: '{}'
        });
        const text = await res.text();
        console.log(`  Status HTTP: ${res.status}`);
        console.log(`  Respuesta: ${text}`);

        if (res.status === 200) {
            console.log('\n✅ Edge Function ACTIVA y respondiendo correctamente.');
            try {
                const parsed = JSON.parse(text);
                console.log(`  → Acciones evaluadas: ${parsed.evaluated}`);
                console.log(`  → Acciones salteadas: ${parsed.skipped}`);
            } catch {}
        } else if (res.status === 401) {
            console.log('\n⚠️  Necesita autenticación (normal con anon key si la función requiere service_role).');
            console.log('   La función está deployada. El cron usará el service_role_key en producción.');
        } else if (res.status === 404) {
            console.log('\n❌ Edge Function no encontrada. Verificá el deploy.');
        } else {
            console.log(`\n⚠️  Status inesperado: ${res.status}`);
        }
    } catch (e) {
        console.log(`\n❌ Error de red: ${e.message}`);
    }
}
ping();
