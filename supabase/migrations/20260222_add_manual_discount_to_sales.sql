-- Add manual discount columns to sales table
ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS manual_discount_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_discount_type TEXT, -- 'fixed' or 'percent'
ADD COLUMN IF NOT EXISTS manual_discount_value DECIMAL(12,2) DEFAULT 0;

-- Update the master initialization function to include these columns
CREATE OR REPLACE FUNCTION initialize_app_schema_v2()
RETURNS TEXT AS $$
BEGIN
    -- ... existing logic from initialize_app_schema ...
    -- (I will just add the check here for the specific columns for the user to run)
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='manual_discount_amount') THEN
        ALTER TABLE sales ADD COLUMN manual_discount_amount DECIMAL(12,2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='manual_discount_type') THEN
        ALTER TABLE sales ADD COLUMN manual_discount_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='sales' AND column_name='manual_discount_value') THEN
        ALTER TABLE sales ADD COLUMN manual_discount_value DECIMAL(12,2) DEFAULT 0;
    END IF;

    RETURN 'Manual discount columns added successfully';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
