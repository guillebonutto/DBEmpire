const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function testInsert() {
    try {
        const productId = '87bcf160-49d1-476e-9931-8cae5d8fa0a2';
        const productName = 'Adaptador soporte de carga tipo C';
        const stockDifference = 2;
        const costPrice = 5818.78;
        const totalExpenseAmount = stockDifference * costPrice;
        
        console.log('1. Inserting into expenses...');
        const { data: expData, error: expError } = await supabase.from('expenses').insert({
            description: `Inventario: ${productName} (x${stockDifference})`,
            amount: totalExpenseAmount,
            category: 'Inventario',
            product_id: productId,
            quantity: stockDifference,
            details: [{ color: 'General', qty: stockDifference }],
            created_at: new Date().toISOString()
        }).select();
        
        if (expError) {
            console.error('Expense Insert Error:', expError);
        } else {
            console.log('Expense Insert Successful:', expData);
        }
        
        console.log('2. Inserting into supplier_orders...');
        const { data: orderData, error: orderError } = await supabase
            .from('supplier_orders')
            .insert({
                provider_name: 'Gabriela Liliana Castelli (AliExpress)',
                items_description: `Ingreso Manual: ${productName} (x${stockDifference})`,
                total_cost: totalExpenseAmount,
                status: 'received',
                installments_total: 1,
                installments_paid: 1,
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (orderError) {
            console.error('Order Insert Error:', orderError);
        } else {
            console.log('Order Insert Successful:', orderData);
            
            console.log('3. Inserting into supplier_order_items...');
            const { data: itemData, error: itemError } = await supabase.from('supplier_order_items').insert({
                supplier_order_id: orderData.id,
                product_id: productId,
                quantity: stockDifference,
                cost_per_unit: costPrice
            }).select();
            
            if (itemError) {
                console.error('Item Insert Error:', itemError);
            } else {
                console.log('Item Insert Successful:', itemData);
            }
        }
    } catch (e) {
        console.error('Exception caught:', e);
    }
}

testInsert();
