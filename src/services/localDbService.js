import * as SQLite from 'expo-sqlite';
import { Alert } from 'react-native';

const DATABASE_NAME = 'empire_local.db';

const TABLE_COLUMNS = {
    products: ['id', 'name', 'sale_price', 'cost_price', 'current_stock', 'stock_local',
               'category', 'barcode', 'image_url', 'active', 'description',
               'stock_cordoba', 'provider', 'is_individual', 'sale_price_cordoba', 'variants_json',
               'internet_cost', 'electricity_cost', 'is_packaging', 'packaging_type', 'packaging_cost', 'packaging_sticker_cost'],
    sales: ['id', 'total_amount', 'profit_generated', 'commission_amount', 'client_id',
            'payment_method', 'status', 'created_at', 'seller_id', 'device_sig',
            'sale_location', 'is_leader_sale', 'notes', 'manual_discount_amount', 'paid_at'],
    expenses: ['id', 'amount', 'description', 'category', 'created_at', 'details'],
    clients: ['id', 'name', 'phone', 'email', 'created_at', 'notes', 'status', 'address', 'gender'],
    authorized_devices: ['id', 'device_signature', 'role', 'is_active'],
    settings: ['key', 'value'],
    sale_items: ['id', 'sale_id', 'product_id', 'quantity', 'unit_price_at_sale', 'subtotal', 'color'],
    supplier_orders: ['id', 'provider_name', 'total_amount', 'total_cost', 'status', 'created_at', 'notes', 'installments_total', 'installments_paid', 'discount', 'received_at'],
    supplier_order_items: ['id', 'supplier_order_id', 'product_id', 'quantity', 'cost_per_unit', 'color', 'temp_product_name'],
    pending_sync: ['id', 'table_name', 'action', 'payload', 'metadata', 'created_at'],
    suppliers: ['id', 'name', 'phone', 'email', 'notes', 'active', 'created_at'],
    reminders: ['id', 'title', 'notes', 'due_date', 'completed', 'notification_id'],
    promotions: ['id', 'title', 'description', 'type', 'value', 'min_qty', 'active', 'created_at'],
    incidents: ['id', 'type', 'description', 'amount', 'created_at', 'details']
};

function sanitizeRow(tableName, row) {
    const allowedCols = TABLE_COLUMNS[tableName];
    if (!allowedCols) return row;
    const result = {};
    for (const col of allowedCols) {
        let val = row[col];
        if (col === 'variants_json' && row['variants'] !== undefined) {
            val = JSON.stringify(row['variants']);
        }
        if (val === undefined || val === null) continue;
        if (typeof val === 'boolean') val = val ? 1 : 0;
        if (typeof val === 'object' && val !== null) val = JSON.stringify(val);
        result[col] = val;
    }
    return result;
}

let _db = null;
let _initPromise = null;
let _queue = [];
let _processing = false;
let _writeLock = Promise.resolve();

async function withWriteLock(operation) {
    let release;
    const previousWrite = _writeLock;
    _writeLock = new Promise(resolve => {
        release = resolve;
    });
    await previousWrite;
    try {
        return await operation();
    } finally {
        release();
    }
}

async function processQueue() {
    if (_processing || _queue.length === 0) return;
    _processing = true;
    while (_queue.length > 0) {
        const { tableName, items, replace, resolve, reject } = _queue.shift();
        try {
            if (!_db) throw new Error("Database not initialized");
            await withWriteLock(() => _db.withTransactionAsync(async () => {
                let pendingIds = new Set();
                let pendingDeleteIds = new Set();
                if (replace) {
                    // Check if there are any pending_sync items for this table
                    try {
                        const pendingRows = await _db.getAllAsync(`SELECT action, payload FROM pending_sync WHERE table_name = ?`, [tableName]);
                        if (pendingRows) {
                            pendingRows.forEach(r => {
                                try {
                                    const p = JSON.parse(r.payload);
                                    const id = p && (p.id !== undefined ? p.id : p);
                                    if (id) {
                                        pendingIds.add(id); pendingIds.add(String(id));
                                        if (r.action === 'DELETE') {
                                            pendingDeleteIds.add(id); pendingDeleteIds.add(String(id));
                                        }
                                    }
                                } catch (_) {}
                            });
                        }
                    } catch (_) {}

                    // SPECIAL RECONCILIATION FOR sale_items:
                    // When replacing sale_items, pending offline sales in pending_sync (table_name = 'sales')
                    // have local items stored in SQLite sale_items table that must NOT be wiped out.
                    if (tableName === 'sale_items') {
                        try {
                            const pendingSales = await _db.getAllAsync(`SELECT payload, metadata FROM pending_sync WHERE table_name = 'sales'`);
                            if (pendingSales && pendingSales.length > 0) {
                                for (const ps of pendingSales) {
                                    try {
                                        const p = JSON.parse(ps.payload);
                                        const m = JSON.parse(ps.metadata);
                                        const saleId = p && p.id;
                                        if (saleId) {
                                            const localItems = await _db.getAllAsync(`SELECT id FROM sale_items WHERE sale_id = ?`, [saleId]);
                                            if (localItems) {
                                                localItems.forEach(li => {
                                                    if (li && li.id) {
                                                        pendingIds.add(li.id);
                                                        pendingIds.add(String(li.id));
                                                    }
                                                });
                                            }
                                        }
                                        if (m && m.items && Array.isArray(m.items)) {
                                            m.items.forEach((it, idx) => {
                                                if (it.item_id) { pendingIds.add(it.item_id); pendingIds.add(String(it.item_id)); }
                                                if (it.id_sale_item) { pendingIds.add(it.id_sale_item); pendingIds.add(String(it.id_sale_item)); }
                                                if (saleId) {
                                                    const legacyId = `${saleId}_${it.id || idx}_${idx}`;
                                                    pendingIds.add(legacyId);
                                                }
                                            });
                                        }
                                    } catch (_) {}
                                }
                            }
                        } catch (_) {}
                    }

                    const keepIds = Array.from(pendingIds).filter(id => !pendingDeleteIds.has(id));
                    if (keepIds.length === 0) {
                        await _db.runAsync(`DELETE FROM ${tableName}`);
                    } else {
                        const placeholders = keepIds.map(() => '?').join(',');
                        await _db.runAsync(`DELETE FROM ${tableName} WHERE id NOT IN (${placeholders})`, keepIds);
                    }
                }

                const preparedStatements = new Map();
                try {
                    for (const item of items) {
                        if (replace && (pendingIds.has(item.id) || pendingIds.has(String(item.id)))) {
                            continue;
                        }
                        const clean = sanitizeRow(tableName, item);
                        const keys = Object.keys(clean);
                        if (keys.length === 0) continue;
                        const groupKey = keys.join(',');

                        let statement = preparedStatements.get(groupKey);
                        if (!statement) {
                            const placeholders = keys.map(() => '?').join(',');
                            const columns = keys.join(',');
                            const sql = `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`;
                            statement = await _db.prepareAsync(sql);
                            preparedStatements.set(groupKey, statement);
                        }

                        await statement.executeAsync(Object.values(clean));
                    }
                } finally {
                    for (const statement of preparedStatements.values()) {
                        try {
                            await statement.finalizeAsync();
                        } catch (finalizeErr) {
                            console.warn(`[LocalDb] Error finalizing statement for ${tableName}:`, finalizeErr);
                        }
                    }
                }
            }));
            console.log(`[LocalDb] Saved ${items.length} items to ${tableName} (replace: ${!!replace})`);
            resolve();
        } catch (e) {
            console.error(`[LocalDb] Error saving to ${tableName}:`, e.message);
            reject(e);
        }
    }
    _processing = false;
}

async function rawSaveItems(db, tableName, items, replace = false) {
    if (!items || items.length === 0) return;
    return new Promise((resolve, reject) => {
        _queue.push({ tableName, items, replace, resolve, reject });
        processQueue();
    });
}

async function init() {
    if (_db) return _db;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        try {
            const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
            await db.execAsync('PRAGMA busy_timeout = 5000;');
            
            // 🚀 SCHEMA MIGRATION: Fix sale_items id from INTEGER to TEXT
            const tableInfo = await db.getAllAsync("PRAGMA table_info(sale_items)");
            const idCol = tableInfo.find(c => c.name === 'id');
            if (idCol && idCol.type === 'INTEGER') {
                console.log('[LocalDb] Old sale_items schema detected. Dropping table for migration...');
                await db.execAsync("DROP TABLE IF EXISTS sale_items");
            }

            // 🚀 GENERIC SCHEMA MIGRATION: Ensure all columns in TABLE_COLUMNS exist in local tables
            for (const [tableName, columns] of Object.entries(TABLE_COLUMNS)) {
                const tableExists = await db.getFirstAsync(
                    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
                    [tableName]
                );
                if (tableExists) {
                    const currentTableInfo = await db.getAllAsync(`PRAGMA table_info(${tableName})`);
                    const existingCols = new Set(currentTableInfo.map(c => c.name));
                    for (const col of columns) {
                        if (!existingCols.has(col)) {
                            console.log(`[LocalDb] Migrating ${tableName}: adding ${col} column...`);
                            let colType = 'TEXT';
                            if (col === 'total_amount' || col === 'profit_generated' || col === 'commission_amount' || col === 'sale_price' || col === 'cost_price' || col === 'amount' || col === 'total_cost' || col === 'subtotal' || col === 'unit_price_at_sale' || col === 'manual_discount_amount' || col === 'cost_per_unit' || col === 'internet_cost' || col === 'electricity_cost' || col === 'packaging_cost' || col === 'packaging_sticker_cost') {
                                colType = 'REAL';
                            } else if (col === 'current_stock' || col === 'stock_local' || col === 'stock_cordoba' || col === 'active' || col === 'is_individual' || col === 'is_leader_sale' || col === 'installments_total' || col === 'installments_paid' || col === 'completed' || col === 'quantity' || col === 'is_packaging') {
                                colType = 'INTEGER';
                            }
                            try {
                                await db.execAsync(`ALTER TABLE ${tableName} ADD COLUMN ${col} ${colType};`);
                            } catch (altErr) {
                                console.warn(`[LocalDb] Failed to alter table ${tableName} adding ${col}:`, altErr.message);
                            }
                        }
                    }
                }
            }

            await db.execAsync(`
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, description TEXT, sale_price REAL, cost_price REAL, current_stock INTEGER, stock_local INTEGER, stock_cordoba INTEGER, category TEXT, barcode TEXT, image_url TEXT, active INTEGER DEFAULT 1, provider TEXT, is_individual INTEGER DEFAULT 0, sale_price_cordoba REAL, variants_json TEXT, internet_cost REAL, electricity_cost REAL, is_packaging INTEGER DEFAULT 0, packaging_type TEXT DEFAULT 'general', packaging_cost REAL DEFAULT 65, packaging_sticker_cost REAL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, total_amount REAL, profit_generated REAL, commission_amount REAL, client_id TEXT, seller_id TEXT, payment_method TEXT, status TEXT, created_at TEXT, device_sig TEXT, sale_location TEXT, is_leader_sale INTEGER DEFAULT 0, notes TEXT, manual_discount_amount REAL DEFAULT 0, paid_at TEXT);
                CREATE TABLE IF NOT EXISTS sale_items (id TEXT PRIMARY KEY, sale_id TEXT, product_id TEXT, quantity INTEGER, unit_price_at_sale REAL, subtotal REAL, color TEXT);
                CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, amount REAL, description TEXT, category TEXT, created_at TEXT, details TEXT);
                CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, notes TEXT, address TEXT, status TEXT DEFAULT 'active', gender TEXT, created_at TEXT);
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
                CREATE TABLE IF NOT EXISTS authorized_devices (id TEXT PRIMARY KEY, device_signature TEXT UNIQUE, role TEXT, is_active INTEGER DEFAULT 1);
                CREATE TABLE IF NOT EXISTS supplier_orders (id TEXT PRIMARY KEY, provider_name TEXT, total_amount REAL, total_cost REAL, status TEXT, created_at TEXT, notes TEXT, installments_total INTEGER DEFAULT 1, installments_paid INTEGER DEFAULT 0, discount REAL DEFAULT 0, received_at TEXT);
                CREATE TABLE IF NOT EXISTS supplier_order_items (id TEXT PRIMARY KEY, supplier_order_id TEXT, product_id TEXT, quantity INTEGER, cost_per_unit REAL, color TEXT, temp_product_name TEXT);
                CREATE TABLE IF NOT EXISTS pending_sync (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT, action TEXT, payload TEXT, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
                CREATE INDEX IF NOT EXISTS idx_pending_sync_table ON pending_sync(table_name);
                CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, notes TEXT, active INTEGER DEFAULT 1, created_at TEXT);
                CREATE TABLE IF NOT EXISTS reminders (id TEXT PRIMARY KEY, title TEXT, notes TEXT, due_date TEXT, completed INTEGER DEFAULT 0, notification_id TEXT);
                CREATE TABLE IF NOT EXISTS promotions (id TEXT PRIMARY KEY, title TEXT, description TEXT, type TEXT, value REAL, min_qty INTEGER DEFAULT 1, active INTEGER DEFAULT 1, created_at TEXT);
                CREATE TABLE IF NOT EXISTS incidents (id TEXT PRIMARY KEY, type TEXT, description TEXT, amount REAL, created_at TEXT, details TEXT);
                CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id);
                CREATE INDEX IF NOT EXISTS idx_sales_status ON sales(status);
                CREATE INDEX IF NOT EXISTS idx_sales_created ON sales(created_at);
                CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
                CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
                CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
                CREATE INDEX IF NOT EXISTS idx_supplier_order_items_order ON supplier_order_items(supplier_order_id);
            `);
            _db = db;
            await runSeeding(db);
            return db;
        } catch (err) {
            _initPromise = null;
            throw err;
        }
    })();
    return _initPromise;
}

async function runSeeding(db) {
    try {
        const seed = require('../../assets/seed_data.json');
        if (!seed) return;
        
        const storedVersion = await db.getFirstAsync(`SELECT value FROM settings WHERE key = '__seed_version'`);
        const currentVersion = String(seed.__version || '1');
        
        if (storedVersion?.value === currentVersion) {
            console.log('[LocalDb] Seed version matches, skipping.');
            return;
        }

        console.log('[LocalDb] NEW SEED DETECTED! Processing complete clean re-seed...');
        
        const tablesToClean = ['products', 'clients', 'sales', 'expenses', 'authorized_devices', 'supplier_orders', 'supplier_order_items', 'sale_items', 'suppliers'];
        for (const tbl of tablesToClean) {
            try {
                await db.runAsync(`DELETE FROM ${tbl}`);
            } catch (_) {}
        }
        
        await rawSaveItems(db, 'products', seed.products, true);
        await rawSaveItems(db, 'clients', seed.clients, true);
        await rawSaveItems(db, 'sales', seed.sales, true);
        await rawSaveItems(db, 'expenses', seed.expenses, true);
        await rawSaveItems(db, 'authorized_devices', seed.authorized_devices, true);
        await rawSaveItems(db, 'settings', seed.settings, false);
        await rawSaveItems(db, 'supplier_orders', seed.supplier_orders, true);
        await rawSaveItems(db, 'supplier_order_items', seed.supplier_order_items, true);
        await rawSaveItems(db, 'sale_items', seed.sale_items, true);
        if (seed.suppliers) await rawSaveItems(db, 'suppliers', seed.suppliers, true);

        await db.runAsync(`INSERT OR REPLACE INTO settings (key, value) VALUES ('__seed_version', ?)`, [currentVersion]);
        console.log('[LocalDb] Seeding complete.');
    } catch (err) {
        console.warn('[LocalDb] Seed error:', err.message);
    }
}

export const LocalDbService = {
    init,
    saveItem: async (tableName, item) => {
        const db = await init();
        await rawSaveItems(db, tableName, [item]);
    },
    saveItems: async (tableName, items) => {
        const db = await init();
        await rawSaveItems(db, tableName, items);
    },
    replaceFullTable: async (tableName, items) => {
        const db = await init();
        if (!items) return;
        await rawSaveItems(db, tableName, items, true);
    },
    getAll: async (tableName) => {
        const db = await init();
        return await db.getAllAsync(`SELECT * FROM ${tableName}`);
    },
    getById: async (tableName, id) => {
        if (!id) return null;
        if (!TABLE_COLUMNS[tableName]) {
            throw new Error(`[LocalDb] Table '${tableName}' is not recognized`);
        }
        const db = await init();
        return await db.getFirstAsync(`SELECT * FROM ${tableName} WHERE id = ?`, [id]);
    },
    getBy: async (tableName, column, value) => {
        if (value === undefined) return [];
        const allowedCols = TABLE_COLUMNS[tableName];
        if (!allowedCols) {
            throw new Error(`[LocalDb] Table '${tableName}' is not recognized`);
        }
        if (!allowedCols.includes(column)) {
            throw new Error(`[LocalDb] Column '${column}' is not allowed for table '${tableName}'`);
        }
        const db = await init();
        return await db.getAllAsync(`SELECT * FROM ${tableName} WHERE ${column} = ?`, [value]);
    },
    deleteItem: async (tableName, id) => {
        const db = await init();
        await withWriteLock(() => db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]));
    },
    queueForSync: async (tableName, action, payload, metadata = {}) => {
        const db = await init();
        await withWriteLock(() => db.runAsync(`INSERT INTO pending_sync (table_name, action, payload, metadata) VALUES (?, ?, ?, ?)`, [tableName, action, JSON.stringify(payload), JSON.stringify(metadata)]));
    },
    getPendingSyncs: async () => {
        const db = await init();
        return await db.getAllAsync(`SELECT * FROM pending_sync ORDER BY created_at ASC`);
    },
    removeSyncItem: async (id) => {
        const db = await init();
        await withWriteLock(() => db.runAsync(`DELETE FROM pending_sync WHERE id = ?`, [id]));
    },
    getStats: async () => {
        const db = await init();
        const p = await db.getFirstAsync('SELECT COUNT(*) as count FROM products');
        const s = await db.getFirstAsync('SELECT COUNT(*) as count FROM sales');
        const d = await db.getFirstAsync('SELECT COUNT(*) as count FROM supplier_orders');
        return { products: p?.count || 0, sales: s?.count || 0, debts: d?.count || 0 };
    },
    createOrderAtomic: async ({ sale, saleItems = [], updatedProducts = [], metadata = {} }) => {
        const db = await init();
        await withWriteLock(() => db.withTransactionAsync(async () => {
            // 1. Insert/Replace sale
            const cleanSale = sanitizeRow('sales', sale);
            const saleKeys = Object.keys(cleanSale);
            if (saleKeys.length > 0) {
                const saleCols = saleKeys.join(',');
                const salePlaceholders = saleKeys.map(() => '?').join(',');
                await db.runAsync(`INSERT OR REPLACE INTO sales (${saleCols}) VALUES (${salePlaceholders})`, Object.values(cleanSale));
            }

            // 2. Insert/Replace sale_items
            for (const item of saleItems) {
                const cleanItem = sanitizeRow('sale_items', item);
                const itemKeys = Object.keys(cleanItem);
                if (itemKeys.length > 0) {
                    const itemCols = itemKeys.join(',');
                    const itemPlaceholders = itemKeys.map(() => '?').join(',');
                    await db.runAsync(`INSERT OR REPLACE INTO sale_items (${itemCols}) VALUES (${itemPlaceholders})`, Object.values(cleanItem));
                }
            }

            // 3. Update products with deducted stock
            for (const prod of updatedProducts) {
                const cleanProd = sanitizeRow('products', prod);
                const prodKeys = Object.keys(cleanProd);
                if (prodKeys.length > 0) {
                    const prodCols = prodKeys.join(',');
                    const prodPlaceholders = prodKeys.map(() => '?').join(',');
                    await db.runAsync(`INSERT OR REPLACE INTO products (${prodCols}) VALUES (${prodPlaceholders})`, Object.values(cleanProd));
                }
            }

            // 4. Queue for sync
            await db.runAsync(
                `INSERT INTO pending_sync (table_name, action, payload, metadata) VALUES (?, ?, ?, ?)`,
                ['sales', 'INSERT', JSON.stringify(sale), JSON.stringify(metadata)]
            );
        }));
    },
    payDebtAtomic: async ({ saleId, status = 'completed', paidAt, notes }) => {
        const db = await init();
        await withWriteLock(() => db.withTransactionAsync(async () => {
            const existing = await db.getFirstAsync('SELECT * FROM sales WHERE id = ?', [saleId]);
            const updated = existing ? { ...existing } : { id: saleId };
            updated.status = status;
            if (paidAt) updated.paid_at = paidAt;
            if (notes !== undefined) updated.notes = notes;

            const cleanSale = sanitizeRow('sales', updated);
            const keys = Object.keys(cleanSale);
            if (keys.length > 0) {
                const cols = keys.join(',');
                const placeholders = keys.map(() => '?').join(',');
                await db.runAsync(`INSERT OR REPLACE INTO sales (${cols}) VALUES (${placeholders})`, Object.values(cleanSale));
            }

            // Queue for sync atomically within the same SQLite transaction
            await db.runAsync(
                `INSERT INTO pending_sync (table_name, action, payload, metadata) VALUES (?, ?, ?, ?)`,
                ['sales', 'UPDATE', JSON.stringify(cleanSale), JSON.stringify({})]
            );
        }));
    }
};
