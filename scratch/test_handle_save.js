const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function testOrderSave() {
    const orderId = 'aa95f7a8-1ad2-4e62-b2e9-c55e5ba107ac';
    console.log("1. Fetching order...");
    const { data: order, error: orderErr } = await supabase
        .from('supplier_orders')
        .select('*')
        .eq('id', orderId)
        .single();
    if (orderErr) {
        console.error("Order fetch error:", orderErr);
        return;
    }
    console.log("Order found:", order);

    console.log("\n2. Fetching order items...");
    const { data: items, error: itemsErr } = await supabase
        .from('supplier_order_items')
        .select('*, products(name)')
        .eq('supplier_order_id', orderId);
    if (itemsErr) {
        console.error("Items fetch error:", itemsErr);
        return;
    }
    console.log("Items:", items);

    // Let's mimic the update payload
    const payload = {
        provider_name: order.provider_name,
        tracking_number: order.tracking_number,
        items_description: order.items_description,
        total_cost: order.total_cost,
        discount: order.discount,
        installments_total: order.installments_total,
        installments_paid: order.installments_paid,
        notes: order.notes,
        created_at: order.created_at,
        supplier_id: order.supplier_id,
        status: order.status
    };

    console.log("\n3. Updating order...");
    const { data: updateData, error: updateErr } = await supabase
        .from('supplier_orders')
        .update(payload)
        .eq('id', orderId)
        .select();
    if (updateErr) {
        console.error("Order update error:", updateErr);
    } else {
        console.log("Order update response:", updateData);
    }

    console.log("\n4. Deleting old items...");
    const deleteRes = await supabase
        .from('supplier_order_items')
        .delete()
        .eq('supplier_order_id', orderId);
    console.log("Delete response error:", deleteRes.error);
    console.log("Delete response status:", deleteRes.status);
    console.log("Delete response count:", deleteRes.count);

    console.log("\n5. Inserting items back...");
    const itemsPayload = items.map(it => ({
        supplier_order_id: orderId,
        product_id: it.product_id,
        temp_product_name: it.temp_product_name,
        quantity: it.quantity,
        cost_per_unit: it.cost_per_unit || 5818.78, // fallback to check if it was null/undefined
        supplier: it.supplier || order.provider_name,
        color: it.color || null
    }));
    console.log("Payload to insert:", itemsPayload);
    const insertRes = await supabase
        .from('supplier_order_items')
        .insert(itemsPayload)
        .select();
    console.log("Insert response error:", insertRes.error);
    console.log("Insert response data:", insertRes.data);
}

testOrderSave();
