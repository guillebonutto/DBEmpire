-- Add is_leader_sale column to distinguish between Aliado closed sales (10%)
-- and Leader closed sales uploaded by Aliado (5%).
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS is_leader_sale BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.sales.is_leader_sale IS 'If true, the sale was closed by the Leader and the Aliado only uploaded it (results in 5% commission instead of 10%).';
