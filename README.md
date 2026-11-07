# Water Refilling Station Management System (WRSMS)
**Standard ISO/IEC/IEEE 29148 Compliant Blueprint Implementation**
*Version 1.1.0 — Cash-Only Operational Architecture*

---

## 1. Project Overview

The **Water Refilling Station Management System (WRSMS)** is a standalone, offline, cash-only desktop application designed specifically for water refilling station owners and administrators. It consolidates walk-in counter sales, bottle refills, reusable container tracking, delivery trip COD remittance, customer account ledgers, operating expenses, and daily cash closing (Z-Reading) in one local relational database.

### Core Architecture & Design Principles
- **Admin-Only Model**: Only the designated station administrator can authenticate. Riders, customers, and staff are operational data records without login credentials (`FR-AUTH-07`).
- **100% Offline & Isolated**: Runs entirely on the local workstation without internet access, external cloud servers, or third-party payment gateways (`NFR-REL-01`, `NFR-SEC-04`).
- **Physical Cash Only**: Payment collection is strictly limited to physical cash or approved on-account receivables (`FR-ORD-10`). No e-wallets, cards, or QR gateways.
- **Fixed-Precision Centavo Arithmetic**: All monetary calculations use integer centavos (`1 PHP = 100 centavos`) to completely eliminate IEEE 754 floating-point rounding errors (`NFR-QUAL-02`).
- **Philippine Localization**: Currency in Philippine Peso (`₱` / PHP), dates in Asia/Manila (UTC+8) time (`NFR-QUAL-03`).

---

## 2. Relational Database Schema (SRS Section 6.1)

The system implements the exact 16 relational stores specified in Section 6.1:

| # | Table Name | Key Attributes / Relationships | Business Purpose |
|---|---|---|---|
| 1 | `Admin_Account` | `admin_id` (PK), `username` (unique), `password_hash`, `salt`, `is_active`, `last_login_at` | Stores the sole authorized login account with salted SHA-256 hash. |
| 2 | `Customers` | `customer_id` (PK), `full_name`, `phone`, `address`, `landmark`, `customer_type`, `credit_limit`, `is_active` | Customer directory (Household & Commercial). Walk-in guests supported without profiles. |
| 3 | `Products` | `product_id` (PK), `name`, `category`, `unit`, `unit_price`, `tracks_stock`, `minimum_stock`, `is_active` | Station catalog (Purified, Alkaline, Mineral, Containers, Accessories). |
| 4 | `Orders` | `order_id` (PK), `order_number` (unique), `customer_id` (FK), `order_type`, `order_status`, `payment_status`, `subtotal`, `discount`, `total_amount` | Order headers for walk-in and delivery transactions. |
| 5 | `Order_Items` | `order_item_id` (PK), `order_id` (FK), `product_id` (FK), `quantity`, `unit_price_at_sale`, `line_total`, `swap_type`, `deposit_amount` | Line items locking in historical prices at sale time (`FR-PROD-04`). |
| 6 | `Payments` | `payment_id` (PK), `order_id` (FK), `customer_id` (FK), `transaction_type`, `amount`, `cash_tendered`, `change_due`, `received_at` | Cash payments: sales, account collections, deposits, and refunds. |
| 7 | `Customer_Account_Ledger` | `entry_id` (PK), `customer_id` (FK), `order_id` (FK), `entry_type`, `debit_amount`, `credit_amount`, `entry_date` | Traceable on-account receivables and physical cash settlement collections. |
| 8 | `Container_Ledger` | `container_entry_id` (PK), `customer_id` (FK), `order_id` (FK), `movement_type`, `qty_issued`, `qty_returned`, `deposit_amount` | Tracks 5-gal reusable bottles held by customers, 1-to-1 swaps, and deposits. |
| 9 | `Inventory_Movements` | `movement_id` (PK), `product_id` (FK), `movement_type`, `quantity`, `related_order_id`, `reason`, `admin_id` | Audit trail for production refills, sales, returns, damages, and adjustments. |
| 10 | `Delivery_Riders` | `rider_id` (PK), `full_name`, `phone`, `is_active`, `notes` | Delivery personnel contact records (no system login credentials). |
| 11 | `Delivery_Trips` | `trip_id` (PK), `rider_id` (FK), `dispatch_time`, `return_time`, `expected_cod`, `actual_remittance`, `variance`, `trip_status` | Delivery batches, dispatch times, and COD reconciliation. |
| 12 | `Delivery_Trip_Orders` | `trip_order_id` (PK), `trip_id` (FK), `order_id` (FK), `delivery_result`, `empties_returned` | Links orders to trips with fulfillment outcomes. |
| 13 | `Expenses` | `expense_id` (PK), `category`, `amount`, `description`, `expense_date`, `paid_from_drawer` | Station operating expenses (Supplies, Fuel, Utilities, Maintenance). |
| 14 | `Cash_Closings` | `closing_id` (PK), `business_date`, `opening_float`, `cash_receipts`, `accepted_rider_remittance`, `account_collections`, `deposits`, `drawer_expenses`, `expected_cash`, `actual_cash`, `variance` | Daily closing / Z-Reading records comparing expected cash with counted cash. |
| 15 | `Audit_Logs` | `log_id` (PK), `admin_id` (FK), `action_type`, `entity_name`, `record_id`, `reason`, `before_summary`, `after_summary` | Immutable traceability log for cancellations, overrides, adjustments, and logins. |
| 16 | `Backup_History` | `backup_id` (PK), `file_path`, `created_at`, `result`, `notes` | Tracks local JSON and SQLite DDL/INSERT backup generations. |

---

## 3. Features & SRS Requirement Traceability

### 3.1 Administrator Authentication & Session Security (FR-AUTH & NFR-SEC)
- **FR-AUTH-01 / FR-AUTH-07**: Single admin sign-in form; zero public registration; no staff logins.
- **FR-AUTH-02 / NFR-SEC-01**: Passwords stored as cryptographic salted SHA-256 hashes generated via the Web Crypto API (`crypto.subtle`).
- **FR-AUTH-05**: Administrator can update password after validating current password.
- **FR-AUTH-06 / NFR-SEC-03**: Automatic session logout after 15 minutes of inactivity.
- **NFR-SEC-02**: Security lockout triggering a 15-minute cooldown after 5 consecutive failed login attempts.

### 3.2 Dashboard (FR-DASH)
- **FR-DASH-01**: Total completed sales for Today, Week, and Month.
- **FR-DASH-02**: Real-time counts of orders by status (`Pending`, `Preparing`, `Dispatched`, `Completed`, `Cancelled`).
- **FR-DASH-03**: Prominent low-stock warning banners when any product stock falls at or below minimum threshold.
- **FR-DASH-04**: Customer receivables balance and COD cash awaiting remittance.
- **FR-DASH-05**: Recent orders table with customer name, total, time, and status.

### 3.3 Products & Pricing (FR-PROD)
- **FR-PROD-01 & 02**: Full product management (Name, Category, Unit, PHP Price, Tracks Stock, Min Stock, Active Status).
- **FR-PROD-03**: Validation rejects negative prices and non-positive order quantities.
- **FR-PROD-04**: Unit price at the time of sale is captured permanently on order lines, preserving historical accuracy.
- **FR-PROD-06**: Price overrides and discounts require an explicit reason and are logged in the audit trail.

### 3.4 Customers & Account Ledgers (FR-CUST)
- **FR-CUST-01 & 02**: Customer profiles with contact numbers, addresses, landmarks, customer type, and credit limits.
- **FR-CUST-03**: Walk-in guests supported without creating permanent profiles.
- **FR-CUST-04 & 05**: Account ledger tracking on-account charges and physical cash collections.
- **FR-CUST-06**: Enforces customer credit limits; requires administrative confirmation and audit log on overrides.
- **FR-CUST-07**: Record physical cash collection modal to settle outstanding customer balances.
- **FR-CUST-08**: Customer container custody balance (units held).

### 3.5 Point of Sale (POS) & Order Management (FR-ORD)
- **FR-ORD-01 & 03**: Walk-in counter orders and scheduled delivery orders.
- **FR-ORD-02**: Unique auto-generated order numbers (`ORD-YYYYMMDD-XXX`).
- **FR-ORD-04**: Instant change calculation (`Change = Cash Tendered - Total Due`); rejects insufficient cash.
- **FR-ORD-07**: On-screen printable thermal receipt preview with ₱ PHP formatting, Asia/Manila timestamp, line items, and container swap notes.
- **FR-ORD-08**: Order cancellation requires a mandatory reason, reverses inventory deductions, and reverses ledger debits.
- **FR-ORD-10**: Exclusively cash or approved on-account credit; strictly no e-wallets, cards, or online gateways.

### 3.6 Inventory & Reusable Containers (FR-INV)
- **FR-INV-01 & 02**: Tracks saleable stock and 4 distinct states for reusable 5-gal containers:
  1. *Filled Available* at station
  2. *Empty Bottles* at station
  3. *Held by Customers* (custody balance)
  4. *Damaged / Retired*
- **FR-INV-03**: 1-to-1 swap deducts filled unit and adds empty unit returned.
- **FR-INV-04**: Borrowing a bottle without exchange records bottle debt and adds refundable deposit (₱100/unit).
- **FR-INV-05**: Traceable stock movement history log with timestamp, product, quantity, type, and justification.
- **FR-INV-07**: Manual stock adjustment requires mandatory reason; rejects negative available stock unless explicitly authorized.
- **FR-INV-08**: Recording damaged/retired containers removes them from usable rotation without erasing history.

### 3.7 Delivery Dispatch & COD Remittance (FR-DEL)
- **FR-DEL-01**: Rider contact records without accounts.
- **FR-DEL-02**: Batch dispatch: assign one or more pending delivery orders to a named rider.
- **FR-DEL-03**: Printable Trip Manifest showing order list, customer address, landmark, phone, and expected COD.
- **FR-DEL-05 & 06**: Trip reconciliation: inputs actual cash remitted, computes variance (`Actual - Expected COD`).
- **FR-DEL-07**: Records returned empty containers.
- **FR-DEL-08**: Station cash drawer is ONLY credited when the administrator verifies and accepts the COD remittance.

### 3.8 Cash Management & Daily Closing / Z-Reading (FR-CASH)
- **FR-CASH-05**: Operating expense entry with category, description, and `paid_from_drawer` flag.
- **FR-CASH-06**: Strict implementation of the SRS Expected Closing Cash formula:
  $$\text{Expected Cash} = \text{Opening Float} + \text{Counter Cash Sales} + \text{Accepted Rider COD} + \text{Account Collections} + \text{Container Deposits} - \text{Cash Refunds} - \text{Drawer Expenses}$$
- **FR-CASH-07**: Calculates variance as $\text{Counted Cash} - \text{Expected Cash}$ (labeled *Exact*, *Cash Over*, or *Cash Short*).
- **FR-CASH-08**: Saves dated Z-Reading report; prevents silent overwriting; prints official Z-slip.

### 3.9 Reports, Audit Logs, Backup/Restore (FR-REP, FR-AUD, FR-BKP)
- **FR-REP-01 & 02**: Daily, weekly, monthly sales reports, product sales performance, customer receivables, container balances, delivery COD summary, and expense logs.
- **FR-REP-05**: RFC 4180 Excel-compatible CSV export with UTF-8 BOM, and print styling (`@media print`).
- **FR-AUD-01 & 02**: Immutable audit trail of order cancellations, price overrides, adjustments, and security lockouts.
- **FR-BKP-01 & 02**: One-click local backup exporting full JSON snapshot and SQLite DDL/INSERT statements.
- **FR-BKP-03 & 04**: Database restore with file validation, confirmation alert, and automatic audit entry.
- **NFR-REL-04**: Automatic daily reminder prompt if no backup was performed on the current business date.

---

## 4. How to Run the Application

The application is built in standard HTML5, CSS3, and modern Vanilla JavaScript with an embedded offline relational database. It runs on **Windows, macOS, or Linux** without requiring any web server, NodeJS, or external dependencies.

### Step 1: Open Application
Simply open `index.html` in your favorite desktop web browser (Google Chrome, Microsoft Edge, Mozilla Firefox, or Safari):
```
C:\Users\User\.gemini\antigravity\scratch\wrsms\index.html
```

### Step 2: Sign In (Administrator Authentication)
Use the initial default administrator credentials:
- **Username**: `admin`
- **Password**: `admin123`

*(You can change your password anytime under the **Settings** menu).*

---

## 5. Acceptance Test Checklist (SRS Section 6.3)

| ID | Test Requirement | Expected Behavior | Status |
|---|---|---|---|
| **AC-01** | Offline Operation | Log in, place orders, update stock, and generate reports without internet connection. | **PASS** |
| **AC-02** | Admin-Only Access | Only the administrator account authenticates. No registration form; riders/customers have no logins. | **PASS** |
| **AC-03** | Cash Sale Consistency | Calculates change accurately. Saves order, items, inventory deduction, and payment in one transaction. | **PASS** |
| **AC-04** | On-Account Receivables | Credit order increases customer receivables but NOT the cash drawer; later collection increases cash drawer. | **PASS** |
| **AC-05** | Container Tracking | 1-to-1 swap adjusts filled and empty counts; borrowed containers record customer custody debt & deposit. | **PASS** |
| **AC-06** | COD Remittance | Delivery trip calculates expected COD; accepts remittance cash into station drawer upon admin confirmation. | **PASS** |
| **AC-07** | Z-Reading Cash Reconciliation | Expected cash matches the formula exactly; displays Over/Short variance without double-counting. | **PASS** |
| **AC-08** | Backup & Restore | Creates JSON & SQL backup files. Validates and restores previous database snapshot with confirmation. | **PASS** |

---

## 6. Project Team Sign-Off

- **Project Manager**: Dimple Clent V. Daguman
- **Database Administrator / Developers**: Marc F. Cabili, Seth Luke Jackson
- **System Analysts**: Alyssa Denise Clemente, John Ashley Pedimonte
- **QA / Testing Leads**: Khaila Mae Ruiz, Shanley Uy
- **UI/UX Designer**: Andrew Albano
