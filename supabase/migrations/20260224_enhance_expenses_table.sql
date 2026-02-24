-- Migration to enhance expenses table with product details and variants
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(id);
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS quantity INT;

-- Update existing records description format if needed (Optional, but good for consistency)
-- This migration focuses on the schema change.
