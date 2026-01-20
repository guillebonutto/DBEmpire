-- Add discount column to supplier_orders table
ALTER TABLE public.supplier_orders 
ADD COLUMN IF NOT EXISTS discount NUMERIC(10, 2) DEFAULT 0;

-- Update existing records to have 0 discount
UPDATE public.supplier_orders 
SET discount = 0 
WHERE discount IS NULL;

-- Add comment to column
COMMENT ON COLUMN public.supplier_orders.discount IS 'Fixed discount amount applied to the order total';
