/**
 * apply_rls_fix.js
 * Aplica las políticas RLS directamente via la API de Supabase.
 * Usa el Postgres REST endpoint para ejecutar DDL.
 * 
 * REQUIERE: SUPABASE_SERVICE_ROLE_KEY como variable de entorno o hardcodeado abajo.
 * Corre: node tmp/apply_rls_fix.js
 */

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
// ⚠️ Pegá acá tu service_role key (la podés encontrar en Dashboard → Settings → API)
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY === '') {
    console.log('\n❌ ERROR: Falta la SUPABASE_SERVICE_ROLE_KEY.');
    console.log('\nTenés 2 opciones:\n');
    console.log('  Opción A (recomendada): Ejecutá el script con la key como variable de entorno:');
    console.log('    $env:SUPABASE_SERVICE_ROLE_KEY="tu_service_role_key_aqui"');
    console.log('    node tmp/apply_rls_fix.js\n');
    console.log('  Opción B: Ejecutá este SQL manualmente en el SQL Editor de Supabase:');
    console.log('    https://supabase.com/dashboard/project/kxnqheckujcoytnfmxcd/sql/new\n');
    console.log('--- PEGAR ESTE SQL ---');
    console.log(`
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON ai_action_logs;

CREATE POLICY "Allow authenticated users full access"
ON ai_action_logs FOR ALL TO authenticated
USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon insert"
ON ai_action_logs FOR INSERT TO anon
WITH CHECK (true);

CREATE POLICY "Allow anon select"
ON ai_action_logs FOR SELECT TO anon
USING (true);

CREATE POLICY "Allow anon update"
ON ai_action_logs FOR UPDATE TO anon
USING (true) WITH CHECK (true);
`);
    console.log('--- FIN DEL SQL ---\n');
    process.exit(0);
}

async function executeSQL(sql) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY
        },
        body: JSON.stringify({ sql })
    });
    return { status: res.status, body: await res.text() };
}

async function run() {
    console.log('\n🔐 Aplicando políticas RLS a ai_action_logs...\n');

    const sql = `
        DO $$
        BEGIN
            DROP POLICY IF EXISTS "Allow full access to authenticated users" ON ai_action_logs;
            
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_action_logs' AND policyname = 'Allow authenticated users full access') THEN
                CREATE POLICY "Allow authenticated users full access"
                ON ai_action_logs FOR ALL TO authenticated
                USING (true) WITH CHECK (true);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_action_logs' AND policyname = 'Allow anon insert') THEN
                CREATE POLICY "Allow anon insert"
                ON ai_action_logs FOR INSERT TO anon
                WITH CHECK (true);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_action_logs' AND policyname = 'Allow anon select') THEN
                CREATE POLICY "Allow anon select"
                ON ai_action_logs FOR SELECT TO anon
                USING (true);
            END IF;

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ai_action_logs' AND policyname = 'Allow anon update') THEN
                CREATE POLICY "Allow anon update"
                ON ai_action_logs FOR UPDATE TO anon
                USING (true) WITH CHECK (true);
            END IF;
        END $$;
    `;

    const result = await executeSQL(sql);
    if (result.status === 200 || result.status === 201 || result.status === 204) {
        console.log('✅ Políticas RLS aplicadas correctamente.');
    } else {
        console.log(`⚠️  Status: ${result.status}`);
        console.log(`    Body: ${result.body}`);
        console.log('\n→ Si ves "function exec_sql does not exist", ejecutá el SQL manualmente en el Editor de Supabase.');
    }
}

run().catch(e => console.error('Error:', e.message));
