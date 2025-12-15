-- Table for tracking purchases from suppliers (Temu, Shein, etc.)
CREATE TABLE IF NOT EXISTS supplier_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider_name TEXT NOT NULL, -- e.g. Temu, Shein, Amazon
    tracking_number TEXT,
    items_description TEXT, -- e.g. "20 fundas iPhone, 10 cargadores"
    total_cost DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending', -- pending, shipped, delivered, cancelled
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notes TEXT
);

-- Enable RLS
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to supplier_orders" ON supplier_orders
    FOR ALL USING (true);
