const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function fix() {
    const orderId = '9767aa66-7cca-4473-9cc7-c324ea9cde19';
    const expenseCuotaId = '7541d8d1-6fa9-4f5a-97f2-74ba1e2cafa4';

    console.log(`Corrigiendo orden ${orderId}...`);
    // Corregir el pedido: cost a 300,000 y actualizar a 1 cuota pagada
    const { error: eOrder } = await supabase.from('supplier_orders').update({
        total_cost: 300000,
        installments_paid: 1
    }).eq('id', orderId);
    
    if (eOrder) console.error("Error en orden:", eOrder);
    else console.log("Orden corregida exitosamente.");

    console.log(`Corrigiendo gasto de cuota ${expenseCuotaId}...`);
    // Corregir el gasto de la cuota: monto a 50,000
    const { error: eExp } = await supabase.from('expenses').update({
        amount: 50000
    }).eq('id', expenseCuotaId);

    if (eExp) console.error("Error en gasto:", eExp);
    else console.log("Gasto corregido exitosamente.");
    
    // Verificamos
    const { data: o } = await supabase.from('supplier_orders').select('*').eq('id', orderId).single();
    console.log("Nueva orden:", o);
    
    const { data: e } = await supabase.from('expenses').select('*').eq('id', expenseCuotaId).single();
    console.log("Nuevo gasto:", e);
}

fix();
