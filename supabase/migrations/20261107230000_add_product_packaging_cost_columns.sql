ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS packaging_cost NUMERIC NOT NULL DEFAULT 65,
    ADD COLUMN IF NOT EXISTS packaging_sticker_cost NUMERIC NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS packaging_type TEXT NOT NULL DEFAULT 'general';

NOTIFY pgrst, 'reload schema';
