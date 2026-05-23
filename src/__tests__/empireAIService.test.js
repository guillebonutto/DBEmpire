jest.mock('react-native', () => ({
    Platform: { OS: 'android' },
}));

// ─── Supabase mock ────────────────────────────────────────────────────
// We need to model the chained query builder pattern:
//   supabase.from('x').select('*').eq().limit() → Promise
//   supabase.from('x').insert([]) → Promise
//   supabase.from('x').select().eq().single() → Promise
//   supabase.from('x').update().eq() → Promise

const createMockChain = (resolvedValue = { data: null, error: null }) => {
    const chain = {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ data: null, error: null }),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(resolvedValue),
        single: jest.fn().mockResolvedValue(resolvedValue),
    };
    return chain;
};

const mockFromImpl = jest.fn();

jest.mock('../services/supabase', () => ({
    supabase: {
        auth: {
            getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
        },
        from: (...args) => mockFromImpl(...args),
    }
}));

// ─── Store mocks ──────────────────────────────────────────────────────
let mockFinanceSales = [];
let mockFinanceExpenses = [];
let mockFinanceSaleItems = [];
let mockProductsList = [];

jest.mock('../store/useFinanceStore', () => ({
    useFinanceStore: {
        getState: jest.fn(() => ({
            get sales() { return mockFinanceSales; },
            get expenses() { return mockFinanceExpenses; },
            get saleItems() { return mockFinanceSaleItems; },
        }))
    },
}));

jest.mock('../store/useProductStore', () => ({
    useProductStore: {
        getState: jest.fn(() => ({
            get products() { return mockProductsList; },
        }))
    },
}));

// ─── Global fetch mock ────────────────────────────────────────────────
global.fetch = jest.fn();

// ─── Import after all mocks ───────────────────────────────────────────
import { EmpireAIService } from '../services/empireAIService';
import { supabase } from '../services/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────

// The service caches its response for 15 minutes; force bust each test
function bustCache() {
    // Access module-level cache vars via the service internals indirectly
    // by passing forceRefresh=true to getInsights
}

// Build a chain that returns specific value on `single()`
function chainWithSingle(val) {
    const c = createMockChain();
    c.single.mockResolvedValue(val);
    return c;
}

// Build a chain that returns specific value on `limit()`
function chainWithLimit(val) {
    const c = createMockChain();
    c.limit.mockResolvedValue(val);
    return c;
}

describe('EmpireAIService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFinanceSales = [];
        mockFinanceExpenses = [];
        mockFinanceSaleItems = [];
        mockProductsList = [];
        supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
    });

    // ─────────────────────────────────────────────────
    // 1. logAIActions
    // ─────────────────────────────────────────────────
    describe('logAIActions', () => {
        test('should do nothing if missions array is empty or null', async () => {
            await EmpireAIService.logAIActions([], {});
            await EmpireAIService.logAIActions(null, {});
            expect(mockFromImpl).not.toHaveBeenCalled();
        });

        test('should insert AI action logs to Supabase', async () => {
            const mockChain = createMockChain();
            mockFromImpl.mockReturnValue(mockChain);

            const missions = [
                { type: 'online', title: 'Subir reel', reason: 'Exposición', confidence: 0.9 },
            ];

            await EmpireAIService.logAIActions(missions, { revenue: 1000 });

            expect(mockFromImpl).toHaveBeenCalledWith('ai_action_logs');
            expect(mockChain.insert).toHaveBeenCalledWith([
                expect.objectContaining({
                    action_type: 'online',
                    title: 'Subir reel',
                    reason: 'Exposición',
                    executed: false,
                    confidence_score: 0.9,
                    context_snapshot: { revenue: 1000 },
                })
            ]);
        });
    });

    // ─────────────────────────────────────────────────
    // 2. evaluatePendingActions
    // ─────────────────────────────────────────────────
    describe('evaluatePendingActions', () => {
        test('should do nothing if pending actions list is empty', async () => {
            const chain = chainWithLimit({ data: [] });
            mockFromImpl.mockReturnValue(chain);

            await EmpireAIService.evaluatePendingActions();

            // Called from() to query, but since no pending items, no update made
            expect(mockFromImpl).toHaveBeenCalledWith('ai_action_logs');
            expect(chain.limit).toHaveBeenCalledWith(5);
        });

        test('should update logs with revenue delta when sales occurred after action', async () => {
            const actionCreatedAt = '2026-05-01T00:00:00Z';
            const pendingLog = { id: 'log_001', created_at: actionCreatedAt };

            // Sales after the action
            mockFinanceSales = [
                { total_amount: '800', profit_generated: '300', created_at: '2026-05-02T10:00:00Z' },
                { total_amount: '400', profit_generated: '150', created_at: '2026-05-03T10:00:00Z' },
            ];

            const updateEqMock = jest.fn().mockResolvedValue({ error: null });
            let callCount = 0;

            mockFromImpl.mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call: the SELECT query
                    return chainWithLimit({ data: [pendingLog] });
                } else {
                    // Second call: the UPDATE query
                    return {
                        update: jest.fn().mockReturnValue({
                            eq: updateEqMock,
                        })
                    };
                }
            });

            await EmpireAIService.evaluatePendingActions();

            expect(updateEqMock).toHaveBeenCalledWith('id', 'log_001');
        });
    });

    // ─────────────────────────────────────────────────
    // 3. Role-based access restriction
    // ─────────────────────────────────────────────────
    describe('Role-based access restriction', () => {
        test('should return restricted response for seller with AI disabled', async () => {
            const mockUser = { id: 'user_abc' };
            supabase.auth.getUser.mockResolvedValue({ data: { user: mockUser } });

            // First from() call is for 'profiles'
            mockFromImpl.mockReturnValue(
                chainWithSingle({ data: { role: 'seller', ai_coach_enabled: false }, error: null })
            );

            const result = await EmpireAIService.getInsights(true, 'seller');

            expect(result.is_restricted).toBe(true);
            expect(result.summary).toContain('desactivado');
        });
    });

    // ─────────────────────────────────────────────────
    // 4. Fallback offline mode (HTTP 429 / network error)
    // ─────────────────────────────────────────────────
    describe('Fallback offline mode', () => {
        // Build a standard Supabase chain for all the getInsights queries
        function buildGetInsightsChain() {
            return {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockResolvedValue({ error: null }),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [] }),
                single: jest.fn().mockResolvedValue({ data: { value: 'fake-api-key' }, error: null }),
            };
        }

        test('should return local fallback data when API returns HTTP 429', async () => {
            // No auth user → skip profile check
            supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

            mockFromImpl.mockReturnValue(buildGetInsightsChain());

            // All fetch calls return 429 (service retries 3x with backoff)
            global.fetch.mockResolvedValue({ ok: false, status: 429 });

            mockProductsList = [
                { id: 'p1', name: 'Cable USB Tipo-C', current_stock: 2 },
                { id: 'p2', name: 'Auriculares Bluetooth', current_stock: 20 },
            ];

            const result = await EmpireAIService.getInsights(true, 'admin');

            expect(result.is_fallback).toBe(true);
            expect(result.urgency).toBe('Atención');
            expect(result.strategyA).toBeDefined();
            expect(result.strategyB).toBeDefined();
            expect(result.urgencyReason).toContain('Quota');
        }, 15000); // Generous timeout: service does exponential backoff (1s+2s+4s)

        test('should return fallback with stagnant product in strategyA when stock is high', async () => {
            supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
            mockFromImpl.mockReturnValue(buildGetInsightsChain());

            global.fetch.mockRejectedValue(new Error('Network error'));

            mockProductsList = [
                { id: 'p1', name: 'Stock Estancado', current_stock: 50 },
            ];

            const result = await EmpireAIService.getInsights(true, 'seller');

            expect(result.is_fallback).toBe(true);
            expect(result.strategyA.plan).toContain('Stock Estancado');
        });

        test('should return fallback with restock suggestion when stock is critical', async () => {
            supabase.auth.getUser.mockResolvedValue({ data: { user: null } });
            mockFromImpl.mockReturnValue(buildGetInsightsChain());

            global.fetch.mockRejectedValue(new Error('timeout'));

            mockProductsList = [
                { id: 'p1', name: 'Producto Crítico', current_stock: 1 },
            ];

            const result = await EmpireAIService.getInsights(true, 'admin');

            expect(result.is_fallback).toBe(true);
            expect(result.strategyB.plan).toContain('Producto Crítico');
        });
    });

    // ─────────────────────────────────────────────────
    // 5. JSON Cleaning logic
    // ─────────────────────────────────────────────────
    describe('JSON Cleaning (getInsights with valid API response)', () => {
        function mockSuccessfulInsights(jsonText) {
            supabase.auth.getUser.mockResolvedValue({ data: { user: null } });

            const chain = {
                select: jest.fn().mockReturnThis(),
                insert: jest.fn().mockResolvedValue({ error: null }),
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                not: jest.fn().mockReturnThis(),
                order: jest.fn().mockReturnThis(),
                limit: jest.fn().mockResolvedValue({ data: [] }),
                single: jest.fn().mockResolvedValue({ data: { value: 'fake-key' }, error: null }),
            };
            mockFromImpl.mockReturnValue(chain);

            global.fetch.mockResolvedValue({
                ok: true,
                status: 200,
                json: jest.fn().mockResolvedValue({
                    candidates: [{ content: { parts: [{ text: jsonText }] } }]
                })
            });
        }

        test('should correctly parse clean JSON from API response', async () => {
            const cleanJson = JSON.stringify({
                prediction: 'Crecimiento',
                urgency: 'Estable',
                actionId: 'none',
                actionText: 'VER',
                today_plan: { product: 'Powerbank' }
            });
            mockSuccessfulInsights(cleanJson);

            const result = await EmpireAIService.getInsights(true, 'seller');

            expect(result.prediction).toBe('Crecimiento');
            expect(result.urgency).toBe('Estable');
        });

        test('should strip conversational prefix and parse JSON correctly', async () => {
            const conversational = `¡Hola! Aquí tienes tu análisis: {"prediction": "Positivo", "urgency": "Crítico", "actionId": "promo", "actionText": "ACTUAR", "today_plan": {"product": "Cable HDMI"}} Espero que sea útil.`;
            mockSuccessfulInsights(conversational);

            const result = await EmpireAIService.getInsights(true, 'seller');

            expect(result.prediction).toBe('Positivo');
            expect(result.urgency).toBe('Crítico');
            expect(result.today_plan.product).toBe('Cable HDMI');
        });

        test('should strip markdown fences and parse JSON correctly', async () => {
            const markdownWrapped = '```json\n{"prediction": "Alta demanda", "urgency": "Atención", "actionId": "restock", "actionText": "REPONER", "today_plan": {"product": "Auriculares"}}\n```';
            mockSuccessfulInsights(markdownWrapped);

            const result = await EmpireAIService.getInsights(true, 'seller');

            expect(result.prediction).toBe('Alta demanda');
            expect(result.today_plan.product).toBe('Auriculares');
        });
    });
});
