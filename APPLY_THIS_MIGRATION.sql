-- Execute this SQL in your Supabase SQL Editor
-- This adds supplier and color tracking to supplier order items

ALTER TABLE supplier_order_items 
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS color TEXT;

-- Add helpful comment
COMMENT ON COLUMN supplier_order_items.supplier IS 'Supplier/vendor name for this specific item';
COMMENT ON COLUMN supplier_order_items.color IS 'Color or variant information for this item';
