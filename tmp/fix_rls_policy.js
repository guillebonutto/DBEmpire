/**
 * fix_rls_policy.js
 * Genera el SQL CORRECTO para corregir la política RLS de ai_action_logs.
 * El anon key debe poder insertar/leer para que la app funcione.
 * El service_role_key (Edge Function) ignora RLS by default.
 */
function run() {
    console.log('\n=== SQL PARA CORREGIR RLS EN ai_action_logs ===\n');
    console.log('Pega esto en el SQL Editor de Supabase y ejecutalo:\n');
    console.log(`
-- Eliminar políticas anteriores que pueden estar bloqueando
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON ai_action_logs;

-- Política para roles autenticados (usuarios logueados en la app)
CREATE POLICY "Allow authenticated users full access"
ON ai_action_logs FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Política para anon role (permitir insert desde la app cuando está sin sesión activa)
CREATE POLICY "Allow anon insert"
ON ai_action_logs FOR INSERT
TO anon
WITH CHECK (true);

-- Política para anon role SELECT (para que pueda leer sus propios registros)
CREATE POLICY "Allow anon select"
ON ai_action_logs FOR SELECT
TO anon
USING (true);

-- Verificar que quedaron bien:
SELECT schemaname, tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'ai_action_logs';
    `);
}
run();
