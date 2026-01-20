-- Add discount column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0;

-- Update existing records
UPDATE public.expenses 
SET discount = 0 
WHERE discount IS NULL;

-- Add comment
COMMENT ON COLUMN public.expenses.discount IS 'Fixed discount amount applied to the expense';
