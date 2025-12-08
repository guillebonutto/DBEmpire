-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. PROFILES (Users/Sellers)
-- This table extends the default Supabase 'auth.users' table
create table public.profiles (
  id uuid references auth.users not null primary key,
  full_name text,
  role text default 'seller', -- 'admin' or 'seller'
  commission_rate numeric default 0.0, -- e.g., 0.10 for 10%
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. PRODUCTS (Inventory)
create table public.products (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  cost_price numeric not null default 0,
  profit_margin_percent numeric not null default 0, -- e.g., 30 for 30%
  sale_price numeric not null default 0, -- Calculated: cost + (cost * margin/100)
  current_stock int not null default 0,
  provider text,
  image_url text, -- Optional: for product photo
  defect_notes text, -- For "Section of comments in case it comes faulty"
  created_at timestamp with time zone default timezone('utc'::text, now()),
  user_id uuid references public.profiles(id) -- Who created this product (optional)
);

-- 3. CLIENTS
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. SALES (Budgeting/Sales)
create table public.sales (
  id uuid default uuid_generate_v4() primary key,
  seller_id uuid references public.profiles(id) not null,
  client_id uuid references public.clients(id), -- Optional, can be anonymous sale
  total_amount numeric not null default 0,
  profit_generated numeric not null default 0, -- Stored explicitly for ease of commission calc
  commission_amount numeric default 0, -- How much the seller earned
  status text default 'completed', -- 'budget' (presupuesto), 'completed', 'cancelled'
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. SALE ITEMS (Products within a sale)
create table public.sale_items (
  id uuid default uuid_generate_v4() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  product_id uuid references public.products(id),
  quantity int not null default 1,
  unit_price_at_sale numeric not null, -- Price at the moment of sale
  subtotal numeric not null
);

-- Row Level Security (RLS) Policies (Simple Security)
-- Allow anyone logged in to Read/Write everything for now (Team internal use)
alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.clients enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;

-- IMPORTANT FOR ANONYMOUS ACCESS (IF USING PUBLIC KEY WITHOUT AUTH)
-- Since we are keeping it simple without full login flow initially:
create policy "Enable all access for anon" on public.profiles for all using (true);
create policy "Enable all access for anon" on public.products for all using (true);
create policy "Enable all access for anon" on public.clients for all using (true);
create policy "Enable all access for anon" on public.sales for all using (true);
create policy "Enable all access for anon" on public.sale_items for all using (true);

-- Trigger to create profile on new user signup
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (new.id, new.raw_user_meta_data->>'full_name', 'seller', new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
