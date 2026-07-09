import { supabase } from './supabase';

export const CRMService = {
    /**
     * Finds clients who might be interested in a product based on their purchase history.
     * Matches by exact product restock or similar names.
     */
    findInterestedClients: async (product) => {
        try {
            if (!product || !product.name) return [];

            const productName = product.name.trim(); // e.g. "Nike Air"
            const searchTerms = productName.split(' ').filter(t => t.length > 3);

            let productIds = [];
            if (product.id && !product.id.toString().includes('temp')) {
                productIds.push(product.id);
            }

            if (searchTerms.length > 0) {
                const searchFilters = searchTerms.map(term => `name.ilike.%${term}%`).join(',');
                const { data: matchedProds } = await supabase
                    .from('products')
                    .select('id')
                    .or(searchFilters);

                if (matchedProds) {
                    matchedProds.forEach(p => {
                        if (!productIds.includes(p.id)) {
                            productIds.push(p.id);
                        }
                    });
                }
            }

            if (productIds.length === 0) return [];

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
            if (!data) return [];

            // Transform and Deduplicate Clients
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

            return Array.from(potentialClients.values());
        } catch (err) {
            console.log('CRM Match error:', err);
            return [];
        }
    },

    /**
     * Finds clients who haven't made a purchase in the last 30 days.
     */
    getInactiveClients: async (days = 30) => {
        try {
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);

            // 1. Get all clients
            const { data: clients, error: clientError } = await supabase
                .from('clients')
                .select('id, name, phone, gender');

            if (clientError) throw clientError;

            // 2. Get recent sales
            const { data: recentSales, error: salesError } = await supabase
                .from('sales')
                .select('client_id')
                .gt('created_at', dateThreshold.toISOString());

            if (salesError) throw salesError;

            const activeClientIds = new Set(recentSales.map(s => s.client_id));

            // 3. Filter inactive
            const inactive = clients.filter(c =>
                !activeClientIds.has(c.id) &&
                c.id !== '00000000-0000-0000-0000-000000000000'
            );

            return inactive;
        } catch (err) {
            console.log('CRM Inactive error:', err);
            return [];
        }
    }
};
