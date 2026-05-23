jest.mock('react-native', () => ({
    Alert: {
        alert: jest.fn(),
    },
    Platform: {
        OS: 'android',
    },
}));

import { LocalDbService } from '../services/localDbService';
import * as SQLite from 'expo-sqlite';

// Mock expo-sqlite
const mockExecAsync = jest.fn().mockResolvedValue();
const mockGetAllAsync = jest.fn().mockResolvedValue([]);
const mockGetFirstAsync = jest.fn().mockImplementation(async (sql) => {
    if (sql.includes('__seed_version')) {
        return { value: '2' };
    }
    if (sql.includes('products')) {
        return { count: 50 };
    }
    if (sql.includes('sales')) {
        return { count: 120 };
    }
    if (sql.includes('supplier_orders')) {
        return { count: 8 };
    }
    return null;
});
const mockRunAsync = jest.fn().mockResolvedValue();
const mockWithTransactionAsync = jest.fn(async (callback) => {
    await callback();
});

const mockDb = {
    execAsync: mockExecAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
    withTransactionAsync: mockWithTransactionAsync,
};

jest.mock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

// Mock seed data to keep it light
jest.mock('../../assets/seed_data.json', () => ({
    __version: '2',
    products: [{ id: 'p1', name: 'Test Prod Seed', current_stock: 10 }],
    clients: [],
    sales: [],
    expenses: [],
    authorized_devices: [],
    settings: [],
    supplier_orders: [],
    supplier_order_items: [],
    sale_items: [],
}), { virtual: true });

describe('LocalDbService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('init should open sqlite database and create tables if not exists', async () => {
        const db = await LocalDbService.init();
        expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('empire_local.db');
        expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS reminders'));
        expect(db).toBe(mockDb);
    });

    test('saveItem should sanitize inputs and invoke runAsync in a transaction queue', async () => {
        const testProduct = {
            id: 'prod_123',
            name: 'Imperial Powerbank',
            sale_price: 1500,
            is_individual: true,
            invalid_column: 'should be removed'
        };

        await LocalDbService.saveItem('products', testProduct);

        // Verify transaction was used
        expect(mockWithTransactionAsync).toHaveBeenCalled();
        
        // Verify sanitization and SQL query
        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR REPLACE INTO products'),
            expect.any(Array)
        );

        // Get the values passed to runAsync
        const valuesPassed = mockRunAsync.mock.calls[0][1];
        expect(valuesPassed).toContain('prod_123');
        expect(valuesPassed).toContain('Imperial Powerbank');
        expect(valuesPassed).toContain(1500);
        expect(valuesPassed).toContain(1); // boolean converted to 1
        expect(valuesPassed).not.toContain('should be removed'); // sanitized out
    });

    test('saveItems should save multiple items under a single transaction', async () => {
        const items = [
            { id: 'rem_1', title: 'Reminder 1', due_date: '2026-05-24T12:00:00Z', completed: 0 },
            { id: 'rem_2', title: 'Reminder 2', due_date: '2026-05-25T12:00:00Z', completed: 1 }
        ];

        await LocalDbService.saveItems('reminders', items);

        expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
        expect(mockRunAsync).toHaveBeenCalledTimes(2);
    });

    test('getAll should execute select query on specified table', async () => {
        const mockRows = [{ id: 'rem_1', title: 'Test' }];
        mockGetAllAsync.mockResolvedValueOnce(mockRows);

        const result = await LocalDbService.getAll('reminders');
        expect(mockGetAllAsync).toHaveBeenCalledWith('SELECT * FROM reminders');
        expect(result).toEqual(mockRows);
    });

    test('deleteItem should execute delete query', async () => {
        await LocalDbService.deleteItem('reminders', 'rem_123');
        expect(mockRunAsync).toHaveBeenCalledWith(
            'DELETE FROM reminders WHERE id = ?',
            ['rem_123']
        );
    });

    test('queueForSync should insert record into pending_sync table', async () => {
        const payload = { amount: 500 };
        const metadata = { source: 'unit_test' };
        
        await LocalDbService.queueForSync('expenses', 'insert', payload, metadata);

        expect(mockRunAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO pending_sync'),
            [
                'expenses',
                'insert',
                JSON.stringify(payload),
                JSON.stringify(metadata)
            ]
        );
    });

    test('getPendingSyncs should fetch pending sync queue ordered by date', async () => {
        const mockSyncs = [{ id: 1, table_name: 'expenses' }];
        mockGetAllAsync.mockResolvedValueOnce(mockSyncs);

        const result = await LocalDbService.getPendingSyncs();
        expect(mockGetAllAsync).toHaveBeenCalledWith('SELECT * FROM pending_sync ORDER BY created_at ASC');
        expect(result).toEqual(mockSyncs);
    });

    test('removeSyncItem should delete pending sync from queue by id', async () => {
        await LocalDbService.removeSyncItem(45);
        expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM pending_sync WHERE id = ?', [45]);
    });

    test('getStats should aggregate product, sale, and debt counts', async () => {
        const stats = await LocalDbService.getStats();

        expect(stats).toEqual({
            products: 50,
            sales: 120,
            debts: 8
        });
    });
});
