-- RESTAURAR RELACIONES (Para que funcione el reporte)

-- 1. Aseguramos que la columna sea del tipo correcto
alter table public.sales alter column seller_id type uuid using seller_id::uuid;

-- 2. Volvemos a conectar Ventas con Vendedores (Profiles)
-- Esto es necesario para que la App sepa mostrar el nombre del vendedor
alter table public.sales 
  add constraint sales_seller_id_fkey 
  foreign key (seller_id) 
  references public.profiles (id);

-- 3. Aseguramos también la relación con Clientes (por si acaso)
alter table public.sales 
  drop constraint if exists sales_client_id_fkey;

alter table public.sales 
  add constraint sales_client_id_fkey 
  foreign key (client_id) 
  references public.clients (id);

-- 4. Confirmación visual
select 'Relaciones Restauradas Exitosamente' as status;
