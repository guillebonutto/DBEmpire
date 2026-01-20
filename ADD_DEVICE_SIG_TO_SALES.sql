-- Add device_sig column to sales table to track which device made the sale
-- This allows calculating commissions per seller/device without requiring individual accounts
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS device_sig TEXT;

COMMENT ON COLUMN public.sales.device_sig IS 'Unique hardware signature of the device that registered the sale.';
