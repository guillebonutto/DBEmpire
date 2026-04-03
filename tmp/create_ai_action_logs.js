const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

function run() {
    console.log("=== SCRIPT SQL DE DESPLIEGUE COMPLETO (FASE 3: EDGE FUNCTION + AUTOMATIZACIÓN) ===");
    console.log("Ejecuta este bloque completo en el SQL Editor de Supabase:\n");
    
    const query = `
-- ════════════════════════════════════════════════════════════
-- 1. TABLA PRINCIPAL
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_action_logs (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at timestamp with time zone DEFAULT now(),
    action_type text,
    title text,
    description text,
    impact_predicted text,
    context_snapshot jsonb,
    executed boolean DEFAULT false,
    executed_at timestamp with time zone,
    result_snapshot jsonb,
    profit_delta numeric,
    revenue_delta numeric,
    evaluation_window_hours int DEFAULT 48,
    action_hash text UNIQUE,
    confidence_score numeric DEFAULT 1,
    evaluation_status text DEFAULT 'pending'  -- pending | evaluated | skipped
);

-- Si la tabla ya existía, aseguramos las columnas nuevas:
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_action_logs' AND column_name='action_hash') THEN
        ALTER TABLE ai_action_logs ADD COLUMN action_hash text UNIQUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_action_logs' AND column_name='confidence_score') THEN
        ALTER TABLE ai_action_logs ADD COLUMN confidence_score numeric DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ai_action_logs' AND column_name='evaluation_status') THEN
        ALTER TABLE ai_action_logs ADD COLUMN evaluation_status text DEFAULT 'pending';
    END IF;
END $$;

-- ════════════════════════════════════════════════════════════
-- 2. SEGURIDAD (RLS)
-- ════════════════════════════════════════════════════════════
ALTER TABLE ai_action_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON ai_action_logs;
CREATE POLICY "Allow full access to authenticated users"
ON ai_action_logs FOR ALL
-- Cambiar 'true' por (auth.role() = 'authenticated') si usas Supabase Auth completamente
USING (true)
WITH CHECK (true);

-- ════════════════════════════════════════════════════════════
-- 3. VISTA DE RENDIMIENTO DE IA
-- ════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW ai_action_performance AS
SELECT
  action_type,
  COUNT(*) as total_actions,
  SUM(CASE WHEN profit_delta > 0 THEN 1 ELSE 0 END) as successful_actions,
  SUM(CASE WHEN profit_delta <= 0 THEN 1 ELSE 0 END) as failed_actions,
  ROUND(AVG(profit_delta)::numeric, 2) as avg_profit,
  ROUND(SUM(profit_delta)::numeric, 2) as total_profit_generated,
  ROUND(AVG(confidence_score)::numeric, 2) as avg_confidence
FROM ai_action_logs
WHERE executed = true
  AND profit_delta IS NOT NULL
GROUP BY action_type;

-- ════════════════════════════════════════════════════════════
-- 4. HABILITAR pg_cron (si aún no está habilitado en tu proyecto)
-- IMPORTANTE: pg_cron se habilita desde el dashboard de Supabase:
--   Dashboard > Database > Extensions > Busca 'pg_cron' > Enable
-- Luego ejecuta este bloque:
-- ════════════════════════════════════════════════════════════

-- REEMPLAZÁ <your-project-ref> con tu Project ID de Supabase (ej: abcdefghijklmnop)
-- y <your-anon-key> con tu anon key del proyecto.
-- Podés encontrarlos en: Dashboard > Settings > API

-- Primero habilitá la extensión http si no está:
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Luego registrá el cron (corre cada hora):
SELECT cron.schedule(
  'empire-ai-evaluator',        -- nombre del job (único)
  '0 * * * *',                  -- cron: cada hora en punto
  $$
  SELECT net.http_post(
    url := 'https://<your-project-ref>.supabase.co/functions/v1/evaluate-ai-actions',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer <your-anon-key>"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);

-- Para verificar que el cron quedó registrado:
-- SELECT * FROM cron.job;

-- Para borrar el cron si necesitás re-crearlo:
-- SELECT cron.unschedule('empire-ai-evaluator');
    `;

    console.log(query);
    console.log("\n=== FIN DEL SCRIPT ===");
    console.log("\nIMPORTANTE: Antes de ejecutar el cron, desplegá la Edge Function con:");
    console.log("  npx supabase functions deploy evaluate-ai-actions --project-ref <your-project-ref>");
}

run();
