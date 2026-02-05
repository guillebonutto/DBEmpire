-- Clean up columns
ALTER TABLE products DROP COLUMN IF EXISTS colors;

-- Ensure supplier_order_items.color and sale_items.color exist for transactional records
-- They are useful for history even if 'variants' JSON holds the current state
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS color TEXT;

-- Migration to ensure variants column is ready
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';
