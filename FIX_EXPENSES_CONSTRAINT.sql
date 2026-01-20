-- Drop the constraint that prevents negative amounts in expenses
-- This allows the "Descuento" category to store negative values and subtract from totals
ALTER TABLE public.expenses 
DROP CONSTRAINT IF EXISTS expenses_amount_check;

-- Optional: Re-add it but allowing 0 and negative values if you want to ensure it's not NULL
-- but usually dropping the specific >0 check is enough for this use case.
-- ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_check CHECK (amount IS NOT NULL);

COMMENT ON TABLE public.expenses IS 'Table for recording business expenses. Amount can be negative for discounts/credits.';
