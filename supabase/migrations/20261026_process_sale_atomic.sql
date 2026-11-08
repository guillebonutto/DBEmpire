-- Migration: Atomic process_sale_atomic RPC with strict integrity, variant consistency, and location unification
-- Date: 2026-10-26

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Asegurar columna assigned_location en profiles si no existe
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_location TEXT;

-- 2. Asegurar existencia de tabla inventory_movements para trazabilidad y deduplicación
CREATE TABLE IF NOT EXISTS public.inventory_movements (
 id TEXT PRIMARY KEY,
 sale_id TEXT NOT NULL,
 product_id TEXT NOT NULL,
 color TEXT,
 quantity INTEGER NOT NULL,
 deficit_quantity INTEGER DEFAULT 0,
 movement_type TEXT NOT NULL DEFAULT 'SALE',
 created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_sale_id ON public.inventory_movements (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON public.sale_items (sale_id);

-- 3. Definición de la RPC Transaccional
CREATE OR REPLACE FUNCTION public.process_sale_atomic(
 p_sale JSONB,
 p_items JSONB,
 p_location TEXT DEFAULT 'local',
 p_allow_oversell BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
 v_sale_id TEXT;
 v_seller_id TEXT;
 v_target_user_id TEXT;
 v_current_role TEXT;
 v_auth_uid TEXT;
 v_effective_location TEXT;
 v_sale_location TEXT;

 v_user_profile RECORD;
 v_existing_sale RECORD;
 v_existing_item RECORD;
 v_existing_movement RECORD;

 v_remote_item_count INT;
 v_remote_mov_count INT;
 v_mismatched_remote INT;
 v_mismatched_incoming INT;

 v_item JSONB;
 v_item_id TEXT;
 v_product_id TEXT;
 v_qty INT;
 v_unit_price NUMERIC;
 v_subtotal NUMERIC;
 v_color TEXT;
 v_deficit INT;

 v_prod RECORD;
 v_avail_stock INT;
 v_variants_arr JSONB;
 v_var_elem JSONB;
 v_var_stock INT;
 v_dem RECORD;
 v_dem_var RECORD;

 v_new_loc_stock INT;
 v_new_current_stock INT;
 v_new_variants JSONB;
 v_movement_inserted BOOLEAN;
BEGIN
 -- ==========================================================================
 -- 1. VALIDACIÓN Y UNIFICACIÓN DE SUCURSAL EFECTIVA
 -- ==========================================================================
 IF p_location IS NULL OR TRIM(p_location) = '' THEN
 v_effective_location := 'local';
 ELSE
 v_effective_location := LOWER(TRIM(p_location));
 END IF;

 IF v_effective_location NOT IN ('local', 'cordoba') THEN
 RAISE EXCEPTION 'INVALID_LOCATION: Location parameter must be local or cordoba (received: %)', p_location USING ERRCODE = 'P0001';
 END IF;

 IF p_sale ? 'sale_location' AND p_sale->>'sale_location' IS NOT NULL AND TRIM(p_sale->>'sale_location') <> '' THEN
 v_sale_location := LOWER(TRIM(p_sale->>'sale_location'));
 IF v_sale_location NOT IN ('local', 'cordoba') THEN
 RAISE EXCEPTION 'INVALID_LOCATION: sale.sale_location must be local or cordoba (received: %)', v_sale_location USING ERRCODE = 'P0001';
 END IF;

 IF v_sale_location <> v_effective_location THEN
 RAISE EXCEPTION 'LOCATION_MISMATCH: Payload location mismatch. p_location=% but p_sale.sale_location=%',
 v_effective_location, v_sale_location USING ERRCODE = 'P0001';
 END IF;
 END IF;

 -- ==========================================================================
 -- 2. BLOQUEO CONSULTIVO DE VENTA
 -- ==========================================================================
 v_sale_id := p_sale->>'id';
 IF v_sale_id IS NULL OR TRIM(v_sale_id) = '' THEN
 RAISE EXCEPTION 'INVALID_SALE_ID: Sale ID cannot be empty' USING ERRCODE = 'P0001';
 END IF;

 PERFORM pg_advisory_xact_lock(hashtext('sale:' || v_sale_id));

 -- ==========================================================================
 -- 3. VERIFICACIÓN DE SEGURIDAD Y AUTORIZACIÓN EFECTIVA
 -- ==========================================================================
 v_current_role := COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), '');
 IF v_current_role = '' THEN
 BEGIN
 v_current_role := COALESCE(auth.role(), '');
 EXCEPTION WHEN OTHERS THEN
 v_current_role := '';
 END;
 END IF;

 v_auth_uid := COALESCE(NULLIF(current_setting('request.jwt.claim.sub', true), ''), '');
 IF v_auth_uid = '' THEN
 BEGIN
 v_auth_uid := COALESCE(auth.uid()::TEXT, '');
 EXCEPTION WHEN OTHERS THEN
 v_auth_uid := '';
 END;
 END IF;

 v_seller_id := p_sale->>'seller_id';

 IF v_current_role = 'anon' OR (v_auth_uid = '' AND v_current_role <> 'service_role' AND current_user <> 'postgres') THEN
 RAISE EXCEPTION 'UNAUTHORIZED: Anonymous calls are not permitted. Authentication required.' USING ERRCODE = '42501';
 END IF;

 v_target_user_id := NULL;
 IF v_auth_uid <> '' AND v_current_role <> 'service_role' THEN
 v_target_user_id := v_auth_uid;
 ELSIF v_seller_id IS NOT NULL AND TRIM(v_seller_id) <> '' THEN
 v_target_user_id := v_seller_id;
 END IF;

 IF v_target_user_id IS NOT NULL THEN
 IF v_target_user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
 RAISE EXCEPTION 'INVALID_SELLER_ID: Seller or user ID % is not a valid UUID', v_target_user_id USING ERRCODE = 'P0001';
 END IF;

 SELECT id, role, full_name, email, assigned_location
 INTO v_user_profile
 FROM public.profiles
 WHERE id = v_target_user_id::UUID;

 IF NOT FOUND THEN
 RAISE EXCEPTION 'PROFILE_NOT_FOUND: Profile % does not exist', v_target_user_id USING ERRCODE = 'P0002';
 END IF;

 IF v_user_profile.role = 'blocked' THEN
 RAISE EXCEPTION 'UNAUTHORIZED: User account is blocked' USING ERRCODE = '42501';
 END IF;

 IF v_user_profile.role NOT IN ('admin', 'leader', 'seller') THEN
 RAISE EXCEPTION 'UNAUTHORIZED: Role % is not authorized to register sales', v_user_profile.role USING ERRCODE = '42501';
 END IF;

 IF v_user_profile.assigned_location IS NOT NULL
 AND v_user_profile.assigned_location <> v_effective_location
 AND v_user_profile.role <> 'admin'
 THEN
 RAISE EXCEPTION 'UNAUTHORIZED_LOCATION: User % is assigned to location % but attempted operation in %',
 v_target_user_id, v_user_profile.assigned_location, v_effective_location USING ERRCODE = '42501';
 END IF;
 END IF;

 -- ==========================================================================
 -- 4. VALIDACIÓN DE ITEMS DE ENTRADA
 -- ==========================================================================
 IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
 RAISE EXCEPTION 'INVALID_ITEMS: p_items must be a non-empty JSON array' USING ERRCODE = 'P0001';
 END IF;

 -- Validar formato de cada elemento
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
 LOOP
 IF (v_item->>'id') IS NULL OR TRIM(v_item->>'id') = '' THEN
 RAISE EXCEPTION 'INVALID_ITEM: Item missing ID' USING ERRCODE = 'P0001';
 END IF;
 IF (v_item->>'product_id') IS NULL OR TRIM(v_item->>'product_id') = '' THEN
 RAISE EXCEPTION 'INVALID_ITEM: Item % missing product_id', v_item->>'id' USING ERRCODE = 'P0001';
 END IF;
 IF COALESCE((v_item->>'quantity')::INT, 0) <= 0 THEN
 RAISE EXCEPTION 'INVALID_ITEM: Item % quantity must be > 0', v_item->>'id' USING ERRCODE = 'P0001';
 END IF;
 END LOOP;

 -- ==========================================================================
 -- 5. VERIFICACIÓN DE IDEMPOTENCIA PREVIA (CORTO-CIRCUITO SI YA FUE PROCESADA)
 -- ==========================================================================
 SELECT id, total_amount, client_id, sale_location INTO v_existing_sale
 FROM public.sales
 WHERE id = v_sale_id;

 IF FOUND THEN
 -- Validación de cabecera incompatible
 IF ABS(COALESCE(v_existing_sale.total_amount, 0) - COALESCE((p_sale->>'total_amount')::NUMERIC, 0)) > 0.01
 OR COALESCE(v_existing_sale.client_id, '') <> COALESCE(p_sale->>'client_id', '')
 OR COALESCE(v_existing_sale.sale_location, 'local') <> v_effective_location
 THEN
 RAISE EXCEPTION 'ID_COLLISION_DIFFERENT_SALE: Sale % already exists with conflicting header attributes (remote total: %, incoming: %)',
 v_sale_id, v_existing_sale.total_amount, p_sale->>'total_amount' USING ERRCODE = 'P0001';
 END IF;

 -- Validación de cardinalidad (número de líneas)
 SELECT COUNT(*) INTO v_remote_item_count FROM public.sale_items WHERE sale_id = v_sale_id;
 IF v_remote_item_count > 0 AND v_remote_item_count <> jsonb_array_length(p_items) THEN
 RAISE EXCEPTION 'ID_COLLISION_DIFFERENT_ITEMS: Remote sale has % items but incoming payload has % items',
 v_remote_item_count, jsonb_array_length(p_items) USING ERRCODE = 'P0001';
 END IF;

 -- Comparación 1 a 1 de contenido de ítems
 IF v_remote_item_count > 0 THEN
 SELECT COUNT(*) INTO v_mismatched_remote
 FROM public.sale_items si
 WHERE si.sale_id = v_sale_id
 AND NOT EXISTS (
 SELECT 1 FROM jsonb_array_elements(p_items) elem
 WHERE (elem->>'id') = si.id
 AND (elem->>'product_id') = si.product_id
 AND COALESCE((elem->>'quantity')::INT, 0) = si.quantity
 AND ABS(COALESCE((elem->>'unit_price_at_sale')::NUMERIC, 0) - COALESCE(si.unit_price_at_sale, 0)) <= 0.01
 AND ABS(COALESCE((elem->>'subtotal')::NUMERIC, 0) - COALESCE(si.subtotal, 0)) <= 0.01
 AND COALESCE(LOWER(TRIM(elem->>'color')), '') = COALESCE(LOWER(TRIM(si.color)), '')
 );

 IF v_mismatched_remote > 0 THEN
 RAISE EXCEPTION 'ID_COLLISION_DIFFERENT_ITEMS: Remote items do not match incoming items for sale %', v_sale_id USING ERRCODE = 'P0001';
 END IF;

 SELECT COUNT(*) INTO v_mismatched_incoming
 FROM jsonb_array_elements(p_items) elem
 WHERE NOT EXISTS (
 SELECT 1 FROM public.sale_items si
 WHERE si.sale_id = v_sale_id
 AND si.id = (elem->>'id')
 AND si.product_id = (elem->>'product_id')
 AND si.quantity = COALESCE((elem->>'quantity')::INT, 0)
 AND ABS(COALESCE(si.unit_price_at_sale, 0) - COALESCE((elem->>'unit_price_at_sale')::NUMERIC, 0)) <= 0.01
 AND ABS(COALESCE(si.subtotal, 0) - COALESCE((elem->>'subtotal')::NUMERIC, 0)) <= 0.01
 AND COALESCE(LOWER(TRIM(si.color)), '') = COALESCE(LOWER(TRIM(elem->>'color')), '')
 );

 IF v_mismatched_incoming > 0 THEN
 RAISE EXCEPTION 'ID_COLLISION_DIFFERENT_ITEMS: Incoming items contain lines not matching existing sale %', v_sale_id USING ERRCODE = 'P0001';
 END IF;

 -- Verificar si todos los movimientos de inventario ya están registrados
 SELECT COUNT(*) INTO v_remote_mov_count FROM public.inventory_movements WHERE sale_id = v_sale_id;

 -- Si todos los items y movimientos están presentes y coinciden, la venta ya está 100% procesada
 IF v_remote_item_count = jsonb_array_length(p_items) AND v_remote_mov_count = jsonb_array_length(p_items) THEN
 RETURN jsonb_build_object(
 'success', true,
 'status', 'already_processed',
 'sale_id', v_sale_id,
 'items_count', v_remote_item_count,
 'movements_count', v_remote_mov_count,
 'location', v_effective_location
 );
 END IF;
 END IF;
 END IF;

 -- ==========================================================================
 -- 6. VERIFICACIÓN DE DISPONIBILIDAD DE STOCK (SOLO ITEMS PENDIENTES)
 -- ==========================================================================
 -- Tabla temporal para agregar demanda general por producto
 CREATE TEMP TABLE IF NOT EXISTS _sale_stock_demand (
 product_id TEXT PRIMARY KEY,
 total_qty INT
 ) ON COMMIT DROP;
 TRUNCATE _sale_stock_demand;

 -- Tabla temporal para agregar demanda por variante (producto + color)
 CREATE TEMP TABLE IF NOT EXISTS _sale_variant_demand (
 product_id TEXT,
 color TEXT,
 total_qty INT,
 PRIMARY KEY (product_id, color)
 ) ON COMMIT DROP;
 TRUNCATE _sale_variant_demand;

 -- Acumular demanda únicamente para ítems cuyo movimiento aún NO existe
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
 LOOP
 v_item_id := v_item->>'id';
 v_product_id := v_item->>'product_id';
 v_qty := COALESCE((v_item->>'quantity')::INT, 0);
 v_color := LOWER(TRIM(COALESCE(v_item->>'color', '')));

 -- Si el movimiento ya existe para este item_id, verificar colisión y no descontar stock
 SELECT id, sale_id, product_id, quantity, color, movement_type
 INTO v_existing_movement
 FROM public.inventory_movements
 WHERE id = v_item_id;

 IF FOUND THEN
 IF v_existing_movement.sale_id <> v_sale_id
 OR v_existing_movement.product_id <> v_product_id
 OR v_existing_movement.quantity <> v_qty
 OR COALESCE(LOWER(TRIM(v_existing_movement.color)), '') <> v_color
 OR v_existing_movement.movement_type <> 'SALE'
 THEN
 RAISE EXCEPTION 'MOVEMENT_ID_COLLISION: inventory_movement % already exists with incompatible data (sale: %, prod: %, qty: %)',
 v_item_id, v_existing_movement.sale_id, v_existing_movement.product_id, v_existing_movement.quantity USING ERRCODE = 'P0001';
 END IF;
 ELSE
 -- No existe movimiento: acumular a la demanda a verificar
 INSERT INTO _sale_stock_demand (product_id, total_qty)
 VALUES (v_product_id, v_qty)
 ON CONFLICT (product_id) DO UPDATE SET total_qty = _sale_stock_demand.total_qty + EXCLUDED.total_qty;

 IF v_color <> '' THEN
 INSERT INTO _sale_variant_demand (product_id, color, total_qty)
 VALUES (v_product_id, v_color, v_qty)
 ON CONFLICT (product_id, color) DO UPDATE SET total_qty = _sale_variant_demand.total_qty + EXCLUDED.total_qty;
 END IF;
 END IF;
 END LOOP;

 -- Validar stock general con bloqueo pesimista FOR UPDATE
 FOR v_dem IN SELECT * FROM _sale_stock_demand
 LOOP
 SELECT id, stock_local, stock_cordoba, current_stock, variants
 INTO v_prod
 FROM public.products
 WHERE id = v_dem.product_id
 FOR UPDATE;

 IF NOT FOUND THEN
 RAISE EXCEPTION 'PRODUCT_NOT_FOUND: Product % does not exist in inventory', v_dem.product_id USING ERRCODE = 'P0002';
 END IF;

 IF v_effective_location = 'cordoba' THEN
 v_avail_stock := COALESCE(v_prod.stock_cordoba, 0);
 ELSE
 v_avail_stock := COALESCE(v_prod.stock_local, 0);
 END IF;

 IF v_avail_stock < v_dem.total_qty AND NOT p_allow_oversell THEN
 RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % has insufficient stock in %. Available: %, requested: %',
 v_dem.product_id, v_effective_location, v_avail_stock, v_dem.total_qty USING ERRCODE = 'P0002';
 END IF;
 END LOOP;

 -- Validar consistencia y stock de variantes
 FOR v_dem_var IN SELECT * FROM _sale_variant_demand
 LOOP
 SELECT id, variants
 INTO v_prod
 FROM public.products
 WHERE id = v_dem_var.product_id;

 v_variants_arr := NULL;
 IF v_prod.variants IS NOT NULL THEN
 IF jsonb_typeof(v_prod.variants) = 'array' THEN
 v_variants_arr := v_prod.variants;
 ELSIF jsonb_typeof(v_prod.variants) = 'string' THEN
 BEGIN
 v_variants_arr := (v_prod.variants #>> '{}')::JSONB;
 EXCEPTION WHEN OTHERS THEN
 v_variants_arr := NULL;
 END;
 END IF;
 END IF;

 IF v_variants_arr IS NULL OR jsonb_typeof(v_variants_arr) <> 'array' OR jsonb_array_length(v_variants_arr) = 0 THEN
 RAISE EXCEPTION 'VARIANT_NOT_FOUND: Product % has no variants configured, but color % was requested',
 v_dem_var.product_id, v_dem_var.color USING ERRCODE = 'P0002';
 END IF;

 SELECT elem INTO v_var_elem
 FROM jsonb_array_elements(v_variants_arr) elem
 WHERE LOWER(TRIM(elem->>'color')) = v_dem_var.color
 LIMIT 1;

 IF v_var_elem IS NULL THEN
 RAISE EXCEPTION 'VARIANT_NOT_FOUND: Product % has no variant with color %',
 v_dem_var.product_id, v_dem_var.color USING ERRCODE = 'P0002';
 END IF;

 v_var_stock := COALESCE((v_var_elem->>'stock')::NUMERIC, 0)::INT;
 IF v_var_stock < v_dem_var.total_qty AND NOT p_allow_oversell THEN
 RAISE EXCEPTION 'INSUFFICIENT_VARIANT_STOCK: Product % variant % has insufficient stock. Available: %, requested: %',
 v_dem_var.product_id, v_dem_var.color, v_var_stock, v_dem_var.total_qty USING ERRCODE = 'P0002';
 END IF;
 END LOOP;

 -- ==========================================================================
 -- 7. ESCRITURA ATÓMICA DE CABECERA (SI NO EXISTE)
 -- ==========================================================================
 IF v_existing_sale.id IS NULL THEN
 INSERT INTO public.sales (
 id, client_id, seller_id, total_amount, profit_generated, commission_amount,
 status, sale_location, notes, created_at, paid_at, device_sig, is_leader_sale,
 manual_discount_amount, manual_discount_type, manual_discount_value, promotion_id
 ) VALUES (
 v_sale_id,
 NULLIF(p_sale->>'client_id', ''),
 NULLIF(p_sale->>'seller_id', ''),
 COALESCE((p_sale->>'total_amount')::NUMERIC, 0),
 COALESCE((p_sale->>'profit_generated')::NUMERIC, 0),
 COALESCE((p_sale->>'commission_amount')::NUMERIC, 0),
 COALESCE(p_sale->>'status', 'completed'),
 v_effective_location,
 p_sale->>'notes',
 COALESCE((p_sale->>'created_at')::TIMESTAMPTZ, NOW()),
 NULLIF(p_sale->>'paid_at', '')::TIMESTAMPTZ,
 p_sale->>'device_sig',
 COALESCE((p_sale->>'is_leader_sale')::BOOLEAN, false),
 COALESCE((p_sale->>'manual_discount_amount')::NUMERIC, 0),
 p_sale->>'manual_discount_type',
 COALESCE((p_sale->>'manual_discount_value')::NUMERIC, 0),
 NULLIF(p_sale->>'promotion_id', '')::UUID
 );
 END IF;

 -- ==========================================================================
 -- 8. ESCRITURA DE ÍTEMS, MOVIMIENTOS Y DESCUENTO DE STOCK
 -- ==========================================================================
 FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
 LOOP
 v_item_id := v_item->>'id';
 v_product_id := v_item->>'product_id';
 v_qty := COALESCE((v_item->>'quantity')::INT, 0);
 v_unit_price := COALESCE((v_item->>'unit_price_at_sale')::NUMERIC, 0);
 v_subtotal := COALESCE((v_item->>'subtotal')::NUMERIC, v_qty * v_unit_price);
 v_color := v_item->>'color';

 -- A. Validación o inserción en sale_items
 SELECT id, sale_id, product_id, quantity, unit_price_at_sale, subtotal, color
 INTO v_existing_item
 FROM public.sale_items
 WHERE id = v_item_id;

 IF FOUND THEN
 IF v_existing_item.sale_id <> v_sale_id
 OR v_existing_item.product_id <> v_product_id
 OR v_existing_item.quantity <> v_qty
 OR ABS(COALESCE(v_existing_item.unit_price_at_sale, 0) - v_unit_price) > 0.01
 OR ABS(COALESCE(v_existing_item.subtotal, 0) - v_subtotal) > 0.01
 OR COALESCE(LOWER(TRIM(v_existing_item.color)), '') <> COALESCE(LOWER(TRIM(v_color)), '')
 THEN
 RAISE EXCEPTION 'ITEM_ID_COLLISION: sale_item % already exists with incompatible data (sale: %, prod: %)',
 v_item_id, v_existing_item.sale_id, v_existing_item.product_id USING ERRCODE = 'P0001';
 END IF;
 ELSE
 INSERT INTO public.sale_items (id, sale_id, product_id, quantity, unit_price_at_sale, subtotal, color)
 VALUES (v_item_id, v_sale_id, v_product_id, v_qty, v_unit_price, v_subtotal, v_color);
 END IF;

 -- B. Validación o inserción en inventory_movements
 SELECT id, sale_id, product_id, quantity, color, movement_type
 INTO v_existing_movement
 FROM public.inventory_movements
 WHERE id = v_item_id;

 IF FOUND THEN
 IF v_existing_movement.sale_id <> v_sale_id
 OR v_existing_movement.product_id <> v_product_id
 OR v_existing_movement.quantity <> v_qty
 OR COALESCE(LOWER(TRIM(v_existing_movement.color)), '') <> COALESCE(LOWER(TRIM(v_color)), '')
 OR v_existing_movement.movement_type <> 'SALE'
 THEN
 RAISE EXCEPTION 'MOVEMENT_ID_COLLISION: inventory_movement % already exists with incompatible data (sale: %, prod: %, qty: %)',
 v_item_id, v_existing_movement.sale_id, v_existing_movement.product_id, v_existing_movement.quantity USING ERRCODE = 'P0001';
 END IF;
 v_movement_inserted := FALSE;
 ELSE
 -- Calcular deficit si stock disponible menor a qty
 SELECT id, stock_local, stock_cordoba INTO v_prod FROM public.products WHERE id = v_product_id;
 IF v_effective_location = 'cordoba' THEN
 v_avail_stock := COALESCE(v_prod.stock_cordoba, 0);
 ELSE
 v_avail_stock := COALESCE(v_prod.stock_local, 0);
 END IF;

 IF v_avail_stock < v_qty THEN
 v_deficit := v_qty - v_avail_stock;
 ELSE
 v_deficit := 0;
 END IF;

 INSERT INTO public.inventory_movements (id, sale_id, product_id, color, quantity, deficit_quantity, movement_type)
 VALUES (v_item_id, v_sale_id, v_product_id, v_color, v_qty, v_deficit, 'SALE');
 v_movement_inserted := TRUE;
 END IF;

 -- C. Descuento de stock únicamente si el movimiento fue recién insertado
 IF v_movement_inserted THEN
 SELECT id, stock_local, stock_cordoba, current_stock, variants
 INTO v_prod
 FROM public.products
 WHERE id = v_product_id
 FOR UPDATE;

 IF v_effective_location = 'cordoba' THEN
 v_new_loc_stock := GREATEST(0, COALESCE(v_prod.stock_cordoba, 0) - v_qty);
 v_new_current_stock := GREATEST(0, COALESCE(v_prod.current_stock, 0) - v_qty);
 UPDATE public.products
 SET stock_cordoba = v_new_loc_stock,
 current_stock = v_new_current_stock
 WHERE id = v_product_id;
 ELSE
 v_new_loc_stock := GREATEST(0, COALESCE(v_prod.stock_local, 0) - v_qty);
 v_new_current_stock := GREATEST(0, COALESCE(v_prod.current_stock, 0) - v_qty);
 UPDATE public.products
 SET stock_local = v_new_loc_stock,
 current_stock = v_new_current_stock
 WHERE id = v_product_id;
 END IF;

 -- Descuento en variantes si el ítem tiene color
 IF v_color IS NOT NULL AND TRIM(v_color) <> '' THEN
 v_variants_arr := NULL;
 IF v_prod.variants IS NOT NULL THEN
 IF jsonb_typeof(v_prod.variants) = 'array' THEN
 v_variants_arr := v_prod.variants;
 ELSIF jsonb_typeof(v_prod.variants) = 'string' THEN
 BEGIN
 v_variants_arr := (v_prod.variants #>> '{}')::JSONB;
 EXCEPTION WHEN OTHERS THEN
 v_variants_arr := NULL;
 END;
 END IF;
 END IF;

 IF v_variants_arr IS NOT NULL AND jsonb_typeof(v_variants_arr) = 'array' THEN
 SELECT jsonb_agg(
 CASE
 WHEN LOWER(TRIM(elem->>'color')) = LOWER(TRIM(v_color)) THEN
 jsonb_set(
 elem,
 '{stock}',
 to_jsonb(GREATEST(0, COALESCE((elem->>'stock')::NUMERIC, 0)::INT - v_qty))
 )
 ELSE elem
 END
 )
 INTO v_new_variants
 FROM jsonb_array_elements(v_variants_arr) elem;

 UPDATE public.products
 SET variants = COALESCE(v_new_variants, variants)
 WHERE id = v_product_id;
 END IF;
 END IF;
 END IF;
 END LOOP;

 RETURN jsonb_build_object(
 'success', true,
 'status', 'completed',
 'sale_id', v_sale_id,
 'location', v_effective_location,
 'items_count', jsonb_array_length(p_items)
 );
END;
$$;

-- 4. Permisos de Ejecución
REVOKE EXECUTE ON FUNCTION public.process_sale_atomic(JSONB, JSONB, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_sale_atomic(JSONB, JSONB, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.process_sale_atomic(JSONB, JSONB, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_sale_atomic(JSONB, JSONB, TEXT, BOOLEAN) TO service_role;
