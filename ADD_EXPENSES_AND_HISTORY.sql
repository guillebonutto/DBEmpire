-- 1. EXPENSES TABLE
create table if not exists public.expenses (
  id uuid default uuid_generate_v4() primary key,
  description text not null,
  amount numeric not null default 0,
  category text default 'General', -- 'Rent', 'Utilities', 'Marketing', etc.
  date timestamp with time zone default timezone('utc'::text, now()),
  created_by uuid references public.profiles(id), -- Optional: who registered it
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Expenses
alter table public.expenses enable row level security;
create policy "Enable all access for anon" on public.expenses for all using (true);

-- 2. PRICE HISTORY TABLE
create table if not exists public.price_history (
  id uuid default uuid_generate_v4() primary key,
  product_id uuid references public.products(id) on delete cascade not null,
  old_price numeric,
  new_price numeric,
  changed_by uuid references public.profiles(id),
  change_date timestamp with time zone default timezone('utc'::text, now())
);

-- RLS for Price History
alter table public.price_history enable row level security;
create policy "Enable all access for anon" on public.price_history for all using (true);
