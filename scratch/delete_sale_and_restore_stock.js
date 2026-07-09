const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://kxnqheckujcoytnfmxcd.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const SALE_ID = '6420f8cf-6208-4c0f-bf5a-2eae3d639c48';

async function main() {
    console.log(`Starting process to delete sale ${SALE_ID} and restore stock...`);

    // 1. Fetch the sale details
    const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('id', SALE_ID)
        .single();

    if (saleError || !sale) {
        console.error('Error fetching sale:', saleError);
        return;
    }

    console.log(`\nFound Sale:`);
    console.log(`- Date: ${sale.created_at}`);
    console.log(`- Amount: $${sale.total_amount}`);
    console.log(`- Location: ${sale.sale_location}`);
    console.log(`- Status: ${sale.status}`);

    // 2. Fetch the sale items
    const { data: items, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', SALE_ID);

    if (itemsError || !items || items.length === 0) {
        console.error('Error fetching sale items:', itemsError);
        return;
    }

    console.log(`\nFound ${items.length} items associated with the sale:`);
    for (const item of items) {
        // Fetch the product details to show name and current stock
        const { data: prod } = await supabase
            .from('products')
            .select('name, stock_local, stock_cordoba, current_stock, variants')
            .eq('id', item.product_id)
            .single();

        console.log(`- Item ID: ${item.id}`);
        console.log(`  Product Name: "${prod ? prod.name : 'Unknown'}" (ID: ${item.product_id})`);
        console.log(`  Quantity: ${item.quantity}`);
        console.log(`  Color: ${item.color || 'None'}`);
        console.log(`  Current stock in DB: local=${prod?.stock_local}, cordoba=${prod?.stock_cordoba}, total=${prod?.current_stock}`);
        
        // 3. Calculate new stock values
        const qty = item.quantity;
        const newPayload = {};
        if (sale.sale_location === 'cordoba') {
            newPayload.stock_cordoba = (prod.stock_cordoba || 0) + qty;
            newPayload.stock_local = prod.stock_local || 0;
            console.log(`  Action: Adding ${qty} to Cordoba stock`);
        } else {
            newPayload.stock_local = (prod.stock_local || 0) + qty;
            newPayload.stock_cordoba = prod.stock_cordoba || 0;
            console.log(`  Action: Adding ${qty} to Local stock`);
        }
        newPayload.current_stock = newPayload.stock_local + newPayload.stock_cordoba;

        // If there is a color, restore variant stock
        if (item.color && prod.variants) {
            let variants = Array.isArray(prod.variants)
                ? prod.variants
                : (typeof prod.variants === 'string' ? JSON.parse(prod.variants) : []);
            
            if (Array.isArray(variants)) {
                const cleanColor = item.color.trim().toLowerCase();
                const vIdx = variants.findIndex(v => v.color?.trim().toLowerCase() === cleanColor);
                if (vIdx >= 0) {
                    const currentVarStock = parseInt(variants[vIdx].stock) || 0;
                    variants[vIdx].stock = (currentVarStock + qty).toString();
                    newPayload.variants = variants;
                    console.log(`  Action: Adding ${qty} to variant color "${item.color}" (New variant stock: ${variants[vIdx].stock})`);
                }
            }
        }

        console.log(`  Proposed stock update payload:`, newPayload);

        // Update the product stock in Supabase
        const { data: updatedProd, error: updateErr } = await supabase
            .from('products')
            .update(newPayload)
            .eq('id', item.product_id)
            .select('name, stock_local, stock_cordoba, current_stock')
            .single();

        if (updateErr) {
            console.error(`  Error updating stock:`, updateErr);
            return;
        }

        console.log(`  ✅ Stock updated successfully: local=${updatedProd.stock_local}, cordoba=${updatedProd.stock_cordoba}, total=${updatedProd.current_stock}`);
    }

    // 4. Delete the sale items
    console.log(`\nDeleting sale items...`);
    const { error: deleteItemsErr } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', SALE_ID);

    if (deleteItemsErr) {
        console.error('Error deleting sale items:', deleteItemsErr);
        return;
    }
    console.log(`✅ Sale items deleted.`);

    // 5. Delete the sale
    console.log(`Deleting sale record...`);
    const { error: deleteSaleErr } = await supabase
        .from('sales')
        .delete()
        .eq('id', SALE_ID);

    if (deleteSaleErr) {
        console.error('Error deleting sale:', deleteSaleErr);
        return;
    }
    console.log(`✅ Sale record deleted.`);
    
    console.log(`\n🎉 Process completed successfully!`);
}

main();
