import { supabase } from './supabase';

export const CRMService = {
    /**
     * Finds clients who might be interested in a product based on their purchase history.
     * Matches by exact product restock or similar names.
     */
    findInterestedClients: async (product) => {
        try {
            if (!product || !product.name) return [];

            // 1. Get all sale items that match the product ID (direct restocked) 
            // OR match names (similar products)
            const productName = product.name.trim(); // e.g. "Nike Air"
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

            // Apply filters: Same ID OR Similar Name
            // For Simplicity in JS: fetch and then filter or use or() in Supabase
            const { data, error } = await query;
            if (error) throw error;

            if (!data) return [];

            // Transform and Deduplicate Clients
            const potentialClients = new Map();

            data.forEach(item => {
                const client = item.sale?.client;
                if (!client) return;
                if (client.id === '00000000-0000-0000-0000-000000000000') return; // Skip guest

                const itemName = item.product?.name || "";

                // Match Logic
                const isExactId = item.product_id === product.id;
                const isSimilarName = searchTerms.some(term =>
                    itemName.toLowerCase().includes(term.toLowerCase())
                );

                if (isExactId || isSimilarName) {
                    if (!potentialClients.has(client.id)) {
                        potentialClients.set(client.id, {
                            ...client,
                            reason: isExactId ? 'Ya compró este producto' : 'Compró algo similar',
                            lastPurchasedItem: itemName
                        });
                    }
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
