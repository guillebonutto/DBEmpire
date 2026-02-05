-- Create a function to append new colors to a product's color array
-- This avoids race conditions and simple overwrites
CREATE OR REPLACE FUNCTION append_product_colors(p_id BIGINT, new_colors TEXT[])
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET colors = (
    SELECT ARRAY(
      SELECT DISTINCT unnest(COALESCE(colors, '{}') || new_colors)
    )
  )
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;
