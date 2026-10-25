import { EmpireAIService } from '../../services/empireAIService';
import { supabase } from '../../services/supabase';
import { useFinanceStore } from '../../store/useFinanceStore';
import { useProductStore } from '../../store/useProductStore';

jest.mock('../../services/supabase', () => {
    const mockEq = jest.fn().mockReturnThis();
    const mockSelect = jest.fn().mockReturnThis();
    const mockSingle = jest.fn().mockResolvedValue({ data: null, error: null });
    const mockUpdate = jest.fn().mockReturnThis();
    const mockInsert = jest.fn().mockReturnThis();
    const mockOrder = jest.fn().mockReturnThis();
    const mockLimit = jest.fn().mockReturnThis();
    const mockIn = jest.fn().mockReturnThis();
    const mockNot = jest.fn().mockReturnThis();
    const mockDelete = jest.fn().mockReturnThis();

    return {
        supabase: {
            from: jest.fn(() => ({
                select: mockSelect,
                eq: mockEq,
                single: mockSingle,
                update: mockUpdate,
                insert: mockInsert,
                order: mockOrder,
                limit: mockLimit,
                in: mockIn,
                not: mockNot,
                delete: mockDelete
            })),
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } } })
            }
        }
    };
});

jest.mock('../../store/useFinanceStore', () => ({
    useFinanceStore: {
        getState: jest.fn().mockReturnValue({ sales: [], expenses: [], saleItems: [] })
    }
}));

jest.mock('../../store/useProductStore', () => ({
    useProductStore: {
        getState: jest.fn().mockReturnValue({ products: [] })
    }
}));

jest.mock('../../store/useReminderStore', () => ({
    useReminderStore: {
        getState: jest.fn().mockReturnValue({ reminders: [] })
    }
}));

global.fetch = jest.fn();

describe('EmpireAIService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('suggestContent', () => {
        it('returns fallback content when fetch fails', async () => {
            fetch.mockRejectedValueOnce(new Error('Network error'));
            const result = await EmpireAIService.suggestContent('Tech');
            expect(result.title).toBe('Idea genial para Tech');
        });

        it('returns generated content when fetch succeeds', async () => {
            fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{ text: '{"title":"Test Title","notes":"Test Notes"}' }]
                        }
                    }]
                })
            });

            const result = await EmpireAIService.suggestContent('Tech');
            expect(result.title).toBe('Test Title');
            expect(result.notes).toBe('Test Notes');
        });
    });

    describe('getInsights', () => {
        it('returns restricted response if AI is not enabled for non-admin', async () => {
            supabase.from().single.mockResolvedValueOnce({
                data: { role: 'seller', ai_coach_enabled: false }
            });

            const result = await EmpireAIService.getInsights();
            expect(result.is_restricted).toBe(true);
            expect(result.summary).toContain('desactivado');
        });

        it('returns fallback insights when fetch fails', async () => {
            supabase.from().single.mockResolvedValueOnce({
                data: { role: 'admin', ai_coach_enabled: true } // allow access
            });
            fetch.mockRejectedValueOnce(new Error('API failure'));

            const result = await EmpireAIService.getInsights(true, 'admin');
            expect(result.is_fallback).toBe(true);
            expect(result.summary).toContain('Coach Táctico Disney');
        });
    });

    describe('markActionAsExecuted', () => {
        it('marks an action as executed', async () => {
            await EmpireAIService.markActionAsExecuted('log-id');
            expect(supabase.from).toHaveBeenCalledWith('ai_action_logs');
        });
        it('does nothing if id is missing', async () => {
            await EmpireAIService.markActionAsExecuted(null);
            expect(supabase.from).not.toHaveBeenCalled();
        });
    });

    describe('checkCompletedActions', () => {
        it('returns empty array if no ids provided', async () => {
            expect(await EmpireAIService.checkCompletedActions([])).toEqual([]);
        });
    });
});
