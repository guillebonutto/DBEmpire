-- Tabule to store authorized devices by their unique signature
CREATE TABLE IF NOT EXISTS authorized_devices (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    device_signature TEXT UNIQUE NOT NULL, -- Encrypted/Hashed version of the hardware ID
    role TEXT NOT NULL CHECK (role IN ('admin', 'seller')),
    device_name TEXT, -- Human-readable name like 'Guille iPhone 15'
    last_access TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Row Level Security
ALTER TABLE authorized_devices ENABLE ROW LEVEL SECURITY;

-- Allow anonymous check (we only check if a hash exists, we don't return sensitive data)
CREATE POLICY "Allow public check of device signature" 
ON authorized_devices FOR SELECT 
TO anon 
USING (true);

-- Only admins can manage devices (optional, for later use)
CREATE POLICY "Allow admins to manage devices" 
ON authorized_devices FOR ALL 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
);
