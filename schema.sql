-- =============================================================================
-- Aqua Nhoy - Water Refilling Station Management System (WRSMS)
-- Relational Database DDL Specification (ISO/IEC/IEEE 29148 Standard Compliant)
-- Engine: SQLite 3.x with Foreign Keys Enabled
-- Monetary convention: Integer centavos (1 PHP = 100 Centavos)
-- =============================================================================

PRAGMA foreign_keys = ON;

-- 1. Admin Account (Single Administrator Account, Salted Cryptographic Hash)
CREATE TABLE IF NOT EXISTS Admin_Account (
    admin_id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    full_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL,
    last_login_at TEXT
);

-- 2. Customers (Operational directory, not login users)
CREATE TABLE IF NOT EXISTS Customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT,
    customer_type TEXT NOT NULL CHECK(customer_type IN ('Household', 'Commercial', 'Dealer')),
    address TEXT NOT NULL,
    landmark TEXT,
    credit_limit INTEGER NOT NULL DEFAULT 0 CHECK(credit_limit >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    created_at TEXT NOT NULL
);

-- 3. Products & Pricing Catalog
CREATE TABLE IF NOT EXISTS Products (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('Refill', 'Bottled Water', 'Container', 'Accessory')),
    unit TEXT NOT NULL,
    unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
    tracks_stock INTEGER NOT NULL DEFAULT 1 CHECK(tracks_stock IN (0, 1)),
    minimum_stock INTEGER NOT NULL DEFAULT 10 CHECK(minimum_stock >= 0),
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1))
);

-- 4. Orders
CREATE TABLE IF NOT EXISTS Orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT NOT NULL UNIQUE,
    customer_id INTEGER REFERENCES Customers(customer_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    order_type TEXT NOT NULL CHECK(order_type IN ('Walk-In', 'Delivery')),
    order_status TEXT NOT NULL CHECK(order_status IN ('Pending', 'Preparing', 'Dispatched', 'Completed', 'Cancelled')),
    payment_status TEXT NOT NULL CHECK(payment_status IN ('Paid', 'On-Account', 'Pending COD')),
    subtotal INTEGER NOT NULL CHECK(subtotal >= 0),
    discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0),
    discount_reason TEXT,
    total_amount INTEGER NOT NULL CHECK(total_amount >= 0),
    created_at TEXT NOT NULL,
    notes TEXT
);

-- 5. Order Line Items (Historical prices locked at point of sale)
CREATE TABLE IF NOT EXISTS Order_Items (
    order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES Orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES Products(product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    unit_price_at_sale INTEGER NOT NULL CHECK(unit_price_at_sale >= 0),
    line_total INTEGER NOT NULL CHECK(line_total >= 0),
    swap_type TEXT NOT NULL CHECK(swap_type IN ('swap_1to1', 'borrow_deposit', 'purchase_new', 'none')),
    deposit_amount INTEGER NOT NULL DEFAULT 0 CHECK(deposit_amount >= 0)
);

-- 6. Payments (Physical Cash Inflow Only)
CREATE TABLE IF NOT EXISTS Payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER REFERENCES Orders(order_id) ON UPDATE CASCADE ON DELETE SET NULL,
    customer_id INTEGER REFERENCES Customers(customer_id) ON UPDATE CASCADE ON DELETE SET NULL,
    transaction_type TEXT NOT NULL CHECK(transaction_type IN ('cash_sale', 'delivery_cod', 'account_collection', 'container_deposit', 'deposit_refund')),
    amount INTEGER NOT NULL CHECK(amount >= 0),
    cash_tendered INTEGER NOT NULL CHECK(cash_tendered >= 0),
    change_due INTEGER NOT NULL DEFAULT 0 CHECK(change_due >= 0),
    received_at TEXT NOT NULL,
    reference_note TEXT
);

-- 7. Customer Account Ledger (Receivables & Collections Tracking)
CREATE TABLE IF NOT EXISTS Customer_Account_Ledger (
    entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES Customers(customer_id) ON UPDATE CASCADE ON DELETE CASCADE,
    order_id INTEGER REFERENCES Orders(order_id) ON UPDATE CASCADE ON DELETE SET NULL,
    entry_type TEXT NOT NULL CHECK(entry_type IN ('charge', 'cash_collection', 'adjustment')),
    debit_amount INTEGER NOT NULL DEFAULT 0 CHECK(debit_amount >= 0),
    credit_amount INTEGER NOT NULL DEFAULT 0 CHECK(credit_amount >= 0),
    entry_date TEXT NOT NULL,
    notes TEXT
);

-- 8. Container Ledger (Traceable Custody & Swap Movements)
CREATE TABLE IF NOT EXISTS Container_Ledger (
    container_entry_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER REFERENCES Customers(customer_id) ON UPDATE CASCADE ON DELETE SET NULL,
    order_id INTEGER REFERENCES Orders(order_id) ON UPDATE CASCADE ON DELETE SET NULL,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('swap_1to1', 'borrow_issued', 'order_issue', 'return_received', 'damaged', 'deposit_collected', 'deposit_refunded', 'manual_adjustment', 'held_adjustment')),
    qty_issued INTEGER NOT NULL DEFAULT 0 CHECK(qty_issued >= 0),
    qty_returned INTEGER NOT NULL DEFAULT 0 CHECK(qty_returned >= 0),
    deposit_amount INTEGER NOT NULL DEFAULT 0 CHECK(deposit_amount >= 0),
    entry_date TEXT NOT NULL,
    notes TEXT
);

-- 9. Inventory Movements (Stock In/Out Audit Trail)
CREATE TABLE IF NOT EXISTS Inventory_Movements (
    movement_id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES Products(product_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    movement_type TEXT NOT NULL CHECK(movement_type IN ('initial_stock', 'production_refill', 'sale_deduction', 'manual_add', 'manual_subtract', 'damage', 'loss', 'customer_return', 'empty_return', 'container_damage', 'empty_manual_add', 'empty_manual_sub', 'damage_reversal')),
    quantity INTEGER NOT NULL CHECK(quantity > 0),
    related_order_id INTEGER REFERENCES Orders(order_id) ON UPDATE CASCADE ON DELETE SET NULL,
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL,
    admin_id INTEGER NOT NULL REFERENCES Admin_Account(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 10. Delivery Riders (Contact directory only, no login accounts)
CREATE TABLE IF NOT EXISTS Delivery_Riders (
    rider_id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    notes TEXT
);

-- 11. Delivery Trips (Dispatch Manifests)
CREATE TABLE IF NOT EXISTS Delivery_Trips (
    trip_id INTEGER PRIMARY KEY AUTOINCREMENT,
    rider_id INTEGER NOT NULL REFERENCES Delivery_Riders(rider_id) ON UPDATE CASCADE ON DELETE RESTRICT,
    dispatch_time TEXT NOT NULL,
    return_time TEXT,
    expected_cod INTEGER NOT NULL DEFAULT 0 CHECK(expected_cod >= 0),
    actual_remittance INTEGER NOT NULL DEFAULT 0 CHECK(actual_remittance >= 0),
    variance INTEGER NOT NULL DEFAULT 0,
    trip_status TEXT NOT NULL CHECK(trip_status IN ('dispatched', 'reconciled')),
    notes TEXT
);

-- 12. Delivery Trip Orders (Batch Mapping)
CREATE TABLE IF NOT EXISTS Delivery_Trip_Orders (
    trip_order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    trip_id INTEGER NOT NULL REFERENCES Delivery_Trips(trip_id) ON UPDATE CASCADE ON DELETE CASCADE,
    order_id INTEGER NOT NULL REFERENCES Orders(order_id) ON UPDATE CASCADE ON DELETE CASCADE,
    delivery_result TEXT NOT NULL CHECK(delivery_result IN ('dispatched', 'delivered', 'failed', 'returned')),
    quantities_delivered INTEGER NOT NULL DEFAULT 0,
    empties_returned INTEGER NOT NULL DEFAULT 0,
    notes TEXT
);

-- 13. Expenses
CREATE TABLE IF NOT EXISTS Expenses (
    expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL CHECK(category IN ('Supplies', 'Fuel/Delivery', 'Utilities', 'Maintenance', 'Salaries/Allowances', 'Miscellaneous')),
    amount INTEGER NOT NULL CHECK(amount > 0),
    description TEXT NOT NULL,
    expense_date TEXT NOT NULL,
    paid_from_drawer INTEGER NOT NULL DEFAULT 1 CHECK(paid_from_drawer IN (0, 1)),
    admin_id INTEGER NOT NULL REFERENCES Admin_Account(admin_id) ON UPDATE CASCADE ON DELETE RESTRICT
);

-- 14. Cash Closings (Z-Reading Financial Archival)
CREATE TABLE IF NOT EXISTS Cash_Closings (
    closing_id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_date TEXT NOT NULL UNIQUE,
    opening_float INTEGER NOT NULL CHECK(opening_float >= 0),
    cash_receipts INTEGER NOT NULL CHECK(cash_receipts >= 0),
    accepted_rider_remittance INTEGER NOT NULL CHECK(accepted_rider_remittance >= 0),
    account_collections INTEGER NOT NULL CHECK(account_collections >= 0),
    deposits INTEGER NOT NULL CHECK(deposits >= 0),
    cash_refunds INTEGER NOT NULL DEFAULT 0 CHECK(cash_refunds >= 0),
    drawer_expenses INTEGER NOT NULL CHECK(drawer_expenses >= 0),
    expected_cash INTEGER NOT NULL,
    actual_cash INTEGER NOT NULL CHECK(actual_cash >= 0),
    variance INTEGER NOT NULL,
    closed_at TEXT NOT NULL
);

-- 15. Audit Logs (Immutable Traceability)
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

-- 16. Backup History
CREATE TABLE IF NOT EXISTS Backup_History (
    backup_id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    result TEXT NOT NULL CHECK(result IN ('success', 'failed')),
    notes TEXT
);

-- Performance & Foreign Key Indexing
CREATE INDEX IF NOT EXISTS idx_orders_customer ON Orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON Order_Items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON Order_Items(product_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON Payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_received ON Payments(received_at);
CREATE INDEX IF NOT EXISTS idx_cust_ledger_cust ON Customer_Account_Ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_container_ledger_cust ON Container_Ledger(customer_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_prod ON Inventory_Movements(product_id);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON Expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_audit_created ON Audit_Logs(created_at);