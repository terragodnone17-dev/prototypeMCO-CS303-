/**
 * Aqua Nhoy - Water Refilling Station Management System (WRSMS)
 * ISO/IEC/IEEE 29148 Compliant Relational SQLite Database Layer
 * 
 * Powered by genuine SQLite 3 engine (via WebAssembly sql.js)
 * Enforces PRAGMA foreign_keys = ON, parameterized statements, and transactions.
 * All monetary calculations use integer centavos (NFR-QUAL-02).
 */

const Currency = {
  toCentavos: (pesos) => {
    if (pesos === null || pesos === undefined || isNaN(pesos)) return 0;
    return Math.round(Number(pesos) * 100);
  },
  toPesos: (centavos) => {
    if (!centavos) return 0;
    return Number(centavos) / 100;
  },
  formatPHP: (centavos) => {
    const p = Currency.toPesos(centavos);
    return '₱' + p.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

const DateTimeUtil = {
  nowISO: () => new Date().toISOString(),
  todayDateStr: () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },
  formatDateTime: (isoStr) => {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    } catch {
      return isoStr;
    }
  },
  formatDate: (isoOrDateStr) => {
    if (!isoOrDateStr) return '-';
    try {
      const d = new Date(isoOrDateStr);
      return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: '2-digit' });
    } catch {
      return isoOrDateStr;
    }
  },
  toDateOnlyStr: (isoOrDateStr) => {
    if (!isoOrDateStr) return '';
    if (typeof isoOrDateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(isoOrDateStr)) {
      return isoOrDateStr;
    }
    try {
      const d = new Date(isoOrDateStr);
      if (isNaN(d.getTime())) return String(isoOrDateStr).split('T')[0];
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } catch {
      return String(isoOrDateStr).split('T')[0];
    }
  }
};

if (typeof window !== 'undefined') {
  window.Currency = Currency;
  window.DateTimeUtil = DateTimeUtil;
}

const WRSMSStorage = {
  openIDB: function() {
    return new Promise((resolve) => {
      if (typeof indexedDB === 'undefined') {
        return resolve(null);
      }
      try {
        const req = indexedDB.open('WRSMS_SQLite_Storage', 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains('sqlite_binary')) {
            db.createObjectStore('sqlite_binary');
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },

  loadBinary: async function() {
    try {
      const idb = await this.openIDB();
      if (idb) {
        const data = await new Promise((resolve) => {
          try {
            const tx = idb.transaction('sqlite_binary', 'readonly');
            const store = tx.objectStore('sqlite_binary');
            const req = store.get('current_db');
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        });
        if (data && data instanceof Uint8Array && data.byteLength > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn('IndexedDB read failed, falling back to localStorage:', err);
    }

    // Fallback: localStorage
    try {
      if (typeof localStorage !== 'undefined') {
        const savedData = localStorage.getItem('wrsms_sqlite_binary_store');
        if (savedData) {
          const binaryStr = atob(savedData);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          return bytes;
        }
      }
    } catch (err) {
      console.warn('localStorage read failed:', err);
    }
    return null;
  },

  saveBinary: async function(uint8Arr) {
    if (!uint8Arr) return;

    // 1. IndexedDB primary storage (unlimited quota, fast binary)
    try {
      const idb = await this.openIDB();
      if (idb) {
        await new Promise((resolve, reject) => {
          try {
            const tx = idb.transaction('sqlite_binary', 'readwrite');
            const store = tx.objectStore('sqlite_binary');
            const req = store.put(uint8Arr, 'current_db');
            if (req) {
              req.onsuccess = () => resolve();
              req.onerror = (e) => reject(e);
            } else {
              resolve();
            }
          } catch (e) {
            reject(e);
          }
        });
      }
    } catch (err) {
      console.warn('IndexedDB write error:', err);
    }

    // 2. LocalStorage fast chunked base64 fallback
    try {
      if (typeof localStorage !== 'undefined') {
        const CHUNK_SIZE = 0x8000;
        let binaryStr = '';
        for (let i = 0; i < uint8Arr.length; i += CHUNK_SIZE) {
          binaryStr += String.fromCharCode.apply(null, uint8Arr.subarray(i, i + CHUNK_SIZE));
        }
        localStorage.setItem('wrsms_sqlite_binary_store', btoa(binaryStr));
      }
    } catch {
      // Ignored if localStorage quota exceeded; IndexedDB already holds the authoritative copy
    }
  }
};

class WRSMSDatabase {
  constructor() {
    this.sqliteDB = null;
    this.isReady = false;
    this.primaryKeys = {
      Admin_Account: 'admin_id',
      Customers: 'customer_id',
      Products: 'product_id',
      Orders: 'order_id',
      Order_Items: 'order_item_id',
      Payments: 'payment_id',
      Customer_Account_Ledger: 'entry_id',
      Container_Ledger: 'container_entry_id',
      Inventory_Movements: 'movement_id',
      Delivery_Riders: 'rider_id',
      Delivery_Trips: 'trip_id',
      Delivery_Trip_Orders: 'trip_order_id',
      Expenses: 'expense_id',
      Cash_Closings: 'closing_id',
      Audit_Logs: 'log_id',
      Backup_History: 'backup_id'
    };
    this.tables = Object.keys(this.primaryKeys);
  }

  async init() {
    if (typeof initSqlJs === 'undefined') {
      console.warn('SQLite WebAssembly module not found in global scope. Ensure js/sql-wasm.js is loaded.');
    }

    let SQL = null;
    let wasmBinary = null;

    // Check if wasm binary was loaded via inline script (bypasses browser file:/// CORS blocks completely)
    if (typeof window !== 'undefined' && window.SQL_WASM_BASE64) {
      try {
        const binStr = atob(window.SQL_WASM_BASE64);
        const len = binStr.length;
        wasmBinary = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          wasmBinary[i] = binStr.charCodeAt(i);
        }
      } catch (err) {
        console.warn('Failed decoding inline SQLite WebAssembly binary:', err);
      }
    }

    if (wasmBinary) {
      // In-memory binary instantiation: no fetch() call made by browser, 100% offline & file:// CORS safe
      SQL = await initSqlJs({ wasmBinary });
    } else {
      try {
        SQL = await initSqlJs({
          locateFile: file => {
            if (typeof window !== 'undefined' && window.__SQL_WASM_PATH__) {
              return window.__SQL_WASM_PATH__;
            }
            if (typeof process !== 'undefined' && process.versions && process.versions.node) {
              try {
                const path = require('path');
                const fs = require('fs');
                const candidates = [
                  path.join(__dirname || '', file),
                  path.join(__dirname || '', 'js', file),
                  path.join(process.cwd(), 'js', file),
                  path.join('C:/Users/User/Downloads/downloaded from edge/lab2act/mco prototype/wrsms fix user login original - Copy/js', file)
                ];
                for (const c of candidates) {
                  if (fs.existsSync(c)) return c;
                }
              } catch {}
            }
            return `js/${file}`;
          }
        });
      } catch (localErr) {
        console.warn('Failed loading local WebAssembly module js/sql-wasm.wasm, falling back to CDN:', localErr);
        SQL = await initSqlJs({
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
        });
      }
    }

    // Load persisted binary database image
    const savedBytes = await WRSMSStorage.loadBinary();
    if (savedBytes && savedBytes.length > 0) {
      try {
        this.sqliteDB = new SQL.Database(savedBytes);
      } catch (corruptErr) {
        console.warn('Persisted database image corrupted or invalid. Re-initializing schema:', corruptErr);
        this.sqliteDB = new SQL.Database();
        this.executeDDL();
        await this.seedInitialData();
      }
    } else {
      this.sqliteDB = new SQL.Database();
      this.executeDDL();
      await this.seedInitialData();
    }

    // Enforce SQLite Foreign Key constraints
    this.sqliteDB.run('PRAGMA foreign_keys = ON;');
    this.isReady = true;
    this.persist();
    return this;
  }

  persist() {
    if (!this.sqliteDB) return;
    try {
      const binary = this.sqliteDB.export();
      WRSMSStorage.saveBinary(binary);
    } catch (e) {
      console.warn('Storage persistence warning when saving SQLite binary image:', e);
    }
  }

  executeDDL() {
    this.sqliteDB.run(`
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS Admin_Account (
        admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        full_name TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );

      CREATE TABLE IF NOT EXISTS Customers (
        customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT,
        customer_type TEXT NOT NULL,
        address TEXT NOT NULL,
        landmark TEXT,
        credit_limit INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Products (
        product_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        unit TEXT NOT NULL,
        unit_price INTEGER NOT NULL,
        tracks_stock INTEGER NOT NULL DEFAULT 1,
        minimum_stock INTEGER NOT NULL DEFAULT 10,
        is_active INTEGER NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS Orders (
        order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_number TEXT NOT NULL UNIQUE,
        customer_id INTEGER REFERENCES Customers(customer_id),
        order_type TEXT NOT NULL,
        order_status TEXT NOT NULL,
        payment_status TEXT NOT NULL,
        subtotal INTEGER NOT NULL,
        discount INTEGER NOT NULL DEFAULT 0,
        discount_reason TEXT,
        total_amount INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS Order_Items (
        order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES Orders(order_id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES Products(product_id),
        quantity INTEGER NOT NULL,
        unit_price_at_sale INTEGER NOT NULL,
        line_total INTEGER NOT NULL,
        swap_type TEXT NOT NULL,
        deposit_amount INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS Payments (
        payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER REFERENCES Orders(order_id) ON DELETE SET NULL,
        customer_id INTEGER REFERENCES Customers(customer_id) ON DELETE SET NULL,
        transaction_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        cash_tendered INTEGER NOT NULL,
        change_due INTEGER NOT NULL DEFAULT 0,
        received_at TEXT NOT NULL,
        reference_note TEXT
      );

      CREATE TABLE IF NOT EXISTS Customer_Account_Ledger (
        entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES Customers(customer_id) ON DELETE CASCADE,
        order_id INTEGER REFERENCES Orders(order_id) ON DELETE SET NULL,
        entry_type TEXT NOT NULL,
        debit_amount INTEGER NOT NULL DEFAULT 0,
        credit_amount INTEGER NOT NULL DEFAULT 0,
        entry_date TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS Container_Ledger (
        container_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER REFERENCES Customers(customer_id) ON DELETE SET NULL,
        order_id INTEGER REFERENCES Orders(order_id) ON DELETE SET NULL,
        movement_type TEXT NOT NULL,
        qty_issued INTEGER NOT NULL DEFAULT 0,
        qty_returned INTEGER NOT NULL DEFAULT 0,
        deposit_amount INTEGER NOT NULL DEFAULT 0,
        entry_date TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS Inventory_Movements (
        movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL REFERENCES Products(product_id),
        movement_type TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        related_order_id INTEGER REFERENCES Orders(order_id) ON DELETE SET NULL,
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL,
        admin_id INTEGER NOT NULL REFERENCES Admin_Account(admin_id)
      );

      CREATE TABLE IF NOT EXISTS Delivery_Riders (
        rider_id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS Delivery_Trips (
        trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
        rider_id INTEGER NOT NULL REFERENCES Delivery_Riders(rider_id),
        dispatch_time TEXT NOT NULL,
        return_time TEXT,
        expected_cod INTEGER NOT NULL DEFAULT 0,
        actual_remittance INTEGER NOT NULL DEFAULT 0,
        variance INTEGER NOT NULL DEFAULT 0,
        trip_status TEXT NOT NULL,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS Delivery_Trip_Orders (
        trip_order_id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL REFERENCES Delivery_Trips(trip_id) ON DELETE CASCADE,
        order_id INTEGER NOT NULL REFERENCES Orders(order_id) ON DELETE CASCADE,
        delivery_result TEXT NOT NULL,
        quantities_delivered INTEGER NOT NULL DEFAULT 0,
        empties_returned INTEGER NOT NULL DEFAULT 0,
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS Expenses (
        expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount INTEGER NOT NULL,
        description TEXT NOT NULL,
        expense_date TEXT NOT NULL,
        paid_from_drawer INTEGER NOT NULL DEFAULT 1,
        admin_id INTEGER NOT NULL REFERENCES Admin_Account(admin_id)
      );

      CREATE TABLE IF NOT EXISTS Cash_Closings (
        closing_id INTEGER PRIMARY KEY AUTOINCREMENT,
        business_date TEXT NOT NULL UNIQUE,
        opening_float INTEGER NOT NULL,
        cash_receipts INTEGER NOT NULL,
        accepted_rider_remittance INTEGER NOT NULL,
        account_collections INTEGER NOT NULL,
        deposits INTEGER NOT NULL,
        cash_refunds INTEGER NOT NULL DEFAULT 0,
        drawer_expenses INTEGER NOT NULL,
        expected_cash INTEGER NOT NULL,
        actual_cash INTEGER NOT NULL,
        variance INTEGER NOT NULL,
        closed_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Audit_Logs (
        log_id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        entity_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        reason TEXT NOT NULL,
        before_summary TEXT,
        after_summary TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS Backup_History (
        backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        created_at TEXT NOT NULL,
        result TEXT NOT NULL,
        notes TEXT
      );
    `);
  }

  // Parameterized Query Helpers
  async getAll(tableName) {
    if (!this.tables.includes(tableName)) throw new Error(`Invalid table: ${tableName}`);
    const stmt = this.sqliteDB.prepare(`SELECT * FROM ${tableName}`);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  async getById(tableName, id) {
    if (!this.tables.includes(tableName)) throw new Error(`Invalid table: ${tableName}`);
    const pk = this.primaryKeys[tableName];
    const stmt = this.sqliteDB.prepare(`SELECT * FROM ${tableName} WHERE ${pk} = ? LIMIT 1`);
    stmt.bind([Number(id)]);
    let record = null;
    if (stmt.step()) {
      record = stmt.getAsObject();
    }
    stmt.free();
    return record;
  }

  async insert(tableName, record) {
    if (!this.tables.includes(tableName)) throw new Error(`Invalid table: ${tableName}`);
    const pk = this.primaryKeys[tableName];
    const keys = Object.keys(record).filter(k => k !== pk);
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => record[k] !== undefined ? record[k] : null);

    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    this.sqliteDB.run(sql, values);

    // Retrieve last inserted ID
    const res = this.sqliteDB.exec('SELECT last_insert_rowid() AS id');
    const newId = res[0].values[0][0];

    const inserted = { ...record, [pk]: newId };
    this.persist();
    return inserted;
  }

  async update(tableName, id, updates) {
    if (!this.tables.includes(tableName)) throw new Error(`Invalid table: ${tableName}`);
    const pk = this.primaryKeys[tableName];
    const keys = Object.keys(updates).filter(k => k !== pk);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k] !== undefined ? updates[k] : null);
    values.push(Number(id));

    const sql = `UPDATE ${tableName} SET ${setClause} WHERE ${pk} = ?`;
    this.sqliteDB.run(sql, values);

    this.persist();
    return await this.getById(tableName, id);
  }

  async delete(tableName, id) {
    if (!this.tables.includes(tableName)) throw new Error(`Invalid table: ${tableName}`);
    const pk = this.primaryKeys[tableName];
    this.sqliteDB.run(`DELETE FROM ${tableName} WHERE ${pk} = ?`, [Number(id)]);
    this.persist();
    return true;
  }

  async clearTable(tableName) {
    if (!this.tables.includes(tableName)) throw new Error(`Invalid table: ${tableName}`);
    this.sqliteDB.run(`DELETE FROM ${tableName}`);
    this.persist();
    return true;
  }

  // Audit Logging
  async logAudit(actionType, entityName, recordId, reason, beforeSummary = '', afterSummary = '', adminId = 1) {
    return await this.insert('Audit_Logs', {
      admin_id: adminId,
      action_type: actionType,
      entity_name: entityName,
      record_id: recordId ? String(recordId) : 'N/A',
      reason: reason || 'Routine system operation',
      before_summary: typeof beforeSummary === 'object' ? JSON.stringify(beforeSummary) : String(beforeSummary),
      after_summary: typeof afterSummary === 'object' ? JSON.stringify(afterSummary) : String(afterSummary),
      created_at: DateTimeUtil.nowISO()
    });
  }

  // Stock & Inventory Calculations
  async getProductStock(productId) {
    const movements = await this.getAll('Inventory_Movements');
    const pMovements = movements.filter(m => Number(m.product_id) === Number(productId));
    let stock = 0;
    for (const m of pMovements) {
      if (['production_refill', 'initial_stock', 'manual_add', 'customer_return'].includes(m.movement_type)) {
        stock += Number(m.quantity);
      } else if (['sale_deduction', 'damage', 'loss', 'manual_subtract'].includes(m.movement_type)) {
        stock -= Number(m.quantity);
      }
    }
    return Math.max(0, stock);
  }

  async getContainerStats() {
    const cLedger = await this.getAll('Container_Ledger');
    const pList = await this.getAll('Products');
    const movements = await this.getAll('Inventory_Movements');

    let customerHeld = 0;
    for (const row of cLedger) {
      customerHeld += (Number(row.qty_issued) || 0) - (Number(row.qty_returned) || 0);
    }

    let emptyAtStation = 45;
    let damagedLost = 6;
    for (const row of cLedger) {
      if (row.movement_type === 'swap_1to1' || row.movement_type === 'return_received') {
        emptyAtStation += Number(row.qty_returned || 0);
      }
      if (row.movement_type === 'damaged') {
        damagedLost += Number(row.qty_returned || 1);
        emptyAtStation = Math.max(0, emptyAtStation - 1);
      }
    }

    for (const m of movements) {
      if (m.movement_type === 'production_refill') {
        emptyAtStation = Math.max(0, emptyAtStation - Number(m.quantity));
      } else if (m.movement_type === 'empty_return') {
        emptyAtStation += Number(m.quantity);
      } else if (m.movement_type === 'container_damage') {
        damagedLost += Number(m.quantity);
        emptyAtStation = Math.max(0, emptyAtStation - Number(m.quantity));
      }
    }

    let filledAvailable = 0;
    for (const p of pList) {
      if (p.category === 'Refill' && p.tracks_stock) {
        filledAvailable += await this.getProductStock(p.product_id);
      }
    }

    return {
      filledAvailable,
      emptyAtStation: Math.max(0, emptyAtStation),
      customerHeld: Math.max(0, customerHeld),
      damagedLost
    };
  }

  async getCustomerBalance(customerId) {
    if (!customerId) return 0;
    const ledger = await this.getAll('Customer_Account_Ledger');
    const rows = ledger.filter(l => Number(l.customer_id) === Number(customerId));
    let balance = 0;
    for (const r of rows) {
      balance += (Number(r.debit_amount) || 0) - (Number(r.credit_amount) || 0);
    }
    return balance;
  }

  async getCustomerContainerBalance(customerId) {
    if (!customerId) return 0;
    const ledger = await this.getAll('Container_Ledger');
    const rows = ledger.filter(l => Number(l.customer_id) === Number(customerId));
    let held = 0;
    for (const r of rows) {
      held += (Number(r.qty_issued) || 0) - (Number(r.qty_returned) || 0);
    }
    return held;
  }

  async generateOrderNumber() {
    const orders = await this.getAll('Orders');
    const today = new Date();
    const ymd = today.getFullYear().toString() +
      String(today.getMonth() + 1).padStart(2, '0') +
      String(today.getDate()).padStart(2, '0');
    const todayOrders = orders.filter(o => o.order_number && o.order_number.startsWith(`ORD-${ymd}`));
    const seq = String(todayOrders.length + 1).padStart(3, '0');
    return `ORD-${ymd}-${seq}`;
  }

  async seedInitialData() {
    const defaultSalt = 'wrsms_salt_2026';
    const validDefaultHash = (typeof window !== 'undefined' && window.CryptoUtil)
      ? window.CryptoUtil.hashPasswordSync('admin123', defaultSalt)
      : '1af2a8647c86f87c7aab992ff2c095f3b7dc686d2e6b9fb2f626ccc6de4fa824';

    await this.insert('Admin_Account', {
      username: 'admin',
      password_hash: validDefaultHash,
      salt: defaultSalt,
      full_name: 'Station Administrator',
      is_active: 1,
      created_at: DateTimeUtil.nowISO(),
      last_login_at: null
    });

    const initialProducts = [
      { name: '5-Gallon Purified Water Refill (Round Container)', category: 'Refill', unit: '5-Gal Round', unit_price: Currency.toCentavos(30.00), tracks_stock: 1, minimum_stock: 20, is_active: 1 },
      { name: '5-Gallon Purified Water Refill (Slim Container)', category: 'Refill', unit: '5-Gal Slim', unit_price: Currency.toCentavos(30.00), tracks_stock: 1, minimum_stock: 20, is_active: 1 },
      { name: '5-Gallon Alkaline Water Refill', category: 'Refill', unit: '5-Gal Jug', unit_price: Currency.toCentavos(45.00), tracks_stock: 1, minimum_stock: 15, is_active: 1 },
      { name: '5-Gallon Mineral Water Refill', category: 'Refill', unit: '5-Gal Jug', unit_price: Currency.toCentavos(35.00), tracks_stock: 1, minimum_stock: 15, is_active: 1 },
      { name: 'Bottled Water 500ml (Pack of 24)', category: 'Bottled Water', unit: 'Case/24', unit_price: Currency.toCentavos(180.00), tracks_stock: 1, minimum_stock: 10, is_active: 1 },
      { name: 'Bottled Water 350ml (Pack of 24)', category: 'Bottled Water', unit: 'Case/24', unit_price: Currency.toCentavos(140.00), tracks_stock: 1, minimum_stock: 10, is_active: 1 },
      { name: '5-Gallon Blue Slim Container with Handle (New)', category: 'Container', unit: 'Piece', unit_price: Currency.toCentavos(220.00), tracks_stock: 1, minimum_stock: 8, is_active: 1 },
      { name: '5-Gallon Blue Round Container (New)', category: 'Container', unit: 'Piece', unit_price: Currency.toCentavos(240.00), tracks_stock: 1, minimum_stock: 8, is_active: 1 },
      { name: 'Manual Hand Water Dispenser Pump', category: 'Accessory', unit: 'Piece', unit_price: Currency.toCentavos(120.00), tracks_stock: 1, minimum_stock: 5, is_active: 1 },
      { name: 'Sanitary Container Caps & Heat-Shrink Seals (Pack of 50)', category: 'Accessory', unit: 'Pack/50', unit_price: Currency.toCentavos(45.00), tracks_stock: 1, minimum_stock: 12, is_active: 1 }
    ];

    for (const p of initialProducts) {
      await this.insert('Products', p);
    }

    const initialStocks = [
      { product_id: 1, qty: 65 }, { product_id: 2, qty: 50 }, { product_id: 3, qty: 25 },
      { product_id: 4, qty: 30 }, { product_id: 5, qty: 18 }, { product_id: 6, qty: 15 },
      { product_id: 7, qty: 12 }, { product_id: 8, qty: 14 }, { product_id: 9, qty: 10 }, { product_id: 10, qty: 25 }
    ];

    for (const s of initialStocks) {
      await this.insert('Inventory_Movements', {
        product_id: s.product_id,
        movement_type: 'initial_stock',
        quantity: s.qty,
        related_order_id: null,
        reason: 'Initial station inventory count setup',
        created_at: DateTimeUtil.nowISO(),
        admin_id: 1
      });
    }

    const cust1 = await this.insert('Customers', {
      full_name: 'Barangay 12 Health Center',
      phone: '0917-111-2233',
      address: 'Poblacion Community Hall, Main Street',
      landmark: 'Opposite Plaza Gazebo',
      customer_type: 'Commercial',
      credit_limit: Currency.toCentavos(3000.00),
      is_active: 1,
      created_at: DateTimeUtil.nowISO()
    });

    await this.insert('Delivery_Riders', {
      full_name: 'Juan Ramos',
      phone: '0918-555-6677',
      is_active: 1,
      notes: 'Assigned to Trike Delivery Unit 1 (North Sector)'
    });

    await this.logAudit(
      'SYSTEM_INIT',
      'Database',
      'WRSMS_SQLite_v1',
      'Baseline SQLite database initialized successfully'
    );
  }

  // Backup Generation: JSON dump + Physical SQLite .sqlite binary dump
  async generateBackup() {
    const backupData = {
      version: '1.2.0',
      system: 'Water Refilling Station Management System (WRSMS SQLite)',
      exported_at: DateTimeUtil.nowISO(),
      tables: {}
    };

    let sqlDump = `-- ==========================================================\n`;
    sqlDump += `-- WRSMS SQLite Relational Database Dump\n`;
    sqlDump += `-- Generated: ${DateTimeUtil.nowISO()}\n`;
    sqlDump += `-- ==========================================================\n\nPRAGMA foreign_keys = ON;\n\n`;

    for (const tableName of this.tables) {
      const records = await this.getAll(tableName);
      backupData.tables[tableName] = records;

      sqlDump += `-- Table: ${tableName} (${records.length} records)\n`;
      for (const rec of records) {
        const keys = Object.keys(rec);
        const vals = keys.map(k => {
          const v = rec[k];
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        sqlDump += `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${vals.join(', ')});\n`;
      }
      sqlDump += `\n`;
    }

    const fileName = `wrsms_sqlite_backup_${DateTimeUtil.todayDateStr()}_${Date.now()}.json`;
    await this.insert('Backup_History', {
      file_path: fileName,
      created_at: DateTimeUtil.nowISO(),
      result: 'success',
      notes: `SQLite database backup of all 16 tables (${Object.keys(backupData.tables).length} stores)`
    });

    await this.logAudit('BACKUP_CREATED', 'Backup_History', fileName, 'Administrator created SQLite backup dump');

    // Also export the genuine binary .sqlite database
    const sqliteBinary = this.sqliteDB.export();

    return {
      jsonData: JSON.stringify(backupData, null, 2),
      sqlData: sqlDump,
      sqliteBinary,
      fileName
    };
  }

  // Transactional Database Restoration (Supports JSON snapshot and genuine .sqlite / .db binary)
  async restoreFromBackup(input) {
    if (input instanceof ArrayBuffer || input instanceof Uint8Array) {
      const u8 = input instanceof Uint8Array ? input : new Uint8Array(input);
      let headerStr = '';
      for (let i = 0; i < 15; i++) {
        headerStr += String.fromCharCode(u8[i]);
      }
      if (!headerStr.startsWith('SQLite format 3')) {
        throw new Error('Selected binary file is not a valid SQLite 3 database.');
      }
      let SQL = null;
      if (typeof window !== 'undefined' && window.SQL_WASM_BASE64) {
        const binStr = atob(window.SQL_WASM_BASE64);
        const len = binStr.length;
        const wasmBinary = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          wasmBinary[i] = binStr.charCodeAt(i);
        }
        SQL = await initSqlJs({ wasmBinary });
      } else {
        try {
          SQL = await initSqlJs({ locateFile: file => `js/${file}` });
        } catch {
          SQL = await initSqlJs({ locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}` });
        }
      }
      const testDb = new SQL.Database(u8);
      const checkTables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table';");
      if (!checkTables || !checkTables.length || !checkTables[0].values.length) {
        throw new Error('Binary SQLite database contains no tables.');
      }
      if (this.sqliteDB) {
        try { this.sqliteDB.close(); } catch {}
      }
      this.sqliteDB = testDb;
      this.sqliteDB.run('PRAGMA foreign_keys = ON;');
      this.persist();
      await this.logAudit('BACKUP_RESTORED', 'Database', 'ALL', 'Successfully restored binary SQLite database snapshot');
      return true;
    }

    let parsed;
    try {
      parsed = typeof input === 'string' ? JSON.parse(input) : input;
    } catch {
      throw new Error('Invalid JSON format in backup file.');
    }

    if (!parsed.tables || typeof parsed.tables !== 'object') {
      throw new Error('Backup file missing tables structure.');
    }

    // Atomic SQLite Transaction
    this.sqliteDB.run('BEGIN TRANSACTION;');
    try {
      this.sqliteDB.run('PRAGMA foreign_keys = OFF;');
      for (const tableName of this.tables) {
        this.sqliteDB.run(`DELETE FROM ${tableName}`);
      }

      for (const tableName of this.tables) {
        if (parsed.tables[tableName] && Array.isArray(parsed.tables[tableName])) {
          for (const rec of parsed.tables[tableName]) {
            const keys = Object.keys(rec);
            const placeholders = keys.map(() => '?').join(', ');
            const values = keys.map(k => rec[k] !== undefined ? rec[k] : null);
            this.sqliteDB.run(`INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`, values);
          }
        }
      }

      this.sqliteDB.run('PRAGMA foreign_keys = ON;');
      this.sqliteDB.run('COMMIT;');
      this.persist();

      await this.logAudit('BACKUP_RESTORED', 'Database', 'ALL', 'Successfully restored database from backup file');
      return true;
    } catch (err) {
      this.sqliteDB.run('ROLLBACK;');
      this.sqliteDB.run('PRAGMA foreign_keys = ON;');
      throw new Error(`Restoration failed and was rolled back safely: ${err.message}`);
    }
  }
}

window.wrsmsDB = new WRSMSDatabase();