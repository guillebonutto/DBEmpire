import { supabase } from './supabase';
import { LocalDbService } from './localDbService';

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
            console.log('CRM Match error, using local fallback:', err.message);
            try {
                const [clients, sales, saleItems, products] = await Promise.all([
                    LocalDbService.getAll('clients'),
                    LocalDbService.getAll('sales'),
                    LocalDbService.getAll('sale_items'),
                    LocalDbService.getAll('products')
                ]);
                const prodMap = (products || []).reduce((acc, p) => ({ ...acc, [p.id]: p.name }), {});
                const clientMap = (clients || []).reduce((acc, c) => ({ ...acc, [c.id]: c }), {});
                const saleMap = (sales || []).reduce((acc, s) => ({ ...acc, [s.id]: s }), {});

                const matchedItems = (saleItems || []).filter(si => si.product_id === product.id);
                const potentialClients = new Map();
                matchedItems.forEach(si => {
                    const sale = saleMap[si.sale_id];
                    if (sale && sale.client_id) {
                        const client = clientMap[sale.client_id];
                        if (client && client.id !== '00000000-0000-0000-0000-000000000000' && !potentialClients.has(client.id)) {
                            potentialClients.set(client.id, {
                                ...client,
                                reason: 'Ya compró este producto',
                                lastPurchasedItem: prodMap[product.id] || product.name
                            });
                        }
                    }
                });
                return Array.from(potentialClients.values());
            } catch (e2) {
                return [];
            }
        }
    },

    /**
     * Finds clients who haven't made a purchase in the last 30 days.
     */
    getInactiveClients: async (days = 30) => {
        try {
            const dateThreshold = new Date();
            dateThreshold.setDate(dateThreshold.getDate() - days);

            let allClients = [];
            let recentSales = [];

            try {
                // 1. Try remote
                const { data: clients, error: clientError } = await supabase
                    .from('clients')
                    .select('id, name, phone, gender');
                if (clientError) throw clientError;
                allClients = clients || [];

                const { data: sales, error: salesError } = await supabase
                    .from('sales')
                    .select('client_id')
                    .gt('created_at', dateThreshold.toISOString());
                if (salesError) throw salesError;
                recentSales = sales || [];
            } catch (netErr) {
                // 2. Fallback to SQLite
                allClients = (await LocalDbService.getAll('clients')) || [];
                const localSales = (await LocalDbService.getAll('sales')) || [];
                const threshIso = dateThreshold.toISOString();
                recentSales = localSales.filter(s => s.created_at && s.created_at > threshIso);
            }

            const activeClientIds = new Set(recentSales.map(s => s.client_id));

            // 3. Filter inactive
            const inactive = allClients.filter(c =>
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
