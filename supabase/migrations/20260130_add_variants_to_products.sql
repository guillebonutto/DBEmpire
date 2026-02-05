-- Migration to add variants support to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';

-- Comment explaining the structure: array of { color: string, stock: number }
COMMENT ON COLUMN products.variants IS 'Array of variants, e.g., [{"color": "Red", "stock": 5}, {"color": "Blue", "stock": 3}]';
