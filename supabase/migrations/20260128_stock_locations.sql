-- 1. Add location-based stock columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_local INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_cordoba INTEGER DEFAULT 0;

-- 2. Initialize stock_local with current_stock for existing products
UPDATE products SET stock_local = current_stock WHERE stock_local = 0 AND current_stock > 0;

-- 3. Remove old transport settings
DELETE FROM settings WHERE key IN ('transport_cost', 'transport_rate');

-- 4. Add sale_location to sales
ALTER TABLE sales ADD COLUMN IF NOT EXISTS sale_location TEXT DEFAULT 'local';

-- 4. Add helpful comments
COMMENT ON COLUMN products.stock_local IS 'Stock available in Buenos Aires (local)';
COMMENT ON COLUMN products.stock_cordoba IS 'Stock available in Córdoba with the partner';
