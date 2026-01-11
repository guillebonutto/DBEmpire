-- Add promotion_id to sales table
ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id);

-- Optional: Add index for performance
CREATE INDEX IF NOT EXISTS idx_sales_promotion_id ON sales(promotion_id);
