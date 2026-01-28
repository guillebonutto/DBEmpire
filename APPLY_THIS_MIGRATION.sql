-- ============================================
-- MIGRATION SCRIPT FOR SHIPPING PACKAGES SYSTEM
-- Execute this in Supabase SQL Editor
-- ============================================

-- 1. Add supplier and color columns to supplier_order_items (if not exists)
ALTER TABLE supplier_order_items 
ADD COLUMN IF NOT EXISTS supplier TEXT,
ADD COLUMN IF NOT EXISTS color TEXT;

COMMENT ON COLUMN supplier_order_items.supplier IS 'Supplier/vendor name for this specific item';
COMMENT ON COLUMN supplier_order_items.color IS 'Color or variant information for this item';

-- 2. Create shipping_packages table for transport cost distribution
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

-- 3. Add shipping_package_id to supplier_order_items
ALTER TABLE supplier_order_items 
ADD COLUMN IF NOT EXISTS shipping_package_id UUID REFERENCES shipping_packages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS transport_cost_allocated DECIMAL(10, 2) DEFAULT 0; -- Portion of transport cost for this item

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_shipping_packages_status ON shipping_packages(status);
CREATE INDEX IF NOT EXISTS idx_supplier_order_items_package ON supplier_order_items(shipping_package_id);

-- 5. Add comments
COMMENT ON TABLE shipping_packages IS 'Shipping packages for transport cost distribution across products';
COMMENT ON COLUMN supplier_order_items.shipping_package_id IS 'Links item to a shipping package for cost allocation';
COMMENT ON COLUMN supplier_order_items.transport_cost_allocated IS 'Portion of shipping package transport cost allocated to this item';

-- 6. Create shipping_rates configuration table
CREATE TABLE IF NOT EXISTS shipping_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    courier TEXT NOT NULL, -- 'Andreani', 'OCA', 'Via Cargo', etc.
    destination TEXT NOT NULL, -- 'Córdoba', 'Buenos Aires', 'Rosario', etc.
    base_rate DECIMAL(10, 2) NOT NULL DEFAULT 0, -- Base cost for this route
    per_kg_rate DECIMAL(10, 2) DEFAULT 0, -- Optional: cost per kg
    notes TEXT,
    active BOOLEAN DEFAULT true,
    UNIQUE(courier, destination)
);

-- 7. Add indexes for shipping_rates
CREATE INDEX IF NOT EXISTS idx_shipping_rates_active ON shipping_rates(active);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_courier ON shipping_rates(courier);

-- 8. Add comments for shipping_rates
COMMENT ON TABLE shipping_rates IS 'Shipping rates configuration by courier and destination';
COMMENT ON COLUMN shipping_rates.base_rate IS 'Base shipping cost for this courier-destination combination';
COMMENT ON COLUMN shipping_rates.per_kg_rate IS 'Additional cost per kilogram (optional)';

-- 9. Insert default shipping rates (you can modify these values)
INSERT INTO shipping_rates (courier, destination, base_rate, notes) VALUES
('Andreani', 'Córdoba', 8500.00, 'Tarifa estándar paquete mediano'),
('Andreani', 'Buenos Aires', 3500.00, 'Envío local'),
('Andreani', 'Rosario', 6000.00, 'Tarifa estándar'),
('Andreani', 'Mendoza', 9500.00, 'Tarifa estándar'),
('OCA', 'Córdoba', 7800.00, 'Tarifa estándar'),
('OCA', 'Buenos Aires', 3200.00, 'Envío local'),
('OCA', 'Rosario', 5500.00, 'Tarifa estándar'),
('OCA', 'Mendoza', 9000.00, 'Tarifa estándar'),
('Via Cargo', 'Córdoba', 7000.00, 'Tarifa económica'),
('Via Cargo', 'Buenos Aires', 2800.00, 'Envío local'),
('Via Cargo', 'Rosario', 5000.00, 'Tarifa económica'),
('Via Cargo', 'Mendoza', 8500.00, 'Tarifa económica')
ON CONFLICT (courier, destination) DO NOTHING;

-- 10. Add location-based stock columns to products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS stock_local INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_cordoba INTEGER DEFAULT 0;

-- 11. Initialize stock_local with current_stock
UPDATE products SET stock_local = current_stock WHERE stock_local = 0 AND current_stock > 0;

-- 12. Remove old transport settings
DELETE FROM settings WHERE key IN ('transport_cost', 'transport_rate');

-- ============================================
-- VERIFICATION QUERIES (Optional - Run to verify)
-- ============================================

-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('shipping_packages', 'supplier_order_items');

-- Check columns in supplier_order_items
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'supplier_order_items' 
AND column_name IN ('supplier', 'color', 'shipping_package_id', 'transport_cost_allocated');

-- Check columns in shipping_packages
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'shipping_packages';
