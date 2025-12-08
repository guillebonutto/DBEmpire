-- ¡IMPORTANTE! Ejecuta esto en el SQL Editor de Supabase para arreglar el error de guardado.

-- 1. Relajar las restricciones (fk) para que podamos usar usuarios "virtuales" sin login real
alter table public.sales drop constraint if exists sales_seller_id_fkey;
alter table public.sales alter column seller_id drop not null;

alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Crear usuarios por defecto (El Equipo Virtual)
insert into public.profiles (id, full_name, role, email)
values 
('00000000-0000-0000-0000-000000000001', 'Dueño (Admin)', 'admin', 'admin@digitalboost.com'),
('00000000-0000-0000-0000-000000000002', 'Vendedor (Primo)', 'seller', 'primo@digitalboost.com')
on conflict (id) do nothing;

-- 3. Asegurar que las políticas de seguridad (RLS) permitan todo (Lectura/Escritura Pública)
-- En caso de que las políticas anteriores estuvieran bloqueando
drop policy if exists "Enable all access for anon" on public.profiles;
create policy "Enable all access for anon" on public.profiles for all using (true);

drop policy if exists "Enable all access for anon" on public.sales;
create policy "Enable all access for anon" on public.sales for all using (true);
