-- 1. Ensure RLS is enabled on reminders
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;

-- 2. Drop any conflicting policies on reminders
DROP POLICY IF EXISTS "Enable all access for anon" ON public.reminders;
DROP POLICY IF EXISTS "Permitir todo a usuarios anon" ON public.reminders;

-- 3. Create the standard policy matching sales, products, clients, expenses
CREATE POLICY "Enable all access for anon" ON public.reminders
FOR ALL TO public
USING (true)
WITH CHECK (true);

-- 4. Also ensure authenticated policy exists with WITH CHECK so both work
DROP POLICY IF EXISTS "Acceso total a logueados" ON public.reminders;
CREATE POLICY "Acceso total a logueados" ON public.reminders
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
