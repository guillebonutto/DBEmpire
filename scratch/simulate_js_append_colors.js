const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function testJsAppendColors() {
    try {
        const productId = '87bcf160-49d1-476e-9931-8cae5d8fa0a2';
        const newColors = ['Negro', 'Rojo']; // Let's add Negro (already exists) and Rojo (new)

        console.log('1. Fetching current product...');
        const { data: product, error: fetchError } = await supabase
            .from('products')
            .select('variants')
            .eq('id', productId)
            .single();

        if (fetchError) throw fetchError;

        console.log('Current variants:', product.variants);

        // Append logic
        let currentVariants = Array.isArray(product.variants) ? product.variants : [];
        let updated = false;

        newColors.forEach(color => {
            if (!color) return;
            const cleanColor = color.trim();
            const exists = currentVariants.some(v => v.color?.toLowerCase() === cleanColor.toLowerCase());
            if (!exists) {
                currentVariants.push({ color: cleanColor, stock: 0 });
                updated = true;
            }
        });

        if (updated) {
            console.log('2. Updating product variants on Supabase...');
            const { data: updateData, error: updateError } = await supabase
                .from('products')
                .update({ variants: currentVariants })
                .eq('id', productId)
                .select();

            if (updateError) throw updateError;
            console.log('Update successful! New variants:', updateData[0].variants);
        } else {
            console.log('No new colors to append.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testJsAppendColors();
