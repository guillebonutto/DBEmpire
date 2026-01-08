-- Table for linking supplier orders to specific products (Inventory)
CREATE TABLE IF NOT EXISTS supplier_order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    supplier_order_id UUID REFERENCES supplier_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    quantity INTEGER NOT NULL DEFAULT 1,
    cost_per_unit DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE supplier_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to supplier_order_items" ON supplier_order_items
    FOR ALL USING (true);
