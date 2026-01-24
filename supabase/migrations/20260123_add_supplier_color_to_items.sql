-- Add supplier and color columns to supplier_order_items table
ALTER TABLE supplier_order_items 
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS color TEXT;
