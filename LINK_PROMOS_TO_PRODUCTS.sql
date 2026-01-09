-- Create Promotion Products join table
create table if not exists public.promotion_products (
  id uuid default uuid_generate_v4() primary key,
  promotion_id uuid references public.promotions(id) on delete cascade not null,
  product_id uuid references public.products(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  unique(promotion_id, product_id)
);

-- Enable RLS
alter table public.promotion_products enable row level security;

-- Create policy for anonymous access (MVP)
create policy "Enable all access for anon" on public.promotion_products for all using (true);
