const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    const product = { id: '87bcf160-49d1-476e-9931-8cae5d8fa0a2', name: 'Adaptador soporte de carga tipo C' };
    const productName = product.name.trim();
    const searchTerms = productName.split(' ').filter(t => t.length > 3);

    let query = supabase
        .from('sale_items')
        .select(`
            id,
            product_id,
            product:products(name),
            sale:sales(
                client_id,
                client:clients(id, name, phone, gender)
            )
        `);

    if (product.id && !product.id.toString().includes('temp')) {
        query = query.or(`product_id.eq.${product.id},product_name.ilike.%${searchTerms[0] || ''}%`);
    } else if (searchTerms.length > 0) {
        query = query.ilike('product_name', `%${searchTerms[0]}%`);
    }

    const { data, error } = await query.limit(100);
    console.log('Error:', error);
    console.log('Data:', data);
}
check();
