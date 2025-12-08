-- Add Promotions Table
create table public.promotions (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Habilitar seguridad (RLS) pero permitir acceso anónimo (Demo MVP)
alter table public.promotions enable row level security;
create policy "Enable all access for anon" on public.promotions for all using (true);

-- Insertar algunos ejemplos
insert into public.promotions (title, description, active) values
('Liquidación Verano', '30% descuento en sandalias', true),
('2x1 en Accesorios', 'Llevate dos cinturones por el precio de uno', true);
