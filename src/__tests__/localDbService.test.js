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
const mockExecuteAsync = jest.fn().mockResolvedValue();
const mockFinalizeAsync = jest.fn().mockResolvedValue();
const mockPrepareAsync = jest.fn().mockImplementation(async (sql) => ({
    executeAsync: mockExecuteAsync,
    finalizeAsync: mockFinalizeAsync,
}));
const mockWithTransactionAsync = jest.fn(async (callback) => {
    await callback();
});

const mockDb = {
    execAsync: mockExecAsync,
    getAllAsync: mockGetAllAsync,
    getFirstAsync: mockGetFirstAsync,
    runAsync: mockRunAsync,
    prepareAsync: mockPrepareAsync,
    withTransactionAsync: mockWithTransactionAsync,
};

jest.mock('expo-sqlite', () => ({
    openDatabaseAsync: jest.fn().mockImplementation(() => Promise.resolve(mockDb)),
}));

// Mock seed data to keep it light
jest.mock('../../assets/seed_data.json', () => ({
    __version: '2',
    products: [{ id: 'p1', name: 'Test Prod Seed', current_stock: 10 }],
    clients: [{ id: 'c1', name: 'Test Client' }],
    sales: [{ id: 's1', total: 100 }],
    expenses: [{ id: 'e1', amount: 50 }],
    authorized_devices: [{ id: 'd1', name: 'Device 1' }],
    settings: [{ key: 'k1', value: 'v1' }],
    supplier_orders: [{ id: 'so1', total: 200 }],
    supplier_order_items: [{ id: 'soi1', qty: 2 }],
    sale_items: [{ id: 'si1', qty: 1 }],
    suppliers: [{ id: 'sup1', name: 'Supplier A' }],
}), { virtual: true });

describe('LocalDbService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPrepareAsync.mockImplementation(async (sql) => ({
            executeAsync: mockExecuteAsync,
            finalizeAsync: mockFinalizeAsync,
        }));
    });

    test('init should open sqlite database and create tables if not exists', async () => {
        const db = await LocalDbService.init();
        expect(SQLite.openDatabaseAsync).toHaveBeenCalledWith('empire_local.db');
        expect(mockExecAsync).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS reminders'));
        expect(db).toBe(mockDb);
    });

    test('runSeeding should execute if versions do not match', async () => {
        jest.resetModules();
        
        jest.doMock('react-native', () => ({ Alert: { alert: jest.fn() }, Platform: { OS: 'android' } }));
        jest.doMock('../../assets/seed_data.json', () => ({
            __version: '3',
            products: [{ id: 'p1', name: 'Test Prod Seed', current_stock: 10 }]
        }), { virtual: true });
        
        const mockRunAsyncIsolated = jest.fn().mockResolvedValue();
        const mockExecuteAsyncIsolated = jest.fn().mockResolvedValue();
        const mockFinalizeAsyncIsolated = jest.fn().mockResolvedValue();
        const mockPrepareAsyncIsolated = jest.fn().mockImplementation(async () => ({
            executeAsync: mockExecuteAsyncIsolated,
            finalizeAsync: mockFinalizeAsyncIsolated,
        }));
        const mockDbIsolated = {
            execAsync: jest.fn().mockResolvedValue(),
            getAllAsync: jest.fn().mockResolvedValue([]),
            getFirstAsync: jest.fn().mockResolvedValue({ value: '1' }), // Old version
            runAsync: mockRunAsyncIsolated,
            prepareAsync: mockPrepareAsyncIsolated,
            withTransactionAsync: jest.fn(async (cb) => { await cb(); })
        };
        
        jest.doMock('expo-sqlite', () => ({
            openDatabaseAsync: jest.fn().mockResolvedValue(mockDbIsolated)
        }));
        
        const isolatedLocalDbService = require('../services/localDbService').LocalDbService;
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        
        await isolatedLocalDbService.init();
        
        expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[LocalDb] NEW SEED DETECTED'));
        expect(mockRunAsyncIsolated).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM products'));
        expect(mockRunAsyncIsolated).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO settings (key, value) VALUES (\'__seed_version\', ?)'), ['3']);
        
        consoleSpy.mockRestore();
    });



    test('saveItem should sanitize inputs and invoke prepareAsync and executeAsync in a transaction queue', async () => {
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
        
        // Verify sanitization and prepared statement
        expect(mockPrepareAsync).toHaveBeenCalledWith(
            expect.stringContaining('INSERT OR REPLACE INTO products')
        );
        expect(mockExecuteAsync).toHaveBeenCalledWith(
            expect.arrayContaining(['prod_123', 'Imperial Powerbank', 1500, 1])
        );
        expect(mockFinalizeAsync).toHaveBeenCalled();

        // Get the values passed to executeAsync
        const valuesPassed = mockExecuteAsync.mock.calls[0][0];
        expect(valuesPassed).toContain('prod_123');
        expect(valuesPassed).toContain('Imperial Powerbank');
        expect(valuesPassed).toContain(1500);
        expect(valuesPassed).toContain(1); // boolean converted to 1
        expect(valuesPassed).not.toContain('should be removed'); // sanitized out
    });

    test('saveItems should save multiple items under a single transaction reusing prepared statements', async () => {
        const items = [
            { id: 'rem_1', title: 'Reminder 1', due_date: '2026-05-24T12:00:00Z', completed: 0 },
            { id: 'rem_2', title: 'Reminder 2', due_date: '2026-05-25T12:00:00Z', completed: 1 }
        ];

        await LocalDbService.saveItems('reminders', items);

        expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
        // Both items have identical column shape, so 1 prepareAsync and 2 executeAsync calls
        expect(mockPrepareAsync).toHaveBeenCalledTimes(1);
        expect(mockExecuteAsync).toHaveBeenCalledTimes(2);
        expect(mockFinalizeAsync).toHaveBeenCalledTimes(1);
    });

    test('saveItems should group items with different column shapes into separate prepared statements', async () => {
        const heterogeneousItems = [
            { id: 'p1', name: 'Product 1' }, // 2 columns
            { id: 'p2', name: 'Product 2', sale_price: 100 }, // 3 columns
            { id: 'p3', name: 'Product 3' } // same 2 columns as p1
        ];

        await LocalDbService.saveItems('products', heterogeneousItems);

        // 2 distinct shapes: (id, name) and (id, name, sale_price)
        expect(mockPrepareAsync).toHaveBeenCalledTimes(2);
        expect(mockExecuteAsync).toHaveBeenCalledTimes(3);
        expect(mockFinalizeAsync).toHaveBeenCalledTimes(2);
    });

    test('saveItems preserves exact input order for duplicate IDs across different column shapes', async () => {
        const executionOrderLog = [];
        const stmtTwoCols = {
            executeAsync: jest.fn().mockImplementation(async (vals) => {
                executionOrderLog.push({ type: '2cols', id: vals[0], name: vals[1] });
            }),
            finalizeAsync: jest.fn().mockResolvedValue(),
        };
        const stmtThreeCols = {
            executeAsync: jest.fn().mockImplementation(async (vals) => {
                executionOrderLog.push({ type: '3cols', id: vals[0], name: vals[1], price: vals[2] });
            }),
            finalizeAsync: jest.fn().mockResolvedValue(),
        };

        mockPrepareAsync.mockImplementation(async (sql) => {
            if (sql.includes('sale_price')) return stmtThreeCols;
            return stmtTwoCols;
        });

        // Interleaved writes with same ID 'dup_1':
        // 1. Initial write with 3 columns (price 100)
        // 2. Different product 'other_2' with 2 columns
        // 3. Update to 'dup_1' with 2 columns (name 'Updated Product') - MUST execute last for 'dup_1'
        const itemsWithDuplicate = [
            { id: 'dup_1', name: 'Initial Product', sale_price: 100 },
            { id: 'other_2', name: 'Other Item' },
            { id: 'dup_1', name: 'Updated Product' }
        ];

        await LocalDbService.saveItems('products', itemsWithDuplicate);

        // Verify statements were finalized
        expect(stmtTwoCols.finalizeAsync).toHaveBeenCalled();
        expect(stmtThreeCols.finalizeAsync).toHaveBeenCalled();

        // Verify strict chronological execution order
        expect(executionOrderLog).toHaveLength(3);
        expect(executionOrderLog[0]).toEqual({ type: '3cols', id: 'dup_1', name: 'Initial Product', price: 100 });
        expect(executionOrderLog[1]).toEqual({ type: '2cols', id: 'other_2', name: 'Other Item' });
        expect(executionOrderLog[2]).toEqual({ type: '2cols', id: 'dup_1', name: 'Updated Product' });
        // The last executed write for 'dup_1' is strictly the updated version
        expect(executionOrderLog[2].name).toBe('Updated Product');
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

    test('serializes queue writes with transactions saving product rows', async () => {
        let transactionActive = false;
        let pendingWriteOverlappedTransaction = false;
        mockWithTransactionAsync.mockImplementation(async (callback) => {
            transactionActive = true;
            await new Promise(resolve => setTimeout(resolve, 10));
            try {
                await callback();
            } finally {
                transactionActive = false;
            }
        });
        mockRunAsync.mockImplementation(async (sql, params) => {
            if (transactionActive && sql.includes('INSERT INTO pending_sync') && params?.[0] === 'products') {
                pendingWriteOverlappedTransaction = true;
            }
        });

        await Promise.all([
            LocalDbService.saveItem('products', { id: 'product-lock-test', name: 'Test' }),
            LocalDbService.queueForSync('products', 'UPDATE', { id: 'product-lock-test' })
        ]);

        expect(pendingWriteOverlappedTransaction).toBe(false);
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

    test('init should handle migration errors gracefully', async () => {
        // Reset the cached promise in localDbService by resetting modules
        jest.resetModules();
        jest.mock('react-native', () => ({ Alert: { alert: jest.fn() }, Platform: { OS: 'android' } }));
        jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn().mockRejectedValue(new Error('Migration failed')) }));
        jest.mock('../../assets/seed_data.json', () => ({ __version: '2' }), { virtual: true });
        
        const freshModule = require('../services/localDbService');
        await expect(freshModule.LocalDbService.init()).rejects.toThrow('Migration failed');
    });

    test('saveItem should reject if item is falsy', async () => {
        await expect(LocalDbService.saveItem('products', null)).rejects.toThrow();
    });

    test('saveItems should return early if items array is empty', async () => {
        await LocalDbService.saveItems('products', []);
        expect(mockRunAsync).not.toHaveBeenCalled();
    });

    test('replaceFullTable should clear table and insert items using prepared statements', async () => {
        const items = [{ id: '1', name: 'Product A' }];
        await LocalDbService.replaceFullTable('products', items);
        
        expect(mockWithTransactionAsync).toHaveBeenCalled();
        expect(mockRunAsync).toHaveBeenCalledWith('DELETE FROM products');
        expect(mockPrepareAsync).toHaveBeenCalledWith(expect.stringContaining('INSERT OR REPLACE INTO products'));
        expect(mockExecuteAsync).toHaveBeenCalledWith(expect.arrayContaining(['1', 'Product A']));
        expect(mockFinalizeAsync).toHaveBeenCalled();
    });

    test('should finalize prepared statement even if executeAsync throws, and propagate error for rollback', async () => {
        const failureStatement = {
            executeAsync: jest.fn().mockRejectedValueOnce(new Error('Constraint failure')),
            finalizeAsync: jest.fn().mockResolvedValue(),
        };
        mockPrepareAsync.mockResolvedValueOnce(failureStatement);

        await expect(LocalDbService.saveItem('products', { id: 'fail_1', name: 'Broken' })).rejects.toThrow('Constraint failure');
        expect(failureStatement.finalizeAsync).toHaveBeenCalled();
    });

    test('subsequent write after failure succeeds normally and queue order is preserved', async () => {
        const goodStatement = {
            executeAsync: jest.fn().mockResolvedValue(),
            finalizeAsync: jest.fn().mockResolvedValue(),
        };
        mockPrepareAsync.mockResolvedValueOnce(goodStatement);

        await LocalDbService.saveItem('products', { id: 'succ_1', name: 'Recovered' });
        expect(goodStatement.executeAsync).toHaveBeenCalledWith(expect.arrayContaining(['succ_1', 'Recovered']));
        expect(goodStatement.finalizeAsync).toHaveBeenCalled();
    });

    test('replaceFullTable should return early if items array is empty', async () => {
        await LocalDbService.replaceFullTable('products', []);
        // By design, replaceFullTable returns early if items is empty
        expect(mockWithTransactionAsync).not.toHaveBeenCalled();
    });

    test('getAll should throw when error occurs', async () => {
        mockGetAllAsync.mockRejectedValueOnce(new Error('Select failed'));
        await expect(LocalDbService.getAll('invalid_table')).rejects.toThrow('Select failed');
    });

    test('getById should query single row by id using getFirstAsync', async () => {
        mockGetFirstAsync.mockResolvedValueOnce({ id: 'p123', name: 'Zapatilla Nike' });
        const res = await LocalDbService.getById('products', 'p123');
        expect(mockGetFirstAsync).toHaveBeenCalledWith('SELECT * FROM products WHERE id = ?', ['p123']);
        expect(res).toEqual({ id: 'p123', name: 'Zapatilla Nike' });
    });

    test('getBy should query rows matching column and value using getAllAsync', async () => {
        mockGetAllAsync.mockResolvedValueOnce([{ id: 'si1', sale_id: 'sale99', product_id: 'p1' }]);
        const res = await LocalDbService.getBy('sale_items', 'sale_id', 'sale99');
        expect(mockGetAllAsync).toHaveBeenCalledWith('SELECT * FROM sale_items WHERE sale_id = ?', ['sale99']);
        expect(res).toHaveLength(1);
    });

    test('getById should return null without querying if id is falsy or null', async () => {
        const res = await LocalDbService.getById('products', null);
        expect(res).toBeNull();
        expect(mockGetFirstAsync).not.toHaveBeenCalled();
    });

    test('getById should throw error if table is not recognized', async () => {
        await expect(LocalDbService.getById('non_existent_table', 'p1')).rejects.toThrow(
            "[LocalDb] Table 'non_existent_table' is not recognized"
        );
    });

    test('getBy should throw error if column is not in allowed whitelist', async () => {
        await expect(LocalDbService.getBy('products', 'malicious_col OR 1=1', 'val')).rejects.toThrow(
            "[LocalDb] Column 'malicious_col OR 1=1' is not allowed for table 'products'"
        );
    });

    test('getBy should return empty array immediately if value is undefined', async () => {
        const res = await LocalDbService.getBy('products', 'active', undefined);
        expect(res).toEqual([]);
        expect(mockGetAllAsync).not.toHaveBeenCalled();
    });

    test('replaceFullTable should skip items that have pending local modifications in pending_sync', async () => {
        mockGetAllAsync.mockResolvedValueOnce([
            { payload: JSON.stringify({ id: 'prod_pending', name: 'Offline Edited Name' }) }
        ]);

        const remoteItems = [
            { id: 'prod_pending', name: 'Stale Remote Name' },
            { id: 'prod_other', name: 'Remote Fresh Prod' }
        ];

        const executeCalls = [];
        mockPrepareAsync.mockImplementation(async () => {
            return {
                executeAsync: jest.fn(async (args) => { executeCalls.push(args); }),
                finalizeAsync: jest.fn().mockResolvedValue()
            };
        });

        await LocalDbService.replaceFullTable('products', remoteItems);

        const executedIds = executeCalls.map(c => c[0]);
        expect(executedIds).toContain('prod_other');
        expect(executedIds).not.toContain('prod_pending');
    });

    describe('Priority 2 & 3: createOrderAtomic and replaceFullTable offline guarantees', () => {
        test('createOrderAtomic should execute sale, sale_items, product stock update and pending_sync atomically', async () => {
            const sale = { id: 'sale_atom_1', total_amount: 1000, client_id: 'c1' };
            const saleItems = [
                { id: 'item_atom_1', sale_id: 'sale_atom_1', product_id: 'p1', quantity: 2, subtotal: 1000 }
            ];
            const updatedProducts = [
                { id: 'p1', stock_local: 8, current_stock: 8 }
            ];
            const metadata = { items: [{ id: 'p1', qty: 2 }] };

            await LocalDbService.createOrderAtomic({ sale, saleItems, updatedProducts, metadata });

            expect(mockWithTransactionAsync).toHaveBeenCalled();
            // Verify runAsync calls for sale, item, product, and pending_sync
            const runCalls = mockRunAsync.mock.calls.map(c => c[0]);
            expect(runCalls.some(sql => sql.includes('INSERT OR REPLACE INTO sales'))).toBe(true);
            expect(runCalls.some(sql => sql.includes('INSERT OR REPLACE INTO sale_items'))).toBe(true);
            expect(runCalls.some(sql => sql.includes('INSERT OR REPLACE INTO products'))).toBe(true);
            expect(runCalls.some(sql => sql.includes('INSERT INTO pending_sync'))).toBe(true);
        });

        test('createOrderAtomic should abort and throw if an intermediate step fails, triggering transaction rollback', async () => {
            const sale = { id: 'sale_fail_1', total_amount: 500 };
            const saleItems = [{ id: 'item_fail_1', sale_id: 'sale_fail_1', product_id: 'p1', quantity: 1 }];

            // Simulate SQLite disk error on pending_sync insert
            mockRunAsync.mockImplementation(async (sql) => {
                if (sql.includes('INSERT INTO pending_sync')) {
                    throw new Error('SQLite disk I/O error');
                }
            });

            await expect(
                LocalDbService.createOrderAtomic({ sale, saleItems, updatedProducts: [], metadata: {} })
            ).rejects.toThrow('SQLite disk I/O error');

            // Restore mockRunAsync
            mockRunAsync.mockImplementation(async () => {});
        });

        test('replaceFullTable for sale_items should preserve local items belonging to pending sales in pending_sync', async () => {
            mockGetAllAsync.mockImplementation(async (sql, params) => {
                // 1. check pending_sync for table_name = 'sale_items'
                if (sql.includes('FROM pending_sync WHERE table_name = ?') && params && params[0] === 'sale_items') {
                    return [];
                }
                // 2. check pending_sync for table_name = 'sales'
                if (sql.includes("FROM pending_sync WHERE table_name = 'sales'")) {
                    return [
                        {
                            payload: JSON.stringify({ id: 'pending_sale_offline' }),
                            metadata: JSON.stringify({ items: [{ id: 'p1', qty: 1 }] })
                        }
                    ];
                }
                // 3. check local items belonging to pending_sale_offline
                if (sql.includes('FROM sale_items WHERE sale_id = ?')) {
                    return [{ id: 'offline_sale_item_uuid_1' }];
                }
                return [];
            });

            const remoteSaleItems = [
                { id: 'offline_sale_item_uuid_1', sale_id: 'pending_sale_offline', product_id: 'p1' },
                { id: 'remote_item_clean_2', sale_id: 'synced_sale', product_id: 'p2' }
            ];

            const executedRows = [];
            mockPrepareAsync.mockImplementation(async () => ({
                executeAsync: jest.fn(async (args) => { executedRows.push(args); }),
                finalizeAsync: jest.fn().mockResolvedValue()
            }));

            await LocalDbService.replaceFullTable('sale_items', remoteSaleItems);

            // DELETE query must preserve offline_sale_item_uuid_1
            const deleteCalls = mockRunAsync.mock.calls.filter(c => c[0].includes('DELETE FROM sale_items'));
            expect(deleteCalls.length).toBeGreaterThan(0);
            expect(deleteCalls[0][0]).toContain('WHERE id NOT IN (');
            expect(deleteCalls[0][1]).toContain('offline_sale_item_uuid_1');

            // Insert loop must NOT overwrite the pending offline item
            const executedIds = executedRows.map(r => r[0]);
            expect(executedIds).toContain('remote_item_clean_2');
            expect(executedIds).not.toContain('offline_sale_item_uuid_1');
        });

        test('replaceFullTable should preserve pending UPDATE and not resurrect pending DELETE rows', async () => {
            mockGetAllAsync.mockImplementation(async (sql, params) => {
                if (sql.includes('FROM pending_sync WHERE table_name = ?') && params && params[0] === 'products') {
                    return [
                        { action: 'UPDATE', payload: JSON.stringify({ id: 'prod_local_updated', name: 'Local Edit' }) },
                        { action: 'DELETE', payload: JSON.stringify({ id: 'prod_local_deleted' }) }
                    ];
                }
                return [];
            });

            const remoteStaleProducts = [
                { id: 'prod_local_updated', name: 'Stale Remote Name' },
                { id: 'prod_local_deleted', name: 'Zombie Resurrected' },
                { id: 'prod_fresh_remote', name: 'Fresh Product' }
            ];

            const executedRows = [];
            mockPrepareAsync.mockImplementation(async () => ({
                executeAsync: jest.fn(async (args) => { executedRows.push(args); }),
                finalizeAsync: jest.fn().mockResolvedValue()
            }));

            await LocalDbService.replaceFullTable('products', remoteStaleProducts);

            // 1. DELETE query must keep prod_local_updated, but NOT keep prod_local_deleted
            const deleteCalls = mockRunAsync.mock.calls.filter(c => c[0].includes('DELETE FROM products'));
            expect(deleteCalls.length).toBeGreaterThan(0);
            expect(deleteCalls[0][1]).toContain('prod_local_updated');
            expect(deleteCalls[0][1]).not.toContain('prod_local_deleted');

            // 2. Loop must skip both prod_local_updated and prod_local_deleted
            const executedIds = executedRows.map(r => r[0]);
            expect(executedIds).toContain('prod_fresh_remote');
            expect(executedIds).not.toContain('prod_local_updated');
            expect(executedIds).not.toContain('prod_local_deleted');
        });

        test('payDebtAtomic should update sale status and queue UPDATE in pending_sync inside a single SQLite transaction', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({
                id: 'debt_sale_1',
                client_id: 'c1',
                status: 'pending',
                total_amount: 5000
            });

            await LocalDbService.payDebtAtomic({
                saleId: 'debt_sale_1',
                status: 'completed',
                paidAt: '2026-10-25T20:00:00Z',
                notes: 'Liquidado en efectivo'
            });

            expect(mockWithTransactionAsync).toHaveBeenCalled();
            const runCalls = mockRunAsync.mock.calls;
            const saleUpdateCall = runCalls.find(c => c[0].includes('INSERT OR REPLACE INTO sales'));
            expect(saleUpdateCall).toBeDefined();
            expect(saleUpdateCall[1]).toContain('completed');
            expect(saleUpdateCall[1]).toContain('2026-10-25T20:00:00Z');

            const pendingSyncCall = runCalls.find(c => c[0].includes('INSERT INTO pending_sync'));
            expect(pendingSyncCall).toBeDefined();
            expect(pendingSyncCall[1][0]).toBe('sales');
            expect(pendingSyncCall[1][1]).toBe('UPDATE');
            expect(pendingSyncCall[1][2]).toContain('debt_sale_1');
        });

        test('payDebtAtomic should propagate error and trigger rollback if pending_sync write fails', async () => {
            mockGetFirstAsync.mockResolvedValueOnce({ id: 'debt_fail_1', status: 'pending' });

            mockRunAsync.mockImplementation(async (sql) => {
                if (sql.includes('INSERT INTO pending_sync')) {
                    throw new Error('SQLite disk I/O lock');
                }
            });

            await expect(
                LocalDbService.payDebtAtomic({ saleId: 'debt_fail_1', status: 'completed' })
            ).rejects.toThrow('SQLite disk I/O lock');

            // Restore mockRunAsync
            mockRunAsync.mockImplementation(async () => {});
        });
    });
});
