-- Create settings table for app configuration
CREATE TABLE IF NOT EXISTS settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations for authenticated and anonymous users (demo purposes)
CREATE POLICY "Allow all access to settings" ON settings
    FOR ALL USING (true);

-- Insert default commission rate (10%)
INSERT INTO settings (key, value) 
VALUES ('commission_rate', '0.10')
ON CONFLICT (key) DO NOTHING;
