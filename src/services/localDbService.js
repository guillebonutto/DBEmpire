import * as SQLite from 'expo-sqlite';
import { Alert } from 'react-native';

const DATABASE_NAME = 'empire_local.db';

const TABLE_COLUMNS = {
    products: ['id', 'name', 'sale_price', 'cost_price', 'current_stock', 'stock_local',
               'category', 'barcode', 'image_url', 'active', 'description',
               'stock_cordoba', 'provider', 'is_individual', 'sale_price_cordoba', 'variants_json'],
    sales: ['id', 'total_amount', 'profit_generated', 'commission_amount', 'client_id',
            'payment_method', 'status', 'created_at', 'seller_id', 'device_sig',
            'sale_location', 'is_leader_sale', 'notes', 'manual_discount_amount'],
    expenses: ['id', 'amount', 'description', 'category', 'created_at', 'details'],
    clients: ['id', 'name', 'phone', 'email', 'created_at', 'notes', 'status', 'address', 'gender'],
    authorized_devices: ['id', 'device_signature', 'role', 'is_active'],
    settings: ['key', 'value'],
    sale_items: ['id', 'sale_id', 'product_id', 'quantity', 'unit_price_at_sale', 'subtotal', 'color'],
    supplier_orders: ['id', 'provider_name', 'total_amount', 'total_cost', 'status', 'created_at', 'notes', 'installments_total', 'installments_paid', 'discount'],
    supplier_order_items: ['id', 'supplier_order_id', 'product_id', 'quantity', 'cost_per_unit', 'color', 'temp_product_name'],
    pending_sync: ['id', 'table_name', 'action', 'payload', 'metadata', 'created_at'],
    suppliers: ['id', 'name', 'phone', 'email', 'notes', 'active', 'created_at'],
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

async function processQueue() {
    if (_processing || _queue.length === 0) return;
    _processing = true;
    while (_queue.length > 0) {
        const { tableName, items, resolve, reject } = _queue.shift();
        try {
            if (!_db) throw new Error("Database not initialized");
            await _db.withTransactionAsync(async () => {
                for (const item of items) {
                    const clean = sanitizeRow(tableName, item);
                    const keys = Object.keys(clean);
                    if (keys.length === 0) continue;
                    const placeholders = keys.map(() => '?').join(',');
                    const columns = keys.join(',');
                    const sql = `INSERT OR REPLACE INTO ${tableName} (${columns}) VALUES (${placeholders})`;
                    await _db.runAsync(sql, Object.values(clean));
                }
            });
            console.log(`[LocalDb] Saved ${items.length} items to ${tableName}`);
            resolve();
        } catch (e) {
            console.error(`[LocalDb] Error saving to ${tableName}:`, e.message);
            reject(e);
        }
    }
    _processing = false;
}

async function rawSaveItems(db, tableName, items) {
    if (!items || items.length === 0) return;
    return new Promise((resolve, reject) => {
        _queue.push({ tableName, items, resolve, reject });
        processQueue();
    });
}

async function init() {
    if (_db) return _db;
    if (_initPromise) return _initPromise;

    _initPromise = (async () => {
        try {
            const db = await SQLite.openDatabaseAsync(DATABASE_NAME);
            
            // 🚀 SCHEMA MIGRATION: Fix sale_items id from INTEGER to TEXT
            const tableInfo = await db.getAllAsync("PRAGMA table_info(sale_items)");
            const idCol = tableInfo.find(c => c.name === 'id');
            if (idCol && idCol.type === 'INTEGER') {
                console.log('[LocalDb] Old sale_items schema detected. Dropping table for migration...');
                await db.execAsync("DROP TABLE IF EXISTS sale_items");
            }

            await db.execAsync(`
                PRAGMA journal_mode = WAL;
                CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT, description TEXT, sale_price REAL, cost_price REAL, current_stock INTEGER, stock_local INTEGER, stock_cordoba INTEGER, category TEXT, barcode TEXT, image_url TEXT, active INTEGER DEFAULT 1, provider TEXT, is_individual INTEGER DEFAULT 0, sale_price_cordoba REAL, variants_json TEXT);
                CREATE TABLE IF NOT EXISTS sales (id TEXT PRIMARY KEY, total_amount REAL, profit_generated REAL, commission_amount REAL, client_id TEXT, seller_id TEXT, payment_method TEXT, status TEXT, created_at TEXT, device_sig TEXT, sale_location TEXT, is_leader_sale INTEGER DEFAULT 0, notes TEXT, manual_discount_amount REAL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS sale_items (id TEXT PRIMARY KEY, sale_id TEXT, product_id TEXT, quantity INTEGER, unit_price_at_sale REAL, subtotal REAL, color TEXT);
                CREATE TABLE IF NOT EXISTS expenses (id TEXT PRIMARY KEY, amount REAL, description TEXT, category TEXT, created_at TEXT, details TEXT);
                CREATE TABLE IF NOT EXISTS clients (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, notes TEXT, address TEXT, status TEXT DEFAULT 'active', gender TEXT, created_at TEXT);
                CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
                CREATE TABLE IF NOT EXISTS authorized_devices (id TEXT PRIMARY KEY, device_signature TEXT UNIQUE, role TEXT, is_active INTEGER DEFAULT 1);
                CREATE TABLE IF NOT EXISTS supplier_orders (id TEXT PRIMARY KEY, provider_name TEXT, total_amount REAL, total_cost REAL, status TEXT, created_at TEXT, notes TEXT, installments_total INTEGER DEFAULT 1, installments_paid INTEGER DEFAULT 0, discount REAL DEFAULT 0);
                CREATE TABLE IF NOT EXISTS supplier_order_items (id TEXT PRIMARY KEY, supplier_order_id TEXT, product_id TEXT, quantity INTEGER, cost_per_unit REAL, color TEXT, temp_product_name TEXT);
                CREATE TABLE IF NOT EXISTS pending_sync (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT, action TEXT, payload TEXT, metadata TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
                CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, notes TEXT, active INTEGER DEFAULT 1, created_at TEXT);
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

        console.log('[LocalDb] NEW SEED DETECTED! Processing...');
        
        await rawSaveItems(db, 'products', seed.products);
        await rawSaveItems(db, 'clients', seed.clients);
        await rawSaveItems(db, 'sales', seed.sales);
        await rawSaveItems(db, 'expenses', seed.expenses);
        await rawSaveItems(db, 'authorized_devices', seed.authorized_devices);
        await rawSaveItems(db, 'settings', seed.settings);
        await rawSaveItems(db, 'supplier_orders', seed.supplier_orders);
        await rawSaveItems(db, 'supplier_order_items', seed.supplier_order_items);
        await rawSaveItems(db, 'sale_items', seed.sale_items);
        if (seed.suppliers) await rawSaveItems(db, 'suppliers', seed.suppliers);

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
    getAll: async (tableName) => {
        const db = await init();
        return await db.getAllAsync(`SELECT * FROM ${tableName}`);
    },
    deleteItem: async (tableName, id) => {
        const db = await init();
        await db.runAsync(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
    },
    queueForSync: async (tableName, action, payload, metadata = {}) => {
        const db = await init();
        await db.runAsync(`INSERT INTO pending_sync (table_name, action, payload, metadata) VALUES (?, ?, ?, ?)`, [tableName, action, JSON.stringify(payload), JSON.stringify(metadata)]);
    },
    getPendingSyncs: async () => {
        const db = await init();
        return await db.getAllAsync(`SELECT * FROM pending_sync ORDER BY created_at ASC`);
    },
    removeSyncItem: async (id) => {
        const db = await init();
        await db.runAsync(`DELETE FROM pending_sync WHERE id = ?`, [id]);
    },
    getStats: async () => {
        const db = await init();
        const p = await db.getFirstAsync('SELECT COUNT(*) as count FROM products');
        const s = await db.getFirstAsync('SELECT COUNT(*) as count FROM sales');
        const d = await db.getFirstAsync('SELECT COUNT(*) as count FROM supplier_orders');
        return { products: p?.count || 0, sales: s?.count || 0, debts: d?.count || 0 };
    }
};
