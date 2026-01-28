-- Add shipping rates configuration table
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

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_shipping_rates_active ON shipping_rates(active);
CREATE INDEX IF NOT EXISTS idx_shipping_rates_courier ON shipping_rates(courier);

-- Add comments
COMMENT ON TABLE shipping_rates IS 'Shipping rates configuration by courier and destination';
COMMENT ON COLUMN shipping_rates.base_rate IS 'Base shipping cost for this courier-destination combination';
COMMENT ON COLUMN shipping_rates.per_kg_rate IS 'Additional cost per kilogram (optional)';

-- Insert default rates (you can modify these)
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
