/**
 * test_ai_loop.js
 * 
 * Script de testing completo del Feedback Loop de IA.
 * Corre con: node tmp/test_ai_loop.js
 * 
 * Flujo:
 *   1. Verifica conexión a Supabase
 *   2. Inserta una acción IA falsa (simulando que Gemini la generó)
 *   3. La marca como ejecutada (simulando que el usuario tocó el botón)
 *   4. Fuerza la evaluación bajando evaluation_window_hours = 0
 *   5. Llama directamente al endpoint de la Edge Function
 *   6. Verifica que profit_delta, confidence_score y evaluation_status cambiaron
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

// ⚠️  REEMPLAZÁ ESTO con tu service_role_key de Dashboard → Settings → API
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'REEMPLAZA_CON_TU_SERVICE_ROLE_KEY';

const PROJECT_REF = 'kxnqheckujcoytnfmxcd';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Helper para pasos claros en consola
const step = (n, msg) => console.log(`\n${'═'.repeat(50)}\n  PASO ${n}: ${msg}\n${'═'.repeat(50)}`);
const ok = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => console.log(`  ❌ ${msg}`);
const info = (msg) => console.log(`  ℹ️  ${msg}`);

async function runTest() {
    console.log('\n🧪 EMPIRE AI — TEST DEL FEEDBACK LOOP COMPLETO\n');

    // ────────────────────────────────────────────────
    // PASO 1: Verificar conexión a Supabase
    // ────────────────────────────────────────────────
    step(1, 'Verificando conexión a Supabase...');
    const { data: ping, error: pingErr } = await supabase.from('settings').select('key').limit(1);
    if (pingErr) { fail(`Conexión fallida: ${pingErr.message}`); process.exit(1); }
    ok('Conexión exitosa a Supabase.');

    // ────────────────────────────────────────────────
    // PASO 2: Verificar que existe la tabla ai_action_logs
    // ────────────────────────────────────────────────
    step(2, 'Verificando tabla ai_action_logs...');
    const { error: tableErr } = await supabase.from('ai_action_logs').select('id').limit(1);
    if (tableErr) {
        fail(`Tabla no encontrada: ${tableErr.message}`);
        info('Ejecutá primero el SQL de tmp/create_ai_action_logs.js en Supabase.');
        process.exit(1);
    }
    ok('Tabla ai_action_logs existe y es accesible.');

    // ────────────────────────────────────────────────
    // PASO 3: Insertar acción IA de prueba
    // ────────────────────────────────────────────────
    step(3, 'Insertando acción IA de prueba...');
    const testHash = `test_hash_${Date.now()}`;
    const { data: inserted, error: insertErr } = await supabase
        .from('ai_action_logs')
        .insert({
            title: '[TEST] Reposición de Stock de Termos',
            description: 'Prueba automática del sistema de evaluación.',
            action_type: 'restock',
            impact_predicted: 'high',
            context_snapshot: { monthlyProfit: 50000, monthlyRevenue: 200000 }, // snapshot base
            executed: false,
            evaluation_window_hours: 0, // ← 0 para que el evaluator la tome al instante
            action_hash: testHash,
            confidence_score: 5,
            evaluation_status: 'pending'
        })
        .select()
        .single();

    if (insertErr) { fail(`Insert fallido: ${insertErr.message}`); process.exit(1); }
    const testId = inserted.id;
    ok(`Acción insertada con ID: ${testId}`);
    info(`Hash: ${testHash}`);

    // ────────────────────────────────────────────────
    // PASO 4: Simular que el usuario ejecutó la acción
    // ────────────────────────────────────────────────
    step(4, 'Marcando acción como ejecutada (simulando tap del usuario)...');
    const { error: execErr } = await supabase
        .from('ai_action_logs')
        .update({ executed: true, executed_at: new Date().toISOString() })
        .eq('id', testId);

    if (execErr) { fail(`Update fallido: ${execErr.message}`); }
    else ok('Acción marcada como executed=true y executed_at=now().');

    // ────────────────────────────────────────────────
    // PASO 5: Llamar al endpoint de la Edge Function
    // ────────────────────────────────────────────────
    step(5, 'Llamando al endpoint de la Edge Function...');
    const edgeUrl = `https://${PROJECT_REF}.supabase.co/functions/v1/evaluate-ai-actions`;
    info(`URL: ${edgeUrl}`);

    try {
        const res = await fetch(edgeUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            },
            body: '{}'
        });

        const resultText = await res.text();
        if (res.ok) {
            ok(`Edge Function respondió: ${res.status} → ${resultText}`);
        } else {
            fail(`Edge Function respondió con error ${res.status}: ${resultText}`);
            info('Verificá que hayas hecho el deploy con: npx supabase functions deploy evaluate-ai-actions --project-ref ' + PROJECT_REF);
        }
    } catch (e) {
        fail(`No se pudo conectar a la Edge Function: ${e.message}`);
        info(`URL usada: ${edgeUrl}`);
        info(`Verificá que PROJECT_REF sea correcto y la función esté desplegada.`);
    }

    // ────────────────────────────────────────────────
    // PASO 6: Verificar el resultado en la DB
    // ────────────────────────────────────────────────
    step(6, 'Verificando resultado en ai_action_logs...');
    await new Promise(r => setTimeout(r, 2000)); // Esperar 2s para que el edge termine

    const { data: result, error: checkErr } = await supabase
        .from('ai_action_logs')
        .select('*')
        .eq('id', testId)
        .single();

    if (checkErr) { fail(`Lectura final fallida: ${checkErr.message}`); process.exit(1); }

    console.log('\n  📊 Resultado final de la acción:\n');
    console.log(`     executed:            ${result.executed}`);
    console.log(`     executed_at:         ${result.executed_at}`);
    console.log(`     evaluation_status:   ${result.evaluation_status}`);
    console.log(`     profit_delta:        ${result.profit_delta}`);
    console.log(`     revenue_delta:       ${result.revenue_delta}`);
    console.log(`     confidence_score:    ${result.confidence_score}`);

    const evaluated = result.evaluation_status === 'evaluated';
    const hasDelta = result.profit_delta !== null;

    if (evaluated && hasDelta) {
        ok('✅ SISTEMA CERRADO: La acción fue evaluada correctamente por la Edge Function.');
    } else if (result.evaluation_status === 'pending') {
        fail('La evaluación sigue en "pending". Posibles causas:');
        info('1. La Edge Function no está desplegada todavía.');
        info('2. PROJECT_REF incorrecto en este script (REEMPLAZÁ con el tuyo).');
        info('3. SUPABASE_SERVICE_ROLE_KEY no configurado en la función.');
    } else {
        info(`Estado actual: ${result.evaluation_status}. Revisá los logs de la Edge Function en el Dashboard.`);
    }

    // ────────────────────────────────────────────────
    // CLEANUP: Borrar la acción de prueba
    // ────────────────────────────────────────────────
    await supabase.from('ai_action_logs').delete().eq('id', testId);
    info(`Registro de test (${testId}) eliminado.`);

    console.log('\n🏁 Test completo.\n');
}

runTest().catch(e => {
    console.error('Error fatal en el test:', e.message);
    process.exit(1);
});
