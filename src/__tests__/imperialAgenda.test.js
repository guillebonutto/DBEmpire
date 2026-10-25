import { parseReminderMeta, generateMonthGrid, CATEGORIES } from '../utils/agendaUtils';

describe('ImperialAgenda utils and parseReminderMeta', () => {
    test('should parse simple string notes gracefully', () => {
        const reminder = {
            id: 'rem_1',
            title: 'Llamar a proveedor',
            notes: 'Pedir 20 unidades de cargadores',
            due_date: '2024-10-16T18:00:00.000Z',
        };

        const parsed = parseReminderMeta(reminder);
        expect(parsed.category).toBe('educativo'); // default fallback
        expect(parsed.stage).toBe('Guión en proceso');
        expect(parsed.customText).toBe('Pedir 20 unidades de cargadores');
    });

    test('should parse JSON serialized notes correctly', () => {
        const payload = {
            category: 'entretenimiento',
            stage: 'En postproducción • Miniatura lista',
            text: 'Audio masterizado y miniaturas exportadas',
        };

        const reminder = {
            id: 'rem_2',
            title: 'Subir reel',
            notes: JSON.stringify(payload),
        };

        const parsed = parseReminderMeta(reminder);
        expect(parsed.category).toBe('entretenimiento');
        expect(parsed.stage).toBe('En postproducción • Miniatura lista');
        expect(parsed.customText).toBe('Audio masterizado y miniaturas exportadas');
    });

    test('should handle empty or malformed notes safely', () => {
        const reminderEmpty = { id: 'r1', notes: '' };

        const parsed = parseReminderMeta(reminderEmpty);
        expect(parsed.category).toBe('educativo');
        expect(parsed.customText).toBe('');

        const reminderMalformed = {
            id: 'r2',
            notes: '{ bad json',
        };

        const parsed2 = parseReminderMeta(reminderMalformed);
        expect(parsed2.category).toBe('educativo');
        expect(parsed2.customText).toBe('{ bad json');
    });

    test('should generate a valid 7-column calendar grid for October 2024', () => {
        // Oct 2024: Oct 1 is Tuesday -> startDay Monday overflow is 1 day (Sep 30)
        // 31 days in Oct -> total cells >= 35
        const grid = generateMonthGrid(2024, 9); // 9 is October (0-indexed)
        expect(grid.length).toBeGreaterThanOrEqual(35);
        expect(grid.length % 7).toBe(0);

        // First cell should be Sep 30
        expect(grid[0].day).toBe(30);
        expect(grid[0].isCurrentMonth).toBe(false);

        // Second cell should be Oct 1
        expect(grid[1].day).toBe(1);
        expect(grid[1].isCurrentMonth).toBe(true);

        // October 16 should be present
        const day16 = grid.find(c => c.isCurrentMonth && c.day === 16);
        expect(day16).toBeDefined();
        expect(day16.dateKey).toBe('2024-10-16');
    });

    test('should define all 6 primary content categories with colors', () => {
        expect(CATEGORIES).toHaveLength(6);
        const ids = CATEGORIES.map(c => c.id);
        expect(ids).toContain('educativo');
        expect(ids).toContain('entretenimiento');
        expect(ids).toContain('informativo');
        expect(ids).toContain('bts');
        expect(ids).toContain('promocional');
        expect(ids).toContain('inspiracional');
    });
});
