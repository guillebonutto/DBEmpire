-- Create shipping_packages table for transport cost distribution
CREATE TABLE IF NOT EXISTS shipping_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    package_name TEXT NOT NULL, -- e.g., "Envío Córdoba 28/01/2026"
    destination TEXT NOT NULL, -- e.g., "Córdoba", "Buenos Aires"
    transport_cost DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Total shipping cost
    courier TEXT, -- e.g., "Andreani", "OCA"
    tracking_number TEXT,
    status TEXT DEFAULT 'pending', -- pending, in_transit, delivered
    notes TEXT,
    delivered_at TIMESTAMP WITH TIME ZONE
);

-- Add shipping_package_id to supplier_order_items
ALTER TABLE supplier_order_items 
ADD COLUMN IF NOT EXISTS shipping_package_id UUID REFERENCES shipping_packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transport_cost_allocated DECIMAL(10, 2) DEFAULT 0; -- Portion of transport cost for this item

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipping_packages_status ON shipping_packages(status);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_package ON supplier_order_items(shipping_package_id);

-- Add comments
COMMENT ON TABLE shipping_packages IS 'Shipping packages for transport cost distribution across products';
COMMENT ON COLUMN supplier_order_items.shipping_package_id IS 'Links item to a shipping package for cost allocation';
COMMENT ON COLUMN supplier_order_items.transport_cost_allocated IS 'Portion of shipping package transport cost allocated to this item';
