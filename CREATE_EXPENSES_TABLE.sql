-- Create expenses table for tracking business expenses
CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL CHECK (amount > 0),
    category TEXT DEFAULT 'General',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

-- Allow all operations for demo purposes (adjust for production)
CREATE POLICY "Allow all access to expenses" ON expenses
    FOR ALL USING (true);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_expenses_created_at ON expenses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
