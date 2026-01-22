import { BusinessLogic } from '../utils/calculations';

describe('BusinessLogic Utility', () => {

    test('calculateNetBalance should correctly sum income and subtract expenses from history', () => {
        const history = 1000;
        const income = 500;
        const expenses = 200;
        // 1000 + 500 - 200 = 1300
        expect(BusinessLogic.calculateNetBalance(income, expenses, history)).toBe(1300);
    });

    test('calculateNetBalance should handle negative balances', () => {
        const history = -500;
        const income = 100;
        const expenses = 200;
        // -500 + 100 - 200 = -600
        expect(BusinessLogic.calculateNetBalance(income, expenses, history)).toBe(-600);
    });

    test('calculateCommission should return correct amount for a percentage', () => {
        expect(BusinessLogic.calculateCommission(1000, 10)).toBe(100);
        expect(BusinessLogic.calculateCommission(500, 5)).toBe(25);
    });

    test('calculateROI should calculate return correctly', () => {
        // (200 - 100) / 100 * 100 = 100%
        expect(BusinessLogic.calculateROI(100, 200)).toBe(100);
        // (50 - 100) / 100 * 100 = -50%
        expect(BusinessLogic.calculateROI(100, 50)).toBe(-50);
    });

    test('calculateROI should return 0 if investment is 0', () => {
        expect(BusinessLogic.calculateROI(0, 100)).toBe(0);
    });

    describe('classifyOrderItems', () => {
        const mockProducts = [
            { id: 1, name: 'Prod A', cost_price: 100 },
            { id: 2, name: 'Prod B', cost_price: 200 }
        ];

        test('should auto-update if costs match', () => {
            const items = [{ product_id: 1, cost_per_unit: 100, quantity: 5 }];
            const result = BusinessLogic.classifyOrderItems(items, mockProducts);
            expect(result.toAutoUpdate.length).toBe(1);
            expect(result.toReview.length).toBe(0);
        });

        test('should send to review if costs differ', () => {
            const items = [{ product_id: 1, cost_per_unit: 120, quantity: 5 }];
            const result = BusinessLogic.classifyOrderItems(items, mockProducts);
            expect(result.toAutoUpdate.length).toBe(0);
            expect(result.toReview.length).toBe(1);
        });

        test('should send to review if product is unlinked', () => {
            const items = [{ product_id: null, temp_product_name: 'New', cost_per_unit: 50 }];
            const result = BusinessLogic.classifyOrderItems(items, mockProducts);
            expect(result.toReview.length).toBe(1);
            expect(result.toReview[0].isNew).toBe(true);
        });
    });
});
