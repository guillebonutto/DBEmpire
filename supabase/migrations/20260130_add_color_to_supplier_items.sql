-- Add 'color' column to supplier_order_items to store the specific variant color
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS color TEXT;
