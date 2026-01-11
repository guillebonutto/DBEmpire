-- Phase 14: Functional Promotions Schema Update

-- 1. Redesign Promotions Table
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'global_percent'; -- global_percent, buy_x_get_y, fixed_discount
ALTER TABLE promotions ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;

-- 2. Ensure Link Table exists
CREATE TABLE IF NOT EXISTS promotion_products (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    promotion_id UUID REFERENCES promotions(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(promotion_id, product_id)
);

-- 3. Ensure Sales can store the applied promo
ALTER TABLE sales ADD COLUMN IF NOT EXISTS promotion_id UUID REFERENCES promotions(id);
