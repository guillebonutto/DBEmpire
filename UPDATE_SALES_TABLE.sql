-- Run this in your Supabase SQL Editor
-- 1. Add tracking number column
ALTER TABLE sales 
ADD COLUMN tracking_number TEXT;

-- 2. Add shipping carrier column (optional but good for tracking)
ALTER TABLE sales 
ADD COLUMN carrier TEXT;

-- 3. Ensure status column can handle new statuses (if it was an enum, we might need to alter type, but usually it's text)
-- If it is text, no action needed. If it's a constrained enum, you might need to drop constraint.
-- checking constraint... assuming text for now.

-- 4. Add notes column for specific order details
ALTER TABLE sales 
ADD COLUMN notes TEXT;
