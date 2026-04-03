const { createClient } = require('@supabase/supabase-js');
const https = require('https');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';
const CRON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function triggerEdgeFunction() {
    return new Promise((resolve, reject) => {
        const url = `${SUPABASE_URL}/functions/v1/evaluate-ai-actions`;
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CRON_KEY}`
            }
        };

        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try { resolve(JSON.parse(data)); }
                catch (e) { resolve(data); }
            });
        });

        req.on('error', (e) => reject(e));
        req.write('{}');
        req.end();
    });
}

async function getMetricsForProduct(name) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const { data: items } = await supabase
        .from('sale_items')
        .select('unit_price_at_sale, quantity, products(name, cost_price), sales!inner(created_at, status)')
        .gte('sales.created_at', thirtyDaysAgo.toISOString())
        .in('sales.status', ['completed', 'exitosa', '']);
    
    let pRevenue = 0;
    let pProfit = 0;
    (items || []).forEach(item => {
        const prodName = item.products?.name || '';
        if (prodName.toLowerCase().includes(name.toLowerCase())) {
            const price = parseFloat(item.unit_price_at_sale) || 0;
            const cost = parseFloat(item.products?.cost_price) || 0;
            const qty = item.quantity || 1;
            pRevenue += price * qty;
            pProfit += (price - cost) * qty;
        }
    });
    return { monthlyRevenue: pRevenue, monthlyProfit: pProfit };
}

async function runBusinessValidation() {
    console.log('🚀 INICIANDO TEST DE VALIDACIÓN DE NEGOCIO (LOOP DE FEEDBACK)\n');

    const { data: prods } = await supabase.from('products').select('id, name, sale_price, cost_price').order('name').limit(1);
    const product_id = prods[0].id;
    const product_name = prods[0].name;
    const price = prods[0].sale_price || 1000;
    const cost = prods[0].cost_price || 500;
    const profit_sale = price - cost;

    console.log(`📦 Producto seleccionado: ${product_name} (ID: ${product_id})`);

    const snapshot = await getMetricsForProduct(product_name);

    const actionHash = `test_validate_${Date.now()}`;
    const { data: action, error: actionErr } = await supabase
        .from('ai_action_logs')
        .insert({
            title: `[TEST] Promoción Express: ${product_name}`,
            description: 'Acción controlada para validar el pipeline.',
            action_type: 'marketing',
            impact_predicted: 'medium',
            context_snapshot: snapshot,
            executed: false,
            evaluation_window_hours: -1,
            action_hash: actionHash,
            confidence_score: 5
        })
        .select()
        .single();
    if (actionErr) throw actionErr;

    console.log('\n✅ Marcando acción como ejecutada...');
    await supabase.from('ai_action_logs').update({ executed: true, executed_at: new Date().toISOString() }).eq('id', action.id);

    console.log('\n💰 Simulando impacto (Venta + Item)...');
    const { data: sale, error: saleErr } = await supabase.from('sales').insert({ total_amount: price, profit_generated: profit_sale, status: 'completed' }).select().single();
    if (saleErr) throw saleErr;

    const { error: itemErr } = await supabase.from('sale_items').insert({
        sale_id: sale.id,
        product_id: product_id,
        quantity: 1,
        unit_price_at_sale: price,
        subtotal: price // Fix: Not Null Constraint
    });
    if (itemErr) throw itemErr;

    console.log('\n🧠 Evaluando...');
    await new Promise(r => setTimeout(r, 4000));
    await triggerEdgeFunction();

    console.log('\n🔍 Verificando resultado...');
    await new Promise(r => setTimeout(r, 2000));
    const { data: finalLog } = await supabase.from('ai_action_logs').select('*').eq('id', action.id).single();

    console.log(`\n   TITULO: ${finalLog.title}`);
    console.log(`   PROFIT DELTA: $${finalLog.profit_delta.toFixed(2)}`);
    console.log(`   CONFIDENCE: ${finalLog.confidence_score}`);

    if (Math.abs(finalLog.profit_delta - profit_sale) < 1.0) {
        console.log('\n✅ VALIDACIÓN EXITOSA: El feedback loop atribuyó correctamente la ganancia al producto.');
    } else {
        console.log('\n❌ VALIDACIÓN FALLIDA: Discrepancia en el cálculo.');
    }

    // Cleanup
    await supabase.from('sale_items').delete().eq('sale_id', sale.id);
    await supabase.from('sales').delete().eq('id', sale.id);
    await supabase.from('ai_action_logs').delete().eq('id', action.id);
    console.log('\n🧹 Limpieza completada.');
}

runBusinessValidation().catch(e => {
    console.error('❌ Error fatal:', e.message);
    process.exit(1);
});
