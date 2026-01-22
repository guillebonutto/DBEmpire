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
