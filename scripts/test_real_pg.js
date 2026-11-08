const { execFileSync, spawn } = require('child_process');

const psql = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
const env = Object.assign({}, process.env);
const db = 'dbe_local_test';

if (!env.PGPASSWORD) {
    throw new Error('Set PGPASSWORD to run the local PostgreSQL audit.');
}

function query(sql) {
    return execFileSync(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-c', sql], {
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
}

function queryJson(sql) {
    const raw = execFileSync(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-t', '-A', '-c', sql], {
        env,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe']
    });
    return raw.trim();
}

function queryExpectError(sql) {
    try {
        execFileSync(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-c', sql], {
            env,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        });
        throw new Error('Expected query to fail but it succeeded');
    } catch (e) {
        return (e.stderr || '') + (e.stdout || '') + e.message;
    }
}

async function runRealPostgreSqlAudit() {
    console.log('================================================================');
    console.log('AUDITORIA EN POSTGRESQL REAL (PostgreSQL 17 - dbe_local_test)');
    console.log('================================================================\n');

    let passed = 0;
    let failed = 0;

    function assert(condition, testName, details) {
        if (condition) {
            console.log('[PASS] ' + testName);
            passed++;
        } else {
            console.error('[FAIL] ' + testName + ' - ' + (details || ''));
            failed++;
        }
    }

    // 0. Reset Clean State
    query([
        'TRUNCATE public.sales, public.sale_items, public.inventory_movements CASCADE;',
        'DELETE FROM public.profiles;',
        'DELETE FROM public.products;',
        'INSERT INTO public.profiles (id, full_name, role, email, assigned_location) VALUES',
        '    (\x2700000000-0000-0000-0000-000000000001\x27, \x27Admin\x27, \x27admin\x27, \x27admin@dbe.com\x27, null),',
        '    (\x2700000000-0000-0000-0000-000000000002\x27, \x27Vendedor Local\x27, \x27seller\x27, \x27seller@dbe.com\x27, \x27local\x27),',
        '    (\x2700000000-0000-0000-0000-000000000003\x27, \x27Vendedor Bloqueado\x27, \x27blocked\x27, \x27blocked@dbe.com\x27, \x27local\x27);',
        'INSERT INTO public.products (id, name, stock_local, stock_cordoba, current_stock, variants) VALUES',
        '    (\x27prod-1\x27, \x27Producto 1\x27, 10, 5, 15, \x27[{\x22color\x22: \x22Rojo\x22, \x22stock\x22: 5}, {\x22color\x22: \x22Azul\x22, \x22stock\x22: 5}]\x27::jsonb),',
        '    (\x27prod-2\x27, \x27Producto 2\x27, 3, 0, 3, \x27[]\x27::jsonb);'
    ].join('\n'));

    // Test 1: Rollback real en PostgreSQL cuando falla el segundo item
    const t1Err = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000001\x22, \x22total_amount\x22: 200, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-1a\x22, \x22product_id\x22: \x22prod-1\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200},',
        '      {\x22id\x22: \x22item-1b\x22, \x22product_id\x22: \x22prod-inexistente\x22, \x22quantity\x22: 1, \x22unit_price_at_sale\x22: 50, \x22subtotal\x22: 50}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));

    const t1Sales = parseInt(queryJson('SELECT COUNT(*) FROM public.sales WHERE id = \x2700000000-0000-4000-8000-000000000001\x27;'));
    const t1Items = parseInt(queryJson('SELECT COUNT(*) FROM public.sale_items WHERE sale_id = \x2700000000-0000-4000-8000-000000000001\x27;'));
    const t1Movs = parseInt(queryJson('SELECT COUNT(*) FROM public.inventory_movements WHERE sale_id = \x2700000000-0000-4000-8000-000000000001\x27;'));
    const t1Stock = parseInt(queryJson('SELECT stock_local FROM public.products WHERE id = \x27prod-1\x27;'));

    assert(t1Err.includes('PRODUCT_NOT_FOUND') && t1Sales === 0 && t1Items === 0 && t1Movs === 0 && t1Stock === 10,
        '1. Rollback Real en PostgreSQL: Error en item 2 revierte totalmente ventas, items, movimientos y stock');

    // Test 2: Sucursal manipulada (LOCATION_MISMATCH)
    const t2Err = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000002\x22, \x22total_amount\x22: 100, \x22sale_location\x22: \x22cordoba\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-2\x22, \x22product_id\x22: \x22prod-1\x22, \x22quantity\x22: 1, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 100}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    assert(t2Err.includes('LOCATION_MISMATCH'),
        '2. Unificacion de Sucursal: Discrepancia entre p_location y sale_location rechaza con LOCATION_MISMATCH');

    // Test 3: Usuario sin autorizacion de sucursal (UNAUTHORIZED_LOCATION)
    const t3Err = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000003\x22, \x22seller_id\x22: \x2200000000-0000-0000-0000-000000000002\x22, \x22total_amount\x22: 100, \x22sale_location\x22: \x22cordoba\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-3\x22, \x22product_id\x22: \x22prod-1\x22, \x22quantity\x22: 1, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 100}]\x27::jsonb,',
        '    \x27cordoba\x27',
        ');'
    ].join('\n'));
    assert(t3Err.includes('UNAUTHORIZED_LOCATION'),
        '3. Autorizacion de Sucursal: Vendedor de local no puede vender en cordoba');

    // Test 4: Perfil inexistente y usuario bloqueado
    const t4aErr = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000004a\x22, \x22seller_id\x22: \x2200000000-0000-0000-0000-999999999999\x22, \x22total_amount\x22: 100, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-4a\x22, \x22product_id\x22: \x22prod-1\x22, \x22quantity\x22: 1, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 100}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    assert(t4aErr.includes('PROFILE_NOT_FOUND'),
        '4a. Perfil Inexistente: Rechaza seller_id no registrado con PROFILE_NOT_FOUND');

    const t4bErr = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000004b\x22, \x22seller_id\x22: \x2200000000-0000-0000-0000-000000000003\x22, \x22total_amount\x22: 100, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-4b\x22, \x22product_id\x22: \x22prod-1\x22, \x22quantity\x22: 1, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 100}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    assert(t4bErr.includes('UNAUTHORIZED'),
        '4b. Usuario Bloqueado: Rechaza seller con role=blocked');

    // Test 5: Variantes inexistentes y stock insuficiente por variante
    const t5aErr = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000005a\x22, \x22total_amount\x22: 100, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-5a\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Verde\x22, \x22quantity\x22: 1, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 100}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    assert(t5aErr.includes('VARIANT_NOT_FOUND'),
        '5a. Variante Inexistente: Rechaza color no presente en variants con VARIANT_NOT_FOUND');

    const t5bErr = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000005b\x22, \x22total_amount\x22: 800, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-5b\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 8, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 800}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    assert(t5bErr.includes('INSUFFICIENT_VARIANT_STOCK'),
        '5b. Stock de Variante Insuficiente: Rechaza cuando stock general es 10 pero variante Rojo es 5');

    // Test 6: Multiples lineas de misma variante acumuladas
    const t6aErr = queryExpectError([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000006a\x22, \x22total_amount\x22: 600, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-6a1\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 3, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 300},',
        '      {\x22id\x22: \x22item-6a2\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 3, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 300}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    assert(t6aErr.includes('INSUFFICIENT_VARIANT_STOCK'),
        '6a. Acumulacion de Lineas Repetidas: 3 + 3 = 6 excede stock de variante Rojo (5) y aborta con rollback');

    query([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000006v\x22, \x22total_amount\x22: 400, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-6v1\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200},',
        '      {\x22id\x22: \x22item-6v2\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    const t6Stock = parseInt(queryJson('SELECT stock_local FROM public.products WHERE id = \x27prod-1\x27;'));
    const t6Variants = JSON.parse(queryJson('SELECT variants FROM public.products WHERE id = \x27prod-1\x27;'));
    const rojoStock = parseInt(t6Variants.find(function(v) { return v.color === 'Rojo'; }).stock);

    assert(t6Stock === 6 && rojoStock === 1,
        '6b. Deduccion Acumulada Exitosa: Descuenta 4 unidades acumuladas en general (10->6) y en variante Rojo (5->1)');

    // Test 7: Idempotencia en reintento legitimo
    query([
        'SELECT public.process_sale_atomic(',
        '    \x27{\x22id\x22: \x2200000000-0000-4000-8000-000000000006v\x22, \x22total_amount\x22: 400, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
        '    \x27[{\x22id\x22: \x22item-6v1\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200},',
        '      {\x22id\x22: \x22item-6v2\x22, \x22product_id\x22: \x22prod-1\x22, \x22color\x22: \x22Rojo\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200}]\x27::jsonb,',
        '    \x27local\x27',
        ');'
    ].join('\n'));
    const t7Stock = parseInt(queryJson('SELECT stock_local FROM public.products WHERE id = \x27prod-1\x27;'));
    const t7MovCount = parseInt(queryJson('SELECT COUNT(*) FROM public.inventory_movements WHERE sale_id = \x2700000000-0000-4000-8000-000000000006v\x27;'));

    assert(t7Stock === 6 && t7MovCount === 2,
        '7. Idempotencia de Reintento: Segunda llamada identica no duplica movimientos ni descuenta stock');

        // Test 9: Dos reintentos concurrentes de la misma venta (Carrera de Idempotencia)
    console.log('\n--- Ejecutando Prueba de 2 Reintentos Concurrentes en Paralelo ---');
    const r1 = new Promise(function(resolve) {
        const proc = spawn(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-c', [
            'SELECT public.process_sale_atomic(',
            '    \'{"id": "00000000-4000-8000-0000-000000000009", "total_amount": 100, "sale_location": "local"}\'::jsonb,',
            '    \'[{"id": "item-9", "product_id": "prod-2", "quantity": 1, "unit_price_at_sale": 100, "subtotal": 100}]\'::jsonb,',
            '    \'local\'',
            ');'
        ].join('\n')], { env });
        let out = '';
        proc.stdout.on('data', function(d) { out += d; });
        proc.stderr.on('data', function(d) { out += d; });
        proc.on('close', function(code) { resolve({ code, out }); });
    });
    const r2 = new Promise(function(resolve) {
        const proc = spawn(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-c', [
            'SELECT public.process_sale_atomic(',
            '    \'{"id": "00000000-4000-8000-0000-000000000009", "total_amount": 100, "sale_location": "local"}\'::jsonb,',
            '    \'[{"id": "item-9", "product_id": "prod-2", "quantity": 1, "unit_price_at_sale": 100, "subtotal": 100}]\'::jsonb,',
            '    \'local\'',
            ');'
        ].join('\n')], { env });
        let out = '';
        proc.stdout.on('data', function(d) { out += d; });
        proc.stderr.on('data', function(d) { out += d; });
        proc.on('close', function(code) { resolve({ code, out }); });
    });
    const retryRes = await Promise.all([r1, r2]);
    const r1Ok = retryRes[0].code === 0 && (retryRes[0].out.includes('completed') || retryRes[0].out.includes('already_processed'));
    const r2Ok = retryRes[1].code === 0 && (retryRes[1].out.includes('completed') || retryRes[1].out.includes('already_processed'));
    const p2StockAfterRetry = parseInt(queryJson('SELECT stock_local FROM public.products WHERE id = \'prod-2\';'));
    const mov9Count = parseInt(queryJson('SELECT COUNT(*) FROM public.inventory_movements WHERE sale_id = \'00000000-4000-8000-0000-000000000009\';'));
    assert(r1Ok && r2Ok && mov9Count === 1 && p2StockAfterRetry === 2,
        '9. Dos Reintentos Concurrentes de Misma Venta: Ambos finalizan con exito, 1 solo movimiento registrado y stock descontado 1 sola vez');

    query('UPDATE public.products SET stock_local = 3, current_stock = 3 WHERE id = \'prod-2\';');
    // Test 8: Dos transacciones concurrentes compitiendo por stock limitado (prod-2 tiene stock 3)
    console.log('\n--- Ejecutando Prueba de Concurrencia Real (2 Procesos Paralelos en PostgreSQL) ---');
    const p1 = new Promise(function(resolve) {
        const proc = spawn(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-c', [
            'SELECT public.process_sale_atomic(',
            '    \x27{\x22id\x22: \x2200000000-4000-8000-0000-00000000008a\x22, \x22total_amount\x22: 200, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
            '    \x27[{\x22id\x22: \x22item-8a\x22, \x22product_id\x22: \x22prod-2\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200}]\x27::jsonb,',
            '    \x27local\x27',
            ');'
        ].join('\n')], { env });
        let out = '';
        proc.stdout.on('data', function(d) { out += d; });
        proc.stderr.on('data', function(d) { out += d; });
        proc.on('close', function(code) { resolve({ code, out }); });
    });

    const p2 = new Promise(function(resolve) {
        const proc = spawn(psql, ['-U', 'postgres', '-h', 'localhost', '-d', db, '-c', [
            'SELECT public.process_sale_atomic(',
            '    \x27{\x22id\x22: \x2200000000-4000-8000-0000-00000000008b\x22, \x22total_amount\x22: 200, \x22sale_location\x22: \x22local\x22}\x27::jsonb,',
            '    \x27[{\x22id\x22: \x22item-8b\x22, \x22product_id\x22: \x22prod-2\x22, \x22quantity\x22: 2, \x22unit_price_at_sale\x22: 100, \x22subtotal\x22: 200}]\x27::jsonb,',
            '    \x27local\x27',
            ');'
        ].join('\n')], { env });
        let out = '';
        proc.stdout.on('data', function(d) { out += d; });
        proc.stderr.on('data', function(d) { out += d; });
        proc.on('close', function(code) { resolve({ code, out }); });
    });

    const results = await Promise.all([p1, p2]);
    const resP1 = results[0];
    const resP2 = results[1];
    const finalStockP2 = parseInt(queryJson('SELECT stock_local FROM public.products WHERE id = \x27prod-2\x27;'));
    const p1Success = resP1.code === 0 && resP1.out.includes('true');
    const p2Success = resP2.code === 0 && resP2.out.includes('true');
    const oneFailed = (resP1.out.includes('INSUFFICIENT_STOCK') || resP2.out.includes('INSUFFICIENT_STOCK'));

    assert((p1Success !== p2Success) && oneFailed && finalStockP2 === 1,
        '8. Concurrencia Real de Stock: Una transaccion gana y descuenta 2, la otra aborta con INSUFFICIENT_STOCK; stock final = 1');

    console.log('\n================================================================');
    console.log('RESULTADO POSTGRESQL REAL: ' + passed + ' Aprobadas, ' + failed + ' Fallidas');
    console.log('================================================================\n');

    if (failed > 0) process.exit(1);
}

runRealPostgreSqlAudit().catch(function(e) {
    console.error('Fatal error in real postgresql test:', e);
    process.exit(1);
});
