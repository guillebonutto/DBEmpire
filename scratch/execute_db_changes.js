const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supFile = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'supabase.js'), 'utf8');
const urlMatch = supFile.match(/SUPABASE_URL\s*=\s*'([^']+)'/);
const keyMatch = supFile.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
    console.log("Starting DB execution of changes...");

    // 1. Insert aa95f7a8 order payment
    const g1 = {
        amount: 11637.56,
        category: 'Pago de Deuda',
        description: 'Pago de Deuda: Cuota 1/1: Gabriela Liliana Castelli (AliExpress) (Pedido #aa95)',
        created_at: '2026-06-15T00:27:34.459-03:00',
        details: 'aa95f7a8-1ad2-4e62-b2e9-c55e5ba107ac'
    };
    
    // 2. Insert 023f38c7 6th installment payment
    const g2 = {
        amount: 22808.50,
        category: 'Pago de Deuda',
        description: 'Pago de Deuda: Cuota 6/6: Gabriela Liliana Castelli (Pedido #023f)',
        created_at: '2026-06-15T01:30:00-03:00',
        details: '023f38c7-f304-40b0-901e-78a58ddb9581'
    };

    // 3. Insert 207.06 adjustment
    const g3 = {
        amount: 207.06,
        category: 'Pago de Deuda',
        description: 'Ajuste diferencia centavos/comisiones bancarias no registradas',
        created_at: '2026-06-15T01:35:00-03:00'
    };

    const { data: ins1, error: err1 } = await supabase.from('expenses').insert([g1, g2, g3]).select();
    if (err1) {
        console.error("Error inserting expenses:", err1);
        return;
    }
    console.log("Successfully inserted expenses:", ins1);

    // 4. Update order 023f38c7 to 6/6 installments paid
    const { data: upd, error: err2 } = await supabase
        .from('supplier_orders')
        .update({ installments_paid: 6 })
        .eq('id', '023f38c7-f304-40b0-901e-78a58ddb9581')
        .select();

    if (err2) {
        console.error("Error updating supplier order:", err2);
        return;
    }
    console.log("Successfully updated supplier order:", upd);
}
run();
