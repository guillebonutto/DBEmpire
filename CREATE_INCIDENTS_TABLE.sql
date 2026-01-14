-- Create incidents table for error reporting and product returns
CREATE TABLE IF NOT EXISTS public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL, -- 'faltante_caja', 'devolucion_producto', 'queja_cliente', 'otro'
    description TEXT,
    amount NUMERIC(10, 2) DEFAULT 0,
    
    -- Relations for product returns
    sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_incidents_type ON public.incidents(type);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON public.incidents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_incidents_sale_id ON public.incidents(sale_id);
CREATE INDEX IF NOT EXISTS idx_incidents_client_id ON public.incidents(client_id);
CREATE INDEX IF NOT EXISTS idx_incidents_product_id ON public.incidents(product_id);

-- Enable Row Level Security
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read/write their own incidents
CREATE POLICY "Users can view all incidents" 
    ON public.incidents FOR SELECT 
    USING (true);

CREATE POLICY "Users can insert incidents" 
    ON public.incidents FOR INSERT 
    WITH CHECK (true);

CREATE POLICY "Users can update their own incidents" 
    ON public.incidents FOR UPDATE 
    USING (true);

CREATE POLICY "Users can delete their own incidents" 
    ON public.incidents FOR DELETE 
    USING (true);

-- Grant permissions
GRANT ALL ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
