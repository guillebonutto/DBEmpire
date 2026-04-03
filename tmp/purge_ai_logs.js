const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://kxnqheckujcoytnfmxcd.supabase.co';
// Usa la anon key que estaba en test_ai_loop
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

// Usamos el Service Role Key del entorno (si está) o anon temporalmente si RLS update lo permite.
// Nota: como acabamos de dar bypass al RLS, el anon key debería dejar borrar todo con un match simple,
// ¡PERO delete all requiere permisos extra a veces! Mejor usemos el select + iteración si no nos deja truncate.
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function purgeAll() {
    console.log("🧹 Purgando la memoria de la IA (eliminando tests)...");
    
    // Primero obtenemos todos los IDs
    const { data: logs, error: fetchErr } = await supabase.from('ai_action_logs').select('id');
    if (fetchErr) {
        console.error("❌ Error leyendo:", fetchErr.message);
        return;
    }
    
    if (!logs || logs.length === 0) {
        console.log("✅ La tabla ya está vacía.");
        return;
    }
    
    console.log(`Encontrados ${logs.length} registros falsos. Procediendo a eliminar...`);
    
    // Al no tener RPC para TRUNCATE con anon key, borramos con un `.in` masivo o uno por uno
    const ids = logs.map(l => l.id);
    const { error: delErr } = await supabase.from('ai_action_logs').delete().in('id', ids);
    
    if (delErr) {
        console.error("❌ Error borrando:", delErr.message);
    } else {
        console.log("🚀 Misiones de testeo borradas exitosamente.");
        console.log("✅ El motor de IA arranca desde 0 de forma completamente limpia y real.");
    }
}

purgeAll();
