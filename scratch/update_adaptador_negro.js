const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function updateAll() {
    try {
        const productId = '87bcf160-49d1-476e-9931-8cae5d8fa0a2';
        
        console.log('1. Updating product stock and variants in Supabase...');
        const { data: prodData, error: prodError } = await supabase
            .from('products')
            .update({
                stock_local: 3,
                current_stock: 3,
                variants: [{ color: 'Negro', stock: 3 }]
            })
            .eq('id', productId)
            .select();
            
        if (prodError) {
            console.error('Error updating product:', prodError);
        } else {
            console.log('Product updated successfully:', prodData);
        }

        console.log('2. Updating the expense details to color Negro...');
        const { data: expData, error: expError } = await supabase
            .from('expenses')
            .update({
                details: [{ color: 'Negro', qty: 2 }]
            })
            .eq('id', '4085d68e-9297-4d4c-a241-3efdf2dfa9be')
            .select();

        if (expError) {
            console.error('Error updating expense:', expError);
        } else {
            console.log('Expense updated successfully:', expData);
        }

        console.log('3. Updating the supplier order item color to Negro...');
        const { data: itemData, error: itemError } = await supabase
            .from('supplier_order_items')
            .update({
                color: 'Negro'
            })
            .eq('id', 'c84bf16b-8b56-4b02-8591-357969ec2a4b')
            .select();

        if (itemError) {
            console.error('Error updating item:', itemError);
        } else {
            console.log('Item updated successfully:', itemData);
        }
    } catch (e) {
        console.error('Exception:', e);
    }
}

updateAll();
