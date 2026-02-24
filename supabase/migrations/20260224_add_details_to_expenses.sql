-- Add details JSONB column to expenses for grouped information
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '[]';
