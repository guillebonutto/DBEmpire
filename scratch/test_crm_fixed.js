const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://kxnqheckujcoytnfmxcd.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4bnFoZWNrdWpjb3l0bmZteGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxMzAxODYsImV4cCI6MjA4MDcwNjE4Nn0.0ScPBNWcJDNdt7PrBH_qg-07S3ZPOQXwSQ4afCbDCJ8');

async function check() {
    try {
        const product = { id: '87bcf160-49d1-476e-9931-8cae5d8fa0a2', name: 'Adaptador soporte de carga tipo C' };
        const productName = product.name.trim();
        const searchTerms = productName.split(' ').filter(t => t.length > 3);
        
        let productIds = [];
        if (product.id && !product.id.toString().includes('temp')) {
            productIds.push(product.id);
        }
        
        if (searchTerms.length > 0) {
            const searchFilters = searchTerms.map(term => `name.ilike.%${term}%`).join(',');
            const { data: matchedProds, error: prodErr } = await supabase
                .from('products')
                .select('id')
                .or(searchFilters);
            
            if (prodErr) throw prodErr;
            
            if (matchedProds) {
                matchedProds.forEach(p => {
                    if (!productIds.includes(p.id)) {
                        productIds.push(p.id);
                    }
                });
            }
        }

        console.log('Product IDs to search:', productIds);

        if (productIds.length === 0) {
            console.log('No product IDs found.');
            return;
        }

        const { data, error } = await supabase
            .from('sale_items')
            .select(`
                id,
                product_id,
                product:products(name),
                sale:sales(
                    client_id,
                    client:clients(id, name, phone, gender)
                )
            `)
            .in('product_id', productIds)
            .limit(100);

        if (error) throw error;
        
        const potentialClients = new Map();

        data.forEach(item => {
            const client = item.sale?.client;
            if (!client) return;
            if (client.id === '00000000-0000-0000-0000-000000000000') return; // Skip guest

            const itemName = item.product?.name || "";
            const isExactId = item.product_id === product.id;

            if (!potentialClients.has(client.id)) {
                potentialClients.set(client.id, {
                    ...client,
                    reason: isExactId ? 'Ya compró este producto' : 'Compró algo similar',
                    lastPurchasedItem: itemName
                });
            }
        });

        console.log('Potential Clients found:', Array.from(potentialClients.values()));
    } catch (e) {
        console.error('Test failed with error:', e);
    }
}
check();
