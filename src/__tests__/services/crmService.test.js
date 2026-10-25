import { CRMService } from '../../services/crmService';
import { supabase } from '../../services/supabase';
import { LocalDbService } from '../../services/localDbService';

jest.mock('../../services/supabase', () => {
    const mSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        or: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        gt: jest.fn().mockReturnThis()
    };
    return { supabase: mSupabase };
});

jest.mock('../../services/localDbService', () => ({
    LocalDbService: {
        getAll: jest.fn()
    }
}));

describe('CRMService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('findInterestedClients', () => {
        it('returns empty array if product is invalid', async () => {
            expect(await CRMService.findInterestedClients(null)).toEqual([]);
            expect(await CRMService.findInterestedClients({})).toEqual([]);
        });

        it('returns matched clients successfully from remote', async () => {
            const product = { id: 'p1', name: 'Nike Air Max' };

            // Mock matchedProds
            supabase.or.mockResolvedValueOnce({ data: [{ id: 'p2' }], error: null });
            
            // Mock sale items
            supabase.limit.mockResolvedValueOnce({
                data: [
                    { product_id: 'p1', product: { name: 'Nike Air Max' }, sale: { client: { id: 'c1', name: 'John' } } },
                    { product_id: 'p2', product: { name: 'Nike Air' }, sale: { client: { id: 'c2', name: 'Jane' } } },
                    { product_id: 'p1', product: { name: 'Nike Air Max' }, sale: { client: { id: '00000000-0000-0000-0000-000000000000', name: 'Guest' } } }
                ],
                error: null
            });

            const result = await CRMService.findInterestedClients(product);

            expect(result).toHaveLength(2);
            expect(result.find(c => c.id === 'c1').reason).toBe('Ya compró este producto');
            expect(result.find(c => c.id === 'c2').reason).toBe('Compró algo similar');
        });

        it('falls back to local db if remote fails', async () => {
            const product = { id: 'p1', name: 'Nike Air Max' };

            // Remote fails
            supabase.or.mockRejectedValueOnce(new Error('Network error'));

            // Local mocks
            LocalDbService.getAll
                .mockResolvedValueOnce([{ id: 'c1', name: 'John' }, { id: '00000000-0000-0000-0000-000000000000' }]) // clients
                .mockResolvedValueOnce([{ id: 's1', client_id: 'c1' }, { id: 's2', client_id: '00000000-0000-0000-0000-000000000000' }]) // sales
                .mockResolvedValueOnce([{ product_id: 'p1', sale_id: 's1' }, { product_id: 'p1', sale_id: 's2' }]) // sale_items
                .mockResolvedValueOnce([{ id: 'p1', name: 'Nike Air Max' }]); // products

            const result = await CRMService.findInterestedClients(product);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('c1');
            expect(result[0].reason).toBe('Ya compró este producto');
        });

        it('returns empty array if fallback fails completely', async () => {
            supabase.or.mockRejectedValueOnce(new Error('Network error'));
            LocalDbService.getAll.mockRejectedValueOnce(new Error('Local error'));
            
            const result = await CRMService.findInterestedClients({ id: 'p1', name: 'Nike' });
            expect(result).toEqual([]);
        });
    });

    describe('getInactiveClients', () => {
        it('returns inactive clients from remote', async () => {
            const mockClients = [
                { id: 'c1', name: 'Active' },
                { id: 'c2', name: 'Inactive' },
                { id: '00000000-0000-0000-0000-000000000000', name: 'Guest' }
            ];
            const mockSales = [{ client_id: 'c1' }];

            // Clients fetch
            supabase.select.mockResolvedValueOnce({ data: mockClients, error: null });
            // Sales fetch
            supabase.gt.mockResolvedValueOnce({ data: mockSales, error: null });

            const result = await CRMService.getInactiveClients(30);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('c2');
        });

        it('falls back to local if remote fails', async () => {
            supabase.select.mockRejectedValueOnce(new Error('Network error'));

            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - 40);

            const recentDate = new Date();
            recentDate.setDate(recentDate.getDate() - 10);

            LocalDbService.getAll
                .mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }]) // clients
                .mockResolvedValueOnce([
                    { client_id: 'c1', created_at: recentDate.toISOString() }, // active
                    { client_id: 'c2', created_at: pastDate.toISOString() }    // inactive
                ]); // sales

            const result = await CRMService.getInactiveClients(30);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('c2');
        });

        it('returns empty array if both fail', async () => {
            supabase.select.mockRejectedValueOnce(new Error('Net error'));
            LocalDbService.getAll.mockRejectedValueOnce(new Error('Local error'));

            const result = await CRMService.getInactiveClients(30);
            expect(result).toEqual([]);
        });
    });
});
