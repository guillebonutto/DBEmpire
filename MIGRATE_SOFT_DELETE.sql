-- Add 'active' column to products for Soft Delete support
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Update existing records to be active
UPDATE public.products SET active = true WHERE active IS NULL;
