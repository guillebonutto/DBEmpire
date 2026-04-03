/**
 * setup_supabase.js
 * Verifica estructura de la tabla y crea lo que pueda con el anon key.
 * Para DDL (CREATE TABLE, ALTER, VIEW, CRON) necesita ejecutarse en el SQL Editor.
 * 
 * Corre: node tmp/setup_supabase.js
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const ok  = (msg) => console.log(`✅ ${msg}`);
const fail= (msg) => console.log(`❌ ${msg}`);
const info= (msg) => console.log(`ℹ️  ${msg}`);
const sep = ()    => console.log('─'.repeat(55));

async function checkTable(tableName) {
    const { data, error } = await supabase.from(tableName).select('id').limit(1);
    return !error;
}

async function run() {
    console.log('\n🔍 EMPIRE AI — VERIFICACIÓN DE ESTRUCTURA EN SUPABASE\n');
    sep();

    // 1. Conexión
    const { data: pingData, error: pingErr } = await supabase.from('settings').select('key').limit(1);
    if (pingErr) { fail(`Conexión fallida: ${pingErr.message}`); process.exit(1); }
    ok('Conexión a Supabase exitosa.');
    sep();

    // 2. Verificar tablas críticas
    const tables = ['sales', 'expenses', 'products', 'settings', 'ai_action_logs'];
    console.log('\n📋 Estado de tablas:\n');
    const missing = [];
    for (const t of tables) {
        const exists = await checkTable(t);
        if (exists) ok(`Tabla '${t}' → EXISTE`);
        else { fail(`Tabla '${t}' → NO ENCONTRADA`); missing.push(t); }
    }

    sep();

    // 3. Verificar vista ai_action_performance
    console.log('\n📊 Verificando vista ai_action_performance...\n');
    const { data: viewData, error: viewErr } = await supabase
        .from('ai_action_performance')
        .select('*')
        .limit(1);
    if (viewErr) {
        fail(`Vista 'ai_action_performance' no existe todavía.`);
        info('Necesitás ejecutar el SQL del tmp/create_ai_action_logs.js en Supabase SQL Editor.');
    } else {
        ok('Vista ai_action_performance → EXISTE');
    }

    sep();

    // 4. Verificar columnas nuevas de ai_action_logs
    if (missing.includes('ai_action_logs')) {
        fail('Saltando verificación de columnas: la tabla ai_action_logs no existe aún.');
    } else {
        console.log('\n🔬 Verificando columnas de ai_action_logs...\n');
        const { data: sampleRow, error: sampleErr } = await supabase
            .from('ai_action_logs')
            .select('id, action_hash, confidence_score, evaluation_status')
            .limit(1);

        if (sampleErr) {
            fail(`Columnas faltantes (action_hash, confidence_score, evaluation_status): ${sampleErr.message}`);
            info('Ejecutá el bloque SQL de tmp/create_ai_action_logs.js para agregarlas.');
        } else {
            ok('Columnas action_hash, confidence_score, evaluation_status → EXISTEN');
        }
    }

    sep();

    // 5. Insertar un registro de prueba rápida
    if (!missing.includes('ai_action_logs')) {
        console.log('\n🧪 Test de inserción en ai_action_logs...\n');
        const testHash = `verify_${Date.now()}`;
        const { data: ins, error: insErr } = await supabase
            .from('ai_action_logs')
            .insert({
                title: '[VERIFY] Test de sistema',
                action_type: 'general',
                impact_predicted: 'low',
                context_snapshot: { monthlyProfit: 0, monthlyRevenue: 0 },
                executed: false,
                evaluation_window_hours: 0,
                action_hash: testHash,
                confidence_score: 1,
                evaluation_status: 'pending'
            })
            .select('id')
            .single();

        if (insErr) {
            fail(`Inserción fallida: ${insErr.message}`);
            if (insErr.message.includes('unique')) info('action_hash ya existe (normal si corriste el test antes).');
        } else {
            ok(`Inserción OK (id: ${ins.id}). Limpiando...`);
            await supabase.from('ai_action_logs').delete().eq('id', ins.id);
            ok('Registro de prueba eliminado.');
        }
    }

    sep();
    console.log('\n📋 RESUMEN DE ACCIONES NECESARIAS:\n');

    if (missing.includes('ai_action_logs')) {
        console.log('  1. ⚠️  Ejecutar el SQL de tmp/create_ai_action_logs.js en Supabase SQL Editor');
    } else {
        console.log('  1. ✅ Tabla ai_action_logs OK');
    }

    if (viewErr) {
        console.log('  2. ⚠️  Ejecutar el SQL (al menos el bloque CREATE VIEW) en Supabase SQL Editor');
    } else {
        console.log('  2. ✅ Vista ai_action_performance OK');
    }

    console.log('  3. 🔑 Deploy Edge Function (requiere tu service_role_key y project_ref)');
    console.log('     → npx supabase functions deploy evaluate-ai-actions --project-ref kxnqheckujcoytnfmxcd');
    console.log('\n🏁 Verificación completa.\n');
}

run().catch(e => {
    console.error('Error fatal:', e.message);
    process.exit(1);
});
