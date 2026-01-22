import { GeminiService } from '../services/geminiService';
import { supabase } from '../services/supabase';

// Better mocking pattern
const mockSingle = jest.fn();
const mockEq = jest.fn(() => ({ single: mockSingle }));
const mockSelect = jest.fn(() => ({ eq: mockEq }));
const mockFrom = jest.fn(() => ({ select: mockSelect }));

jest.mock('../services/supabase', () => ({
    supabase: {
        from: (table) => mockFrom(table)
    }
}));

// Mock global fetch
global.fetch = jest.fn();

describe('GeminiService', () => {

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('generateMarketingCopy calls the API with correct prompt', async () => {
        // Mock API Key
        mockSingle.mockResolvedValue({
            data: { value: 'fake-key' },
            error: null
        });

        // Mock Fetch Response
        fetch.mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                candidates: [{ content: { parts: [{ text: 'OPCIÓN 1: Test' }] } }]
            })
        });

        const result = await GeminiService.generateMarketingCopy('Promo', 'Desc', [{ name: 'Item' }]);

        expect(result).toContain('OPCIÓN 1: Test');
        expect(fetch).toHaveBeenCalledWith(
            expect.stringContaining('fake-key'),
            expect.any(Object)
        );
    });

    test('analyzeReceipt cleans markdown before parsing JSON', async () => {
        mockSingle.mockResolvedValue({
            data: { value: 'fake-key' },
            error: null
        });

        const mockJsonResponse = '```json\n{"total": 100, "vendor": "Tester"}\n```';
        fetch.mockResolvedValue({
            json: jest.fn().mockResolvedValue({
                candidates: [{ content: { parts: [{ text: mockJsonResponse }] } }]
            })
        });

        const result = await GeminiService.analyzeReceipt('base64data');

        expect(result.total).toBe(100);
        expect(result.vendor).toBe('Tester');
    });

    test('handles missing API key error', async () => {
        mockSingle.mockResolvedValue({
            data: null,
            error: { message: 'Not found' }
        });

        await expect(GeminiService.generateMarketingCopy('A', 'B'))
            .rejects.toThrow('Google Gemini API Key no configurada');
    });
});
