-- Tabla para gestionar materiales multimedia (Fotos/Videos)
-- realizados por los Aliados para marketing.
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT now(),
    device_sig TEXT, -- Firma del dispositivo que sube el material
    media_url TEXT, -- URL o Base64 del material
    title TEXT, -- Título o producto relacionado
    description TEXT, -- Descripción del contenido
    ai_copies JSONB, -- Opciones de texto generadas por la IA
    status TEXT DEFAULT 'pending', -- pending, useful, archived
    metadata JSONB -- Para info extra (mimetype, size, etc)
);

-- Habilitar RLS
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Políticas simples
CREATE POLICY "Permitir lectura para todos" ON public.assets FOR SELECT USING (true);
CREATE POLICY "Permitir inserción para todos" ON public.assets FOR INSERT WITH CHECK (true);
CREATE POLICY "Permitir actualización para todos" ON public.assets FOR UPDATE USING (true);
