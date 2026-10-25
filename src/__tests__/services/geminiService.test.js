import { GeminiService } from '../../services/geminiService';
import { supabase } from '../../services/supabase';

global.fetch = jest.fn();

const mockSingle = jest.fn();

jest.mock('../../services/supabase', () => {
    return {
        supabase: {
            from: jest.fn(() => ({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                single: mockSingle
            }))
        }
    };
});

describe('GeminiService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockSingle.mockReset();
    });

    it('throws error if API key is not configured', async () => {
        mockSingle.mockResolvedValueOnce({ data: null, error: null });
        await expect(GeminiService.generateMarketingCopy('Title', 'Desc', [])).rejects.toThrow('Google Gemini API Key no configurada');
    });

    it('generates marketing copy successfully', async () => {
        mockSingle.mockResolvedValueOnce({ data: { value: 'api-key-123' }, error: null });
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: 'OPCIÓN 1: Test Copy' }] } }]
            })
        });

        const result = await GeminiService.generateMarketingCopy('Promo', 'Great promo', [{ name: 'Prod A' }]);
        expect(result).toBe('OPCIÓN 1: Test Copy');
        expect(fetch).toHaveBeenCalledTimes(1);
    });

    it('analyzes receipt and returns parsed JSON', async () => {
        mockSingle.mockResolvedValueOnce({ data: { value: 'api-key-123' }, error: null });
        
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: '```json\n{"total": 500, "vendor": "Store"}\n```' }] } }]
            })
        });

        const result = await GeminiService.analyzeReceipt('base64data');
        expect(result).toEqual({ total: 500, vendor: 'Store' });
        // verify fetch payload contains image data
        const fetchArgs = fetch.mock.calls[0];
        expect(fetchArgs[1].body).toContain('base64data');
    });

    it('falls back to 2.5 flash on 503 error', async () => {
        mockSingle.mockResolvedValueOnce({ data: { value: 'api-key-123' }, error: null });
        
        // First call fails with 503
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 503,
            text: async () => 'Service Unavailable'
        });

        // Second call succeeds
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: 'Fallback success' }] } }]
            })
        });

        const result = await GeminiService.handleGeneralRequest('test prompt');
        expect(result).toBe('Fallback success');
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('handles general API errors correctly', async () => {
        mockSingle.mockResolvedValueOnce({ data: { value: 'api-key-123' }, error: null });
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                error: { message: 'API key not valid' }
            })
        });

        await expect(GeminiService.handleGeneralRequest('prompt')).rejects.toThrow('API Key inválida');
    });

    it('handles network errors correctly', async () => {
        mockSingle.mockResolvedValueOnce({ data: { value: 'api-key-123' }, error: null });
        fetch.mockRejectedValueOnce(new Error('Network request failed'));

        await expect(GeminiService.handleGeneralRequest('prompt')).rejects.toThrow('Error de red: La conexión con Gemini falló');
    });
    
    it('generates product marketing successfully', async () => {
        mockSingle.mockResolvedValueOnce({ data: { value: 'api-key-123' }, error: null });
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                candidates: [{ content: { parts: [{ text: '🔥 Promo' }] } }]
            })
        });

        const result = await GeminiService.generateProductMarketing('Prod B', 100);
        expect(result).toBe('🔥 Promo');
    });
});
