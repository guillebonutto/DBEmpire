-- Consolidation of variants logic
-- 1. Remove the simple 'colors' column if it exists
ALTER TABLE products DROP COLUMN IF EXISTS colors;

-- 2. Ensure 'variants' column exists in products
ALTER TABLE products ADD COLUMN IF NOT EXISTS variants JSONB DEFAULT '[]';

-- 3. Ensure 'color' column exists in transaction tables for history
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS color TEXT;
ALTER TABLE supplier_order_items ADD COLUMN IF NOT EXISTS color TEXT;

-- 4. Function to safely update variant stock (Decrement for sales)
CREATE OR REPLACE FUNCTION decrement_variant_stock(p_id BIGINT, p_color TEXT, p_qty INT)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET variants = (
    SELECT jsonb_agg(
      CASE 
        WHEN (elem->>'color') = p_color 
        THEN jsonb_set(elem, '{stock}', (GREATEST(0, (elem->>'stock')::int - p_qty))::text::jsonb)
        ELSE elem
      END
    )
    FROM jsonb_array_elements(variants) AS elem
  )
  WHERE id = p_id AND variants @> jsonb_build_array(jsonb_build_object('color', p_color));
END;
$$ LANGUAGE plpgsql;

-- 5. Function to safely update variant stock (Increment/Upsert for arrivals)
CREATE OR REPLACE FUNCTION upsert_variant_stock(p_id BIGINT, p_color TEXT, p_qty INT)
RETURNS VOID AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    -- Check if product has this color in variants
    SELECT EXISTS (
        SELECT 1 FROM jsonb_array_elements(variants) AS elem WHERE elem->>'color' = p_color
    ) INTO v_exists FROM products WHERE id = p_id;

    IF v_exists THEN
        -- Update existing
        UPDATE products
        SET variants = (
            SELECT jsonb_agg(
                CASE 
                    WHEN (elem->>'color') = p_color 
                    THEN jsonb_set(elem, '{stock}', ((elem->>'stock')::int + p_qty)::text::jsonb)
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(variants) AS elem
        )
        WHERE id = p_id;
    ELSE
        -- Append new variant
        UPDATE products
        SET variants = variants || jsonb_build_array(jsonb_build_object('color', p_color, 'stock', p_qty))
        WHERE id = p_id;
    END IF;
END;
$$ LANGUAGE plpgsql;
