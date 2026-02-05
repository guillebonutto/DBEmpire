-- Add 'colors' column to products to store available colors as a text array
-- This can be used for quick filtering or display without parsing the full variants JSON
ALTER TABLE products ADD COLUMN IF NOT EXISTS colors TEXT[] DEFAULT '{}';

-- Add 'color' column to sale_items to record the specific color variant sold
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS color TEXT;
