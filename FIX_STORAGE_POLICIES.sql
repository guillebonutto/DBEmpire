-- Políticas de Seguridad para el Bucket de Marketing 'assets'
-- Ejecuta esto en el SQL Editor de Supabase para permitir subidas libres.

-- 1. Asegurar que las políticas se apliquen a la tabla de objetos de storage
BEGIN;

-- Eliminar políticas previas si las hubiera (para evitar duplicados)
DROP POLICY IF EXISTS "Permitir subida pública en assets" ON storage.objects;
DROP POLICY IF EXISTS "Permitir ver archivos públicamente en assets" ON storage.objects;

-- 2. Permitir que cualquiera suba archivos al bucket 'assets'
CREATE POLICY "Permitir subida pública en assets" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'assets');

-- 3. Permitir que cualquiera vea los archivos en el bucket 'assets'
CREATE POLICY "Permitir ver archivos públicamente en assets" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'assets');

COMMIT;

-- Nota: Si el bucket 'assets' aún no existe, asegúrate de crearlo 
-- primero en la sección de Storage como "Public".
