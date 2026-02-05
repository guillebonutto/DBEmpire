-- This function handles the entire schema synchronization
-- It checks for columns before adding them to avoid errors
CREATE OR REPLACE FUNCTION initialize_app_schema()
RETURNS TEXT AS $$
BEGIN
    -- 1. Ensure 'variants' column exists in products
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='variants') THEN
        ALTER TABLE products ADD COLUMN variants JSONB DEFAULT '[]';
    END IF;

    -- 2. Ensure 'color' column exists in sale_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sale_items' AND column_name='color') THEN
        ALTER TABLE sale_items ADD COLUMN color TEXT;
    END IF;

    -- 3. Ensure 'color' column exists in supplier_order_items
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='supplier_order_items' AND column_name='color') THEN
        ALTER TABLE supplier_order_items ADD COLUMN color TEXT;
    END IF;

    -- 4. Clean up old 'colors' array if it exists (Optional/Safe)
    -- ALTER TABLE products DROP COLUMN IF EXISTS colors;

    -- 5. Re-create the decrement function
    CREATE OR REPLACE FUNCTION decrement_variant_stock(p_id BIGINT, p_color TEXT, p_qty INT)
    RETURNS VOID AS $inner$
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
    $inner$ LANGUAGE plpgsql;

    -- 6. Re-create the upsert function
    CREATE OR REPLACE FUNCTION upsert_variant_stock(p_id BIGINT, p_color TEXT, p_qty INT)
    RETURNS VOID AS $inner$
    DECLARE
        v_exists BOOLEAN;
    BEGIN
        SELECT EXISTS (
            SELECT 1 FROM jsonb_array_elements(variants) AS elem WHERE elem->>'color' = p_color
        ) INTO v_exists FROM products WHERE id = p_id;

        IF v_exists THEN
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
            UPDATE products
            SET variants = COALESCE(variants, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('color', p_color, 'stock', p_qty))
            WHERE id = p_id;
        END IF;
    END;
    $inner$ LANGUAGE plpgsql;

    RETURN 'Schema initialized successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
