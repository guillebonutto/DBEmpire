import { CRMService } from '../services/crmService';
import { supabase } from '../services/supabase';

// Mock Supabase
jest.mock('../services/supabase', () => ({
    supabase: {
        from: jest.fn(() => ({
            select: jest.fn(() => ({
                gt: jest.fn(() => ({
                    // For getInactiveClients
                })),
                order: jest.fn(() => Promise.resolve({ data: [], error: null }))
            })),
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
        }))
    }
}));

describe('CRMService', () => {

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('findInterestedClients handles empty products', async () => {
        const clients = await CRMService.findInterestedClients(null);
        expect(clients).toEqual([]);
    });

    test('findInterestedClients finds matching clients based on product IDs', async () => {
        const mockProducts = [{ id: 'prod_1' }, { id: 'prod_2' }];
        const mockSaleItems = [
            {
                id: '1',
                product_id: 'prod_1',
                product: { name: 'Adaptador soporte' },
                sale: {
                    client: { id: 'client_1', name: 'Client A', phone: '1234', gender: 'M' }
                }
            }
        ];

        supabase.from.mockImplementation((table) => {
            if (table === 'products') {
                return {
                    select: jest.fn().mockReturnThis(),
                    or: jest.fn().mockResolvedValue({ data: mockProducts, error: null })
                };
            }
            if (table === 'sale_items') {
                return {
                    select: jest.fn().mockReturnThis(),
                    in: jest.fn().mockReturnThis(),
                    limit: jest.fn().mockResolvedValue({ data: mockSaleItems, error: null })
                };
            }
        });

        const product = { id: 'prod_1', name: 'Adaptador soporte de carga tipo C' };
        const clients = await CRMService.findInterestedClients(product);
        expect(clients.length).toBe(1);
        expect(clients[0].name).toBe('Client A');
        expect(clients[0].reason).toBe('Ya compró este producto');
    });

    test('getInactiveClients calculates inactive correctly', async () => {
        // Mock clients
        const mockClients = [{ id: '1', name: 'Active' }, { id: '2', name: 'Inactive' }];
        // Mock recent sales (only client 1 is active)
        const mockSales = [{ client_id: '1' }];

        supabase.from.mockImplementation((table) => {
            if (table === 'clients') {
                return {
                    select: jest.fn().mockResolvedValue({ data: mockClients, error: null })
                };
            }
            if (table === 'sales') {
                return {
                    select: jest.fn().mockReturnThis(),
                    gt: jest.fn().mockResolvedValue({ data: mockSales, error: null })
                };
            }
        });

        const inactive = await CRMService.getInactiveClients(30);
        expect(inactive.length).toBe(1);
        expect(inactive[0].name).toBe('Inactive');
    });
});
