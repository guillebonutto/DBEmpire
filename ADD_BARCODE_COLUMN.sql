-- Add barcode column to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS barcode text UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
