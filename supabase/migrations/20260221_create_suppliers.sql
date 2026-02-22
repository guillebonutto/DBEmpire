-- Create a separate suppliers table for formal management
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    name TEXT NOT NULL UNIQUE,
    category TEXT, -- e.g. "Tecnología", "Indumentaria"
    phone TEXT,
    email TEXT,
    notes TEXT,
    active BOOLEAN DEFAULT true
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- Link supplier_orders to the new table (optional field to avoid breaking existing data)
ALTER TABLE supplier_orders 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL;

-- Backfill: If we have existing provider names, we could create supplier records 
-- but we'll let the user do it through the UI or via a one-time script later if they want.

-- Add comments
COMMENT ON TABLE suppliers IS 'Master list of product suppliers/vendors';
