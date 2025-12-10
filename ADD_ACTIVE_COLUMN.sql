-- Add 'active' column to products table for soft delete (archive) functionality
ALTER TABLE products ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;

-- Set all existing products to active
UPDATE products SET active = true WHERE active IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
