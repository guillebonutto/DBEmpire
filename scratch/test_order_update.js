const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testUpdate() {
    const orderId = '42d9afa3-8754-4e35-95f4-e06861c5ceef';
    
    console.log("--- 1. BUSCANDO ORDEN ---");
    const { data: order, error: orderErr } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('id', orderId)
        .single();
    if (orderErr) {
        console.error("Error fetching order:", orderErr);
        return;
    }
    console.log("Orden cargada:", order);

    console.log("\n--- 2. BUSCANDO ITEMS DE LA ORDEN ---");
    const { data: items, error: itemsErr } = await supabase
        .from('supplier_order_items')
        .select('*, products(name)')
        .eq('supplier_order_id', orderId);
    if (itemsErr) {
        console.error("Error fetching items:", itemsErr);
        return;
    }
    console.log(`Items encontrados (${items.length}):`);
    items.forEach(it => {
        console.log(`ID: ${it.id} | Prod: ${it.products?.name || it.temp_product_name} | Qty: ${it.quantity} | Cost: ${it.cost_per_unit} | Color: ${it.color}`);
    });

    console.log("\n--- 3. SIMULANDO ACTUALIZACION EN LA BASE DE DATOS ---");
    
    // El usuario quiere cambiar la cantidad del Adaptador Soporte de Carga Tipo C (ID del producto: 87bcf160-49d1-476e-9931-8cae5d8fa0a2) de 1 a 3.
    // Mapeamos los items cargados, cambiando la cantidad del adaptador de 1 a 3.
    const selectedProductsGrouped = [];
    
    items.forEach(it => {
        let qty = it.quantity;
        if (it.product_id === '87bcf160-49d1-476e-9931-8cae5d8fa0a2') {
            console.log(`Modificando cantidad del adaptador de ${it.quantity} a 3`);
            qty = 3;
        }

        selectedProductsGrouped.push({
            product: { id: it.product_id, name: it.products?.name || it.temp_product_name },
            cost: it.cost_per_unit,
            isNew: !it.product_id,
            tempName: it.temp_product_name,
            variants: [{ color: it.color || '', quantity: qty.toString() }],
            supplierName: it.supplier || ''
        });
    });

    // Calcular costo total nuevo
    const newTotalCost = selectedProductsGrouped.reduce((sum, item) => {
        const unitCost = parseFloat(item.cost) || 0;
        const itemQty = item.variants.reduce((vSum, v) => vSum + (parseFloat(v.quantity) || 0), 0);
        return sum + (itemQty * unitCost);
    }, 0);
    console.log("Nuevo costo total calculado:", newTotalCost);

    // Preparar payload de la orden
    const payload = {
        provider_name: order.provider_name,
        tracking_number: order.tracking_number,
        items_description: order.items_description,
        total_cost: newTotalCost,
        discount: order.discount,
        installments_total: order.installments_total,
        installments_paid: order.installments_paid,
        notes: order.notes,
        created_at: order.created_at,
        supplier_id: order.supplier_id,
        status: order.status
    };

    console.log("\nEjecutando update en supplier_orders...");
    try {
        const { error: orderUpdateErr } = await supabase
            .from('supplier_orders')
            .update(payload)
            .eq('id', orderId);
        if (orderUpdateErr) throw orderUpdateErr;
        console.log("✅ Actualización de la orden exitosa.");

        // Sync expenses (delete and re-insert)
        const oldTimestamp = order.created_at;
        console.log(`Borrando gastos antiguos con timestamp ${oldTimestamp}...`);
        const { error: deleteExpErr } = await supabase
            .from('expenses')
            .delete()
            .eq('category', 'Inventario')
            .eq('created_at', oldTimestamp);
        if (deleteExpErr) throw deleteExpErr;
        console.log("✅ Gastos antiguos borrados.");

        // Insert new expenses
        const newExpenses = [];
        for (const item of selectedProductsGrouped) {
            const name = item.product.name || item.tempName;
            const unitCost = parseFloat(item.cost) || 0;
            const totalQty = item.variants.reduce((sum, v) => sum + (parseInt(v.quantity) || 0), 0);
            
            if (unitCost > 0 && totalQty > 0) {
                newExpenses.push({
                    description: `Inventario: ${name}`,
                    amount: unitCost * totalQty,
                    category: 'Inventario',
                    product_id: item.isNew ? null : item.product.id,
                    quantity: totalQty,
                    details: item.variants.map(v => ({ 
                        color: v.color || 'General', 
                        qty: parseInt(v.quantity)
                    })),
                    created_at: payload.created_at
                });
            }
        }

        if (newExpenses.length > 0) {
            console.log("Insertando nuevos gastos...");
            const { error: insertExpErr } = await supabase.from('expenses').insert(newExpenses);
            if (insertExpErr) throw insertExpErr;
            console.log("✅ Nuevos gastos insertados.");
        }

        // Delete previous items
        console.log("Borrando items de orden antiguos...");
        const { error: deleteItemsErr } = await supabase
            .from('supplier_order_items')
            .delete()
            .eq('supplier_order_id', orderId);
        if (deleteItemsErr) throw deleteItemsErr;
        console.log("✅ Items antiguos borrados.");

        // Insert new items
        const itemsPayload = [];
        const productUpdatePromises = [];

        for (const p of selectedProductsGrouped) {
            if (!p.isNew && p.product.id) {
                const uniqueColors = [...new Set(p.variants.map(v => v.color).filter(c => c))];
                console.log(`Llamando a append_product_colors para ${p.product.name}...`);
                productUpdatePromises.push(
                    supabase.rpc('append_product_colors', {
                        p_id: p.product.id,
                        new_colors: uniqueColors
                    })
                );
                productUpdatePromises.push(
                    supabase.from('products').update({
                        name: p.product.name
                    }).eq('id', p.product.id)
                );
            }

            p.variants.forEach(v => {
                itemsPayload.push({
                    supplier_order_id: orderId,
                    product_id: p.isNew ? null : p.product.id,
                    temp_product_name: p.isNew ? p.tempName : null,
                    quantity: parseInt(v.quantity) || 1,
                    cost_per_unit: parseFloat(p.cost) || 0,
                    supplier: p.supplierName || payload.provider_name,
                    color: v.color || null
                });
            });
        }

        console.log("Ejecutando Promesas de actualización de productos...");
        await Promise.all(productUpdatePromises);
        console.log("✅ Promesas ejecutadas.");

        console.log("Insertando nuevos items de la orden...");
        const { error: insertItemsErr } = await supabase
            .from('supplier_order_items')
            .insert(itemsPayload);
        if (insertItemsErr) throw insertItemsErr;
        console.log("✅ Nuevos items de la orden insertados.");

        console.log("¡SIMULACIÓN COMPLETADA CON ÉXITO!");

    } catch (e) {
        console.error("❌ ERROR EN LA TRANSACCIÓN:", e);
    }
}

testUpdate();
