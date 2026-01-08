-- Add installment tracking columns to supplier_orders table
ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS installments_total INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS installments_paid INTEGER DEFAULT 0;

-- Optional: Add check constraint to ensure paid <= total (might be annoying if they want to prepay or adjust, but good for data integrity)
-- ALTER TABLE supplier_orders ADD CONSTRAINT check_installments CHECK (installments_paid <= installments_total);
