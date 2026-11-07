/**
 * Water Refilling Station Management System (WRSMS)
 * Main Application Controller & UI Logic
 * Standard ISO/IEC/IEEE 29148 Compliant Implementation
 */

class WRSMSApp {
  constructor() {
    this.currentView = 'dashboard';
    this.cart = [];
    this.cartDiscount = 0;
    this.cartDiscountReason = '';
    this.cartPaymentMode = 'cash'; // 'cash' or 'credit'
    this.selectedCustomerId = 0;
    this.confirmCallback = null;
  }

  async init() {
    console.log('Initializing WRSMS application...');
    this.initClock();
    this.initEventListeners();

    // Check existing authentication session
    const hasSession = await window.wrsmsAuth.restoreSession();
    if (hasSession) {
      this.showAppView();
    } else {
      this.showAuthView();
    }
  }

  // Real-time Clock (Asia/Manila UTC+8)
  initClock() {
    const updateTime = () => {
      const el = document.getElementById('current-time-str');
      if (el) {
        el.textContent = DateTimeUtil.formatDateTime(new Date());
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  showAuthView() {
    document.getElementById('auth-view').style.display = 'flex';
    document.getElementById('app-view').style.display = 'none';
    const lockout = window.wrsmsAuth.getLockoutStatus();
    if (lockout.isLocked) {
      const mins = Math.ceil(lockout.remainingMs / 60000);
      this.showAuthError(`Account locked for ${mins} minute(s) due to multiple failed login attempts.`);
    } else {
      this.hideAuthError();
    }
  }

  async showAppView() {
    document.getElementById('auth-view').style.display = 'none';
    document.getElementById('app-view').style.display = 'flex';
    const user = window.wrsmsAuth.currentUser;
    if (user) {
      document.getElementById('sidebar-admin-name').textContent = user.full_name || user.username;
    }
    await this.refreshAll();
    this.checkDailyBackupReminder();
  }

  showAuthError(msg) {
    const el = document.getElementById('auth-error');
    const lockout = window.wrsmsAuth.getLockoutStatus();
    if (lockout.isLocked) {
      el.innerHTML = `<div>${msg}</div><button type="button" class="btn btn-secondary btn-sm" style="margin-top: 8px; font-size: 11.5px; width: 100%;" onclick="window.wrsmsAuth.clearLockout(); window.wrsmsApp.hideAuthError(); window.wrsmsApp.showToast('Lockout cleared. You can now sign in.', 'success');">Clear Lockout &amp; Try Again</button>`;
    } else {
      el.textContent = msg;
    }
    el.style.display = 'block';
  }

  hideAuthError() {
    const el = document.getElementById('auth-error');
    el.style.display = 'none';
  }

  // Toast Notification System
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    let icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    if (type === 'success') {
      toast.style.background = '#065f46';
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === 'danger' || type === 'error') {
      toast.style.background = '#991b1b';
      icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    } else if (type === 'warning') {
      toast.style.background = '#92400e';
    }

    toast.innerHTML = `${icon}<span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // View Navigation Switcher
  switchView(viewName) {
    this.currentView = viewName;
    document.querySelectorAll('.nav-item').forEach(el => {
      if (el.getAttribute('data-view') === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    document.querySelectorAll('.app-view-module').forEach(el => {
      el.style.display = 'none';
    });

    const target = document.getElementById(`view-${viewName}`);
    if (target) {
      target.style.display = 'block';
    }

    // Update Topbar Title
    const titles = {
      dashboard: 'Dashboard',
      pos: 'Point of Sale (POS)',
      orders: 'Orders History',
      products: 'Products & Pricing',
      customers: 'Customers & Ledgers',
      inventory: 'Inventory & Reusable Containers',
      delivery: 'Delivery Trips & COD Remittance',
      cash: 'Cash Drawer & Daily Closing (Z-Reading)',
      reports: 'Operational & Financial Reports',
      audit: 'System Audit Logs',
      backup: 'Backup & Restore',
      settings: 'Settings'
    };
    document.getElementById('top-bar-title').textContent = titles[viewName] || 'WRSMS';

    // Refresh specific view
    this.refreshView(viewName);
  }

  async refreshAll() {
    await this.renderDashboard();
    await this.renderPOSCatalog();
    await this.renderOrdersTable();
    await this.renderProductsTable();
    await this.renderCustomersTable();
    await this.renderInventoryView();
    await this.renderDeliveryView();
    await this.renderCashView();
    await this.renderAuditLogsTable();
    await this.renderBackupHistoryTable();
  }

  async refreshView(viewName) {
    switch (viewName) {
      case 'dashboard': await this.renderDashboard(); break;
      case 'pos': await this.renderPOSCatalog(); break;
      case 'orders': await this.renderOrdersTable(); break;
      case 'products': await this.renderProductsTable(); break;
      case 'customers': await this.renderCustomersTable(); break;
      case 'inventory': await this.renderInventoryView(); break;
      case 'delivery': await this.renderDeliveryView(); break;
      case 'cash': await this.renderCashView(); break;
      case 'reports': await this.initReportsView(); break;
      case 'audit': await this.renderAuditLogsTable(); break;
      case 'backup': await this.renderBackupHistoryTable(); break;
    }
  }

  // =========================================================================
  // 1. DASHBOARD CONTROLLER (FR-DASH)
  // =========================================================================
  async renderDashboard(range = 'today') {
    const orders = await window.wrsmsDB.getAll('Orders');
    const customers = await window.wrsmsDB.getAll('Customers');
    const cStats = await window.wrsmsDB.getContainerStats();

    // Date filtering
    const now = new Date();
    const todayStr = DateTimeUtil.todayDateStr();

    let filteredOrders = orders;
    if (range === 'today') {
      filteredOrders = orders.filter(o => o.created_at && o.created_at.startsWith(todayStr));
      document.getElementById('stat-sales-period').textContent = 'For Today';
    } else if (range === 'week') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.created_at) >= oneWeekAgo);
      document.getElementById('stat-sales-period').textContent = 'Last 7 Days';
    } else if (range === 'month') {
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filteredOrders = orders.filter(o => new Date(o.created_at) >= oneMonthAgo);
      document.getElementById('stat-sales-period').textContent = 'Last 30 Days';
    }

    // Total Completed Sales
    let totalSalesCentavos = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let preparingCount = 0;
    let dispatchedCount = 0;
    let cancelledCount = 0;

    for (const o of filteredOrders) {
      if (o.order_status === 'Completed') {
        totalSalesCentavos += Number(o.total_amount) || 0;
        completedCount++;
      } else if (o.order_status === 'Pending') pendingCount++;
      else if (o.order_status === 'Preparing') preparingCount++;
      else if (o.order_status === 'Dispatched') dispatchedCount++;
      else if (o.order_status === 'Cancelled') cancelledCount++;
    }

    document.getElementById('stat-total-sales').textContent = Currency.formatPHP(totalSalesCentavos);
    document.getElementById('stat-order-count').textContent = completedCount;

    document.getElementById('dash-count-pending').textContent = pendingCount;
    document.getElementById('dash-count-preparing').textContent = preparingCount;
    document.getElementById('dash-count-dispatched').textContent = dispatchedCount;
    document.getElementById('dash-count-completed').textContent = completedCount;
    document.getElementById('dash-count-cancelled').textContent = cancelledCount;

    // Customer Receivables Total
    let totalReceivables = 0;
    for (const c of customers) {
      const bal = await window.wrsmsDB.getCustomerBalance(c.customer_id);
      if (bal > 0) totalReceivables += bal;
    }
    document.getElementById('stat-receivables').textContent = Currency.formatPHP(totalReceivables);

    // COD Awaiting Remittance (from dispatched delivery trips)
    const trips = await window.wrsmsDB.getAll('Delivery_Trips');
    let codDue = 0;
    for (const t of trips) {
      if (t.trip_status === 'dispatched') {
        codDue += Number(t.expected_cod) || 0;
      }
    }
    document.getElementById('stat-cod-due').textContent = Currency.formatPHP(codDue);

    // Reusable Container Stats
    document.getElementById('dash-container-filled').textContent = cStats.filledAvailable;
    document.getElementById('dash-container-empty').textContent = cStats.emptyAtStation;
    document.getElementById('dash-container-held').textContent = cStats.customerHeld;
    document.getElementById('dash-container-damaged').textContent = cStats.damagedLost;

    // Low Stock Alert Check (FR-DASH-03, FR-INV-06)
    const products = await window.wrsmsDB.getAll('Products');
    const lowStockItems = [];
    for (const p of products) {
      if (p.is_active && p.tracks_stock) {
        const stock = await window.wrsmsDB.getProductStock(p.product_id);
        if (stock <= (p.minimum_stock || 0)) {
          lowStockItems.push(`${p.name} (Stock: ${stock}, Min: ${p.minimum_stock})`);
        }
      }
    }

    const lowStockAlert = document.getElementById('dashboard-low-stock-alert');
    const lowStockBadge = document.getElementById('low-stock-badge');
    if (lowStockItems.length > 0) {
      lowStockAlert.style.display = 'block';
      document.getElementById('dashboard-low-stock-msg').textContent =
        `${lowStockItems.length} product(s) at or below threshold: ${lowStockItems.join('; ')}`;
      lowStockBadge.textContent = lowStockItems.length;
      lowStockBadge.style.display = 'inline-block';
    } else {
      lowStockAlert.style.display = 'none';
      lowStockBadge.style.display = 'none';
    }

    // Recent Orders List (FR-DASH-05)
    const recentOrders = [...orders].reverse().slice(0, 6);
    const tbody = document.getElementById('dash-recent-orders-body');
    if (recentOrders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No orders recorded yet.</td></tr>';
    } else {
      tbody.innerHTML = recentOrders.map(o => {
        let custName = 'Walk-In Guest';
        if (o.customer_id) {
          const c = customers.find(x => x.customer_id === o.customer_id);
          if (c) custName = c.full_name;
        }
        const badgeClass = o.order_status === 'Completed' ? 'badge-success' :
          o.order_status === 'Cancelled' ? 'badge-danger' :
          o.order_status === 'Preparing' ? 'badge-warning' : 'badge-info';

        return `
          <tr>
            <td><strong>${o.order_number}</strong></td>
            <td>${DateTimeUtil.formatDateTime(o.created_at)}</td>
            <td>${custName}</td>
            <td><span class="badge badge-neutral">${o.order_type || 'Walk-In'}</span></td>
            <td><strong>${Currency.formatPHP(o.total_amount)}</strong></td>
            <td><span class="badge ${badgeClass}">${o.order_status}</span></td>
          </tr>
        `;
      }).join('');
    }
  }

  // =========================================================================
  // 2. POINT OF SALE (POS) CONTROLLER (FR-ORD, FR-INV, FR-CASH)
  // =========================================================================
  async updatePOSCustomerInfo() {
    const custInfoEl = document.getElementById('pos-cust-info');
    const custSelect = document.getElementById('pos-customer-select');
    if (!custInfoEl || !custSelect) return;

    const customerId = Number(custSelect.value);
    if (!customerId) {
      custInfoEl.style.display = 'none';
      custInfoEl.innerHTML = '';
      return;
    }

    try {
      const customer = await window.wrsmsDB.getById('Customers', customerId);
      if (!customer) {
        custInfoEl.style.display = 'none';
        custInfoEl.innerHTML = '';
        return;
      }

      const balance = await window.wrsmsDB.getCustomerBalance(customerId);
      const heldContainers = await window.wrsmsDB.getCustomerContainerBalance(customerId);

      custInfoEl.style.display = 'block';
      custInfoEl.innerHTML = `
        <span>Bal Due: <strong style="color: ${balance > 0 ? '#dc2626' : 'var(--text-main)'};">${Currency.formatPHP(balance)}</strong> / Credit Limit: <strong>${Currency.formatPHP(customer.credit_limit)}</strong></span>
        <span style="margin-left: 8px;">Custody: <strong>${heldContainers} bottle(s)</strong></span>
      `;
    } catch (err) {
      console.warn('Error updating POS customer info:', err);
    }
  }

  async populatePOSCustomerDropdown(selectedId = null) {
    const custSelect = document.getElementById('pos-customer-select');
    if (!custSelect) return;
    try {
      const currentVal = selectedId ? String(selectedId) : custSelect.value;
      const customers = await window.wrsmsDB.getAll('Customers');
      const activeCustomers = customers.filter(c => Boolean(Number(c.is_active) || c.is_active === true || c.is_active === '1'));
      custSelect.innerHTML = `<option value="0">Walk-In Guest (No Profile)</option>` +
        activeCustomers.map(c => `
          <option value="${c.customer_id}">${c.full_name} (${c.customer_type})</option>
        `).join('');
      if (currentVal && Array.from(custSelect.options).some(o => o.value === currentVal)) {
        custSelect.value = currentVal;
      }
      await this.updatePOSCustomerInfo();
    } catch (err) {
      console.warn('Error populating POS customer dropdown:', err);
    }
  }

  async renderPOSCatalog() {
    try {
      await this.populatePOSCustomerDropdown();
    } catch (e) {
      console.warn('Failed to populate POS customer dropdown:', e);
    }

    const products = await window.wrsmsDB.getAll('Products');

    // Catalog Tiles
    const activeCategory = document.querySelector('.pos-cat-btn.active')?.dataset.cat || 'all';
    const searchQuery = (document.getElementById('pos-search-input')?.value || '').toLowerCase();

    let filtered = products.filter(p => Boolean(Number(p.is_active) || p.is_active === true || p.is_active === '1'));
    if (activeCategory !== 'all') {
      filtered = filtered.filter(p => p.category === activeCategory);
    }
    if (searchQuery) {
      filtered = filtered.filter(p => p.name && p.name.toLowerCase().includes(searchQuery));
    }

    const grid = document.getElementById('pos-product-grid');
    if (!grid) return;

    if (filtered.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px;">No matching active products found.</div>';
      return;
    }

    let html = '';
    for (const prod of filtered) {
      let stockDisplay = '';
      if (prod.tracks_stock) {
        const stock = await window.wrsmsDB.getProductStock(prod.product_id);
        const isLow = stock <= (prod.minimum_stock || 0);
        stockDisplay = `<div class="pos-product-meta" style="${isLow ? 'color: #dc2626; font-weight: 600;' : ''}">Available: ${stock} ${prod.unit}</div>`;
      }
      html += `
        <div class="pos-product-card" onclick="window.wrsmsApp.addToCart(${prod.product_id})">
          <div>
            <div class="pos-product-name">${prod.name}</div>
            <div class="pos-product-meta">${prod.category} &bull; ${prod.unit}</div>
            ${stockDisplay}
          </div>
          <div class="pos-product-price">${Currency.formatPHP(prod.unit_price)}</div>
        </div>
      `;
    }
    grid.innerHTML = html;
  }

  async addToCart(productId) {
    const prod = await window.wrsmsDB.getById('Products', productId);
    if (!prod || !prod.is_active) {
      this.showToast('Product is currently inactive.', 'warning');
      return;
    }

    const existing = this.cart.find(item => item.product_id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      // Default container swap option: for refills -> 1-to-1 swap; others -> no_container
      const defaultSwap = prod.category === 'Refill' ? 'swap_1to1' : 'no_container';
      this.cart.push({
        product_id: prod.product_id,
        name: prod.name,
        category: prod.category,
        unit: prod.unit,
        unit_price: prod.unit_price,
        quantity: 1,
        swap_type: defaultSwap,
        deposit_per_unit: prod.category === 'Refill' ? Currency.toCentavos(100.00) : 0
      });
    }
    this.renderCart();
  }

  updateCartQty(productId, delta) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      this.cart = this.cart.filter(i => i.product_id !== productId);
    }
    this.renderCart();
  }

  updateCartSwapType(productId, swapType) {
    const item = this.cart.find(i => i.product_id === productId);
    if (!item) return;
    item.swap_type = swapType;
    this.renderCart();
  }

  renderCart() {
    const container = document.getElementById('pos-cart-items');
    if (this.cart.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); margin-top: 40px; font-size: 13px;">
          <p>Cart is empty</p>
          <p style="font-size: 11.5px; margin-top: 4px;">Select items from the catalog on the left</p>
        </div>
      `;
      this.updateCartTotals(0, 0);
      return;
    }

    let subtotalCentavos = 0;
    let depositsCentavos = 0;

    let html = '';
    for (const item of this.cart) {
      const lineItemTotal = item.unit_price * item.quantity;
      subtotalCentavos += lineItemTotal;

      let lineDeposit = 0;
      if (item.swap_type === 'borrow_deposit') {
        lineDeposit = item.deposit_per_unit * item.quantity;
        depositsCentavos += lineDeposit;
      }

      html += `
        <div class="pos-cart-item">
          <div class="pos-item-header">
            <span>${item.name}</span>
            <span>${Currency.formatPHP(lineItemTotal)}</span>
          </div>
          <div class="pos-item-options">
            <div class="qty-control">
              <button class="qty-btn" onclick="window.wrsmsApp.updateCartQty(${item.product_id}, -1)">&minus;</button>
              <span class="qty-val">${item.quantity}</span>
              <button class="qty-btn" onclick="window.wrsmsApp.updateCartQty(${item.product_id}, 1)">&plus;</button>
            </div>
            ${item.category === 'Refill' ? `
              <select class="form-select" style="font-size: 11.5px; padding: 3px 6px; width: auto;" onchange="window.wrsmsApp.updateCartSwapType(${item.product_id}, this.value)">
                <option value="swap_1to1" ${item.swap_type === 'swap_1to1' ? 'selected' : ''}>1-to-1 Swap (₱0)</option>
                <option value="borrow_deposit" ${item.swap_type === 'borrow_deposit' ? 'selected' : ''}>Borrow (+Deposit ₱100/ea)</option>
                <option value="new_purchase" ${item.swap_type === 'new_purchase' ? 'selected' : ''}>Bought New Bottle</option>
              </select>
            ` : `<span style="font-size: 11px; color: var(--text-muted);">${item.unit}</span>`}
          </div>
          ${lineDeposit > 0 ? `
            <div style="font-size: 11px; color: #0284c7; margin-top: 4px;">
              + Refundable Deposit: ${Currency.formatPHP(lineDeposit)} (${item.quantity} containers)
            </div>
          ` : ''}
        </div>
      `;
    }

    container.innerHTML = html;
    this.updateCartTotals(subtotalCentavos, depositsCentavos);
  }

  updateCartTotals(subtotalCentavos, depositsCentavos) {
    const totalDueCentavos = Math.max(0, subtotalCentavos + depositsCentavos - this.cartDiscount);

    document.getElementById('pos-subtotal').textContent = Currency.formatPHP(subtotalCentavos);
    document.getElementById('pos-deposits').textContent = Currency.formatPHP(depositsCentavos);

    const discountRow = document.getElementById('pos-discount-row');
    if (this.cartDiscount > 0) {
      discountRow.style.display = 'flex';
      document.getElementById('pos-discount-label').textContent = `Discount (${this.cartDiscountReason || 'Authorized'})`;
      document.getElementById('pos-discount-val').textContent = `-${Currency.formatPHP(this.cartDiscount)}`;
    } else {
      discountRow.style.display = 'none';
    }

    document.getElementById('pos-total-amount').textContent = Currency.formatPHP(totalDueCentavos);

    this.calcChange();
  }

  calcChange() {
    const totalDueStr = document.getElementById('pos-total-amount').textContent.replace('₱', '').replace(/,/g, '');
    const totalDueCentavos = Currency.toCentavos(Number(totalDueStr) || 0);

    const tenderedInput = document.getElementById('pos-cash-tendered');
    const changeOutput = document.getElementById('pos-change-due');

    const tenderedPesos = Number(tenderedInput.value) || 0;
    const tenderedCentavos = Currency.toCentavos(tenderedPesos);

    if (this.cartPaymentMode === 'credit') {
      changeOutput.value = 'N/A (On-Account)';
      changeOutput.style.color = '#b45309';
      return;
    }

    if (tenderedCentavos >= totalDueCentavos) {
      const changeCentavos = tenderedCentavos - totalDueCentavos;
      changeOutput.value = Currency.formatPHP(changeCentavos);
      changeOutput.style.color = 'var(--success)';
    } else {
      changeOutput.value = 'Insufficient Cash';
      changeOutput.style.color = 'var(--danger)';
    }
  }

  // POS Order Submission (Atomically updates Orders, Items, Payments/Ledger, Containers, Inventory)
  async submitPOSOrder() {
    if (this.cart.length === 0) {
      this.showToast('Please add items to the cart first.', 'warning');
      return;
    }

    const orderType = document.getElementById('pos-order-type').value;
    const customerId = Number(document.getElementById('pos-customer-select').value) || null;

    let subtotalCentavos = 0;
    let depositsCentavos = 0;
    for (const item of this.cart) {
      subtotalCentavos += item.unit_price * item.quantity;
      if (item.swap_type === 'borrow_deposit') {
        depositsCentavos += item.deposit_per_unit * item.quantity;
      }
    }
    const totalAmountCentavos = Math.max(0, subtotalCentavos + depositsCentavos - this.cartDiscount);

    // Validation: On-Account Credit Sale (FR-CUST-06, FR-ORD-10)
    if (this.cartPaymentMode === 'credit') {
      if (!customerId) {
        this.showToast('On-account sales require a registered customer profile (cannot use Walk-In Guest).', 'danger');
        return;
      }
      const customer = await window.wrsmsDB.getById('Customers', customerId);
      const currentBalance = await window.wrsmsDB.getCustomerBalance(customerId);
      const creditLimit = customer.credit_limit || 0;

      if ((currentBalance + totalAmountCentavos) > creditLimit) {
        const proceed = confirm(`Customer credit limit (₱${Currency.toPesos(creditLimit).toFixed(2)}) will be exceeded. Outstanding: ₱${Currency.toPesos(currentBalance).toFixed(2)}, New: ₱${Currency.toPesos(totalAmountCentavos).toFixed(2)}.\n\nAuthorize credit limit override?`);
        if (!proceed) return;

        await window.wrsmsDB.logAudit(
          'CREDIT_LIMIT_OVERRIDE',
          'Customers',
          customerId,
          `Administrator authorized credit limit override for order. Balance will reach ₱${Currency.toPesos(currentBalance + totalAmountCentavos).toFixed(2)}`,
          { currentBalance, creditLimit },
          { newTotal: currentBalance + totalAmountCentavos }
        );
      }
    } else {
      // Physical Cash Sale Validation (FR-ORD-04)
      const tenderedInput = Number(document.getElementById('pos-cash-tendered').value) || 0;
      const tenderedCentavos = Currency.toCentavos(tenderedInput);
      if (tenderedCentavos < totalAmountCentavos) {
        this.showToast('Cash tendered is less than the total amount due.', 'danger');
        return;
      }
    }

    // Generate Order Number
    const orderNumber = await window.wrsmsDB.generateOrderNumber();
    const orderStatus = orderType === 'Delivery' ? 'Pending' : 'Completed';
    const paymentStatus = this.cartPaymentMode === 'credit' ? 'On-Account' : 'Paid';

    // 1. Insert Order
    const orderRecord = await window.wrsmsDB.insert('Orders', {
      order_number: orderNumber,
      customer_id: customerId,
      order_type: orderType,
      order_status: orderStatus,
      payment_status: paymentStatus,
      subtotal: subtotalCentavos,
      discount: this.cartDiscount,
      discount_reason: this.cartDiscountReason,
      total_amount: totalAmountCentavos,
      created_at: DateTimeUtil.nowISO(),
      notes: `${orderType} order processed at station counter`
    });

    // 2. Insert Order Items & Update Inventory Movements
    for (const item of this.cart) {
      await window.wrsmsDB.insert('Order_Items', {
        order_id: orderRecord.order_id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price_at_sale: item.unit_price,
        line_total: item.unit_price * item.quantity,
        swap_type: item.swap_type,
        deposit_amount: item.swap_type === 'borrow_deposit' ? (item.deposit_per_unit * item.quantity) : 0
      });

      // Deduct stock for tracked product (FR-INV-01)
      const prod = await window.wrsmsDB.getById('Products', item.product_id);
      if (prod && prod.tracks_stock) {
        await window.wrsmsDB.insert('Inventory_Movements', {
          product_id: prod.product_id,
          movement_type: 'sale_deduction',
          quantity: item.quantity,
          related_order_id: orderRecord.order_id,
          reason: `Sale deduction for ${orderNumber}`,
          created_at: DateTimeUtil.nowISO(),
          admin_id: 1
        });
      }

      // Reusable Container movements (FR-INV-03, FR-INV-04)
      if (item.category === 'Refill') {
        if (item.swap_type === 'swap_1to1') {
          // Deduct filled, record empty returned
          if (customerId) {
            await window.wrsmsDB.insert('Container_Ledger', {
              customer_id: customerId,
              order_id: orderRecord.order_id,
              movement_type: 'swap_1to1',
              qty_issued: item.quantity,
              qty_returned: item.quantity,
              deposit_amount: 0,
              entry_date: DateTimeUtil.nowISO(),
              notes: `1-to-1 bottle swap for ${orderNumber}`
            });
          }
        } else if (item.swap_type === 'borrow_deposit') {
          // Container issued without return -> held by customer
          await window.wrsmsDB.insert('Container_Ledger', {
            customer_id: customerId,
            order_id: orderRecord.order_id,
            movement_type: 'borrow_issued',
            qty_issued: item.quantity,
            qty_returned: 0,
            deposit_amount: item.deposit_per_unit * item.quantity,
            entry_date: DateTimeUtil.nowISO(),
            notes: `Station container issued with deposit for ${orderNumber}`
          });
        }
      }
    }

    // 3. Record Payment or Customer Account Ledger Charge
    if (this.cartPaymentMode === 'cash') {
      const tenderedCentavos = Currency.toCentavos(Number(document.getElementById('pos-cash-tendered').value));
      const changeCentavos = tenderedCentavos - totalAmountCentavos;

      await window.wrsmsDB.insert('Payments', {
        order_id: orderRecord.order_id,
        customer_id: customerId,
        transaction_type: 'cash_sale',
        amount: totalAmountCentavos,
        cash_tendered: tenderedCentavos,
        change_due: changeCentavos,
        received_at: DateTimeUtil.nowISO(),
        reference_note: `Physical cash collected at counter for ${orderNumber}`
      });
    } else {
      // Credit Sale: Record charge in Customer_Account_Ledger (FR-CUST-04, FR-CASH-02)
      await window.wrsmsDB.insert('Customer_Account_Ledger', {
        customer_id: customerId,
        order_id: orderRecord.order_id,
        entry_type: 'charge',
        debit_amount: totalAmountCentavos,
        credit_amount: 0,
        entry_date: DateTimeUtil.nowISO(),
        notes: `On-account charge for ${orderNumber}`
      });
    }

    this.showToast(`Order ${orderNumber} saved successfully!`, 'success');

    // Display Printable Receipt (FR-ORD-07)
    await this.showReceiptModal(orderRecord.order_id);

    // Reset POS State
    this.cart = [];
    this.cartDiscount = 0;
    this.cartDiscountReason = '';
    document.getElementById('pos-cash-tendered').value = '';
    document.getElementById('pos-change-due').value = '₱0.00';
    this.renderCart();
    await this.renderDashboard();
  }

  // =========================================================================
  // 3. RECEIPT PREVIEW (FR-ORD-07)
  // =========================================================================
  async showReceiptModal(orderId) {
    const order = await window.wrsmsDB.getById('Orders', orderId);
    if (!order) return;

    const items = await window.wrsmsDB.getAll('Order_Items');
    const orderItems = items.filter(i => i.order_id === order.order_id);
    const payments = await window.wrsmsDB.getAll('Payments');
    const payment = payments.find(p => p.order_id === order.order_id);

    let customerName = 'Walk-In Guest';
    if (order.customer_id) {
      const c = await window.wrsmsDB.getById('Customers', order.customer_id);
      if (c) customerName = c.full_name;
    }

    let itemsHtml = orderItems.map(item => `
      <div class="receipt-row" style="margin-bottom: 4px;">
        <span>${item.quantity}x ${item.line_total ? Currency.formatPHP(item.unit_price_at_sale) : ''}</span>
        <span>${Currency.formatPHP(item.line_total)}</span>
      </div>
      <div style="font-size: 11px; color: #475569; margin-bottom: 6px;">
        &nbsp;&nbsp;(${item.swap_type === 'borrow_deposit' ? 'Borrowed w/ Deposit' : item.swap_type === 'swap_1to1' ? '1-to-1 Swap' : 'Direct Purchase'})
      </div>
    `).join('');

    const container = document.getElementById('receipt-print-container');
    container.innerHTML = `
      <div class="receipt-paper">
        <div class="receipt-center">
          <h2 style="font-size: 16px; font-weight: bold; margin-bottom: 2px;">AQUA PURE WATER REFILLING</h2>
          <p style="font-size: 11px;">Station Management System &bull; Cash Counter</p>
          <p style="font-size: 11px;">Poblacion, Station Main Terminal</p>
          <p style="font-size: 11px;">Tel: 0917-000-1122</p>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-row">
          <span>Order No:</span>
          <strong>${order.order_number}</strong>
        </div>
        <div class="receipt-row">
          <span>Date/Time:</span>
          <span>${DateTimeUtil.formatDateTime(order.created_at)}</span>
        </div>
        <div class="receipt-row">
          <span>Customer:</span>
          <span>${customerName}</span>
        </div>
        <div class="receipt-row">
          <span>Order Mode:</span>
          <span>${order.order_type}</span>
        </div>
        <div class="receipt-divider"></div>
        <div style="font-weight: bold; margin-bottom: 6px;">ITEMS ORDERED:</div>
        ${itemsHtml}
        <div class="receipt-divider"></div>
        <div class="receipt-row">
          <span>Subtotal:</span>
          <span>${Currency.formatPHP(order.subtotal)}</span>
        </div>
        ${order.discount > 0 ? `
          <div class="receipt-row" style="color: #dc2626;">
            <span>Discount:</span>
            <span>-${Currency.formatPHP(order.discount)}</span>
          </div>
        ` : ''}
        <div class="receipt-row" style="font-size: 15px; font-weight: bold; margin-top: 4px;">
          <span>TOTAL DUE:</span>
          <span>${Currency.formatPHP(order.total_amount)}</span>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-row">
          <span>Payment Mode:</span>
          <strong>${order.payment_status === 'Paid' ? 'Physical Cash' : 'Approved On-Account'}</strong>
        </div>
        ${payment ? `
          <div class="receipt-row">
            <span>Cash Tendered:</span>
            <span>${Currency.formatPHP(payment.cash_tendered)}</span>
          </div>
          <div class="receipt-row">
            <span>Change Due:</span>
            <strong>${Currency.formatPHP(payment.change_due)}</strong>
          </div>
        ` : ''}
        <div class="receipt-divider"></div>
        <div class="receipt-center" style="font-size: 11px; margin-top: 10px;">
          <p>Thank you for choosing Aqua Pure!</p>
          <p>Fresh &bull; Clean &bull; Mineral &amp; Purified Water</p>
          <p style="margin-top: 4px; font-family: monospace;">ISO/IEC/IEEE 29148 Standard POS Output</p>
        </div>
      </div>
    `;

    this.openModal('modal-receipt');
  }

  // =========================================================================
  // 4. ORDERS HISTORY VIEW (FR-ORD-06, FR-ORD-08)
  // =========================================================================
  async renderOrdersTable() {
    const orders = await window.wrsmsDB.getAll('Orders');
    const customers = await window.wrsmsDB.getAll('Customers');

    const search = (document.getElementById('orders-search')?.value || '').toLowerCase();
    const filterStatus = document.getElementById('orders-status-filter')?.value || 'all';

    let list = [...orders].reverse();
    if (filterStatus !== 'all') {
      list = list.filter(o => o.order_status === filterStatus);
    }
    if (search) {
      list = list.filter(o => o.order_number.toLowerCase().includes(search));
    }

    const tbody = document.getElementById('orders-table-body');
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No matching order records found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(o => {
      let custName = 'Walk-In Guest';
      if (o.customer_id) {
        const c = customers.find(x => x.customer_id === o.customer_id);
        if (c) custName = c.full_name;
      }
      const badgeClass = o.order_status === 'Completed' ? 'badge-success' :
        o.order_status === 'Cancelled' ? 'badge-danger' :
        o.order_status === 'Preparing' ? 'badge-warning' : 'badge-info';

      const canCancel = o.order_status !== 'Completed' && o.order_status !== 'Cancelled';

      return `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>${DateTimeUtil.formatDateTime(o.created_at)}</td>
          <td><span class="badge badge-neutral">${o.order_type}</span></td>
          <td>${custName}</td>
          <td><span class="badge ${o.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td>
          <td><strong>${Currency.formatPHP(o.total_amount)}</strong></td>
          <td><span class="badge ${badgeClass}">${o.order_status}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.showReceiptModal(${o.order_id})">Receipt</button>
              ${canCancel ? `
                <button class="btn btn-warning btn-sm" onclick="window.wrsmsApp.promptCancelOrder(${o.order_id})">Cancel</button>
              ` : ''}
              ${o.order_status === 'Pending' || o.order_status === 'Preparing' ? `
                <button class="btn btn-success btn-sm" onclick="window.wrsmsApp.markOrderCompleted(${o.order_id})">Complete</button>
              ` : ''}
              <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteOrder(${o.order_id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Cancel Order with Mandatory Reason & Reversal (FR-ORD-08)
  promptCancelOrder(orderId) {
    this.openConfirmation(
      'Cancel Order',
      'Are you sure you want to cancel this order? Any inventory and customer ledger effects will be reversed.',
      true,
      async (reason) => {
        const order = await window.wrsmsDB.getById('Orders', orderId);
        if (!order) return;

        // 1. Update order status
        await window.wrsmsDB.update('Orders', orderId, {
          order_status: 'Cancelled',
          notes: `${order.notes || ''} [Cancelled: ${reason}]`
        });

        // 2. Reverse Inventory Effects (FR-ORD-08)
        const items = await window.wrsmsDB.getAll('Order_Items');
        const orderItems = items.filter(i => i.order_id === orderId);
        for (const it of orderItems) {
          const p = await window.wrsmsDB.getById('Products', it.product_id);
          if (p && p.tracks_stock) {
            await window.wrsmsDB.insert('Inventory_Movements', {
              product_id: it.product_id,
              movement_type: 'manual_add',
              quantity: it.quantity,
              related_order_id: orderId,
              reason: `Reversal for cancelled order ${order.order_number}: ${reason}`,
              created_at: DateTimeUtil.nowISO(),
              admin_id: 1
            });
          }
        }

        // 3. Reverse Customer Account Ledger if On-Account
        if (order.payment_status === 'On-Account' && order.customer_id) {
          await window.wrsmsDB.insert('Customer_Account_Ledger', {
            customer_id: order.customer_id,
            order_id: orderId,
            entry_type: 'adjustment',
            debit_amount: 0,
            credit_amount: order.total_amount,
            entry_date: DateTimeUtil.nowISO(),
            notes: `Charge reversed due to order cancellation: ${reason}`
          });
        }

        await window.wrsmsDB.logAudit(
          'ORDER_CANCEL',
          'Orders',
          order.order_number,
          reason,
          { status: order.order_status },
          { status: 'Cancelled' }
        );

        this.showToast(`Order ${order.order_number} cancelled and reversed.`, 'info');
        await this.renderOrdersTable();
        await this.renderDashboard();
      }
    );
  }

  async markOrderCompleted(orderId) {
    const order = await window.wrsmsDB.getById('Orders', orderId);
    if (!order) return;

    await window.wrsmsDB.update('Orders', orderId, { order_status: 'Completed' });
    this.showToast(`Order ${order.order_number} marked completed.`, 'success');
    await this.renderOrdersTable();
    await this.renderDashboard();
    if (this.currentView === 'reports') {
      await this.generateReport();
    }
  }

  deleteOrder(orderId) {
    this.openConfirmation(
      'Delete Order Record',
      'Are you sure you want to permanently delete this order record? Any inventory deductions and ledger charges will be reversed.',
      true,
      async (reason) => {
        const order = await window.wrsmsDB.getById('Orders', orderId);
        if (!order) return;

        // 1. Reverse Inventory Effects if order was not cancelled
        if (order.order_status !== 'Cancelled') {
          const items = await window.wrsmsDB.getAll('Order_Items');
          const orderItems = items.filter(i => i.order_id === orderId);
          for (const it of orderItems) {
            const p = await window.wrsmsDB.getById('Products', it.product_id);
            if (p && p.tracks_stock) {
              await window.wrsmsDB.insert('Inventory_Movements', {
                product_id: it.product_id,
                movement_type: 'manual_add',
                quantity: it.quantity,
                related_order_id: orderId,
                reason: `Reversal for permanently deleted order ${order.order_number}: ${reason || 'Admin deletion'}`,
                created_at: DateTimeUtil.nowISO(),
                admin_id: 1
              });
            }
          }

          // Reverse Customer Account Ledger charge if on-account
          if (order.payment_status === 'On-Account' && order.customer_id) {
            await window.wrsmsDB.insert('Customer_Account_Ledger', {
              customer_id: order.customer_id,
              order_id: orderId,
              entry_type: 'adjustment',
              debit_amount: 0,
              credit_amount: order.total_amount,
              entry_date: DateTimeUtil.nowISO(),
              notes: `Charge reversed due to order permanent deletion: ${reason || 'Admin deletion'}`
            });
          }
        }

        // 2. Delete related records
        const allItems = await window.wrsmsDB.getAll('Order_Items');
        for (const item of allItems.filter(i => i.order_id === orderId)) {
          await window.wrsmsDB.delete('Order_Items', item.order_item_id);
        }

        const allPayments = await window.wrsmsDB.getAll('Payments');
        for (const p of allPayments.filter(p => p.order_id === orderId)) {
          await window.wrsmsDB.delete('Payments', p.payment_id);
        }

        const allTripOrders = await window.wrsmsDB.getAll('Delivery_Trip_Orders');
        for (const to of allTripOrders.filter(to => to.order_id === orderId)) {
          await window.wrsmsDB.delete('Delivery_Trip_Orders', to.trip_order_id);
        }

        // 3. Delete order
        await window.wrsmsDB.delete('Orders', orderId);

        await window.wrsmsDB.logAudit(
          'ORDER_DELETED',
          'Orders',
          order.order_number,
          `Order permanently deleted. Reason: ${reason || 'Admin deletion'}`
        );

        this.showToast(`Order ${order.order_number} permanently deleted.`, 'info');
        await this.renderOrdersTable();
        await this.renderDashboard();
        await this.renderInventoryView();
        await this.renderCustomersTable();
        if (this.currentView === 'reports') {
          await this.generateReport();
        }
      }
    );
  }

  // =========================================================================
  // 5. PRODUCTS & PRICING CONTROLLER (FR-PROD)
  // =========================================================================
  async renderProductsTable() {
    const products = await window.wrsmsDB.getAll('Products');
    const tbody = document.getElementById('products-table-body');

    tbody.innerHTML = products.map(p => `
      <tr>
        <td><strong>#${p.product_id}</strong></td>
        <td><strong>${p.name}</strong></td>
        <td>${p.category}</td>
        <td>${p.unit}</td>
        <td><strong>${Currency.formatPHP(p.unit_price)}</strong></td>
        <td>${p.tracks_stock ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-neutral">No</span>'}</td>
        <td>${p.minimum_stock || 0}</td>
        <td>
          <span class="badge ${p.is_active ? 'badge-success' : 'badge-danger'}">
            ${p.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.editProductModal(${p.product_id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteProduct(${p.product_id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  editProductModal(productId) {
    window.wrsmsDB.getById('Products', productId).then(p => {
      if (!p) return;
      document.getElementById('modal-product-title').textContent = 'Edit Product';
      document.getElementById('prod-id').value = p.product_id;
      document.getElementById('prod-name').value = p.name;
      document.getElementById('prod-category').value = p.category;
      document.getElementById('prod-unit').value = p.unit;
      document.getElementById('prod-price').value = Currency.toPesos(p.unit_price);
      document.getElementById('prod-min-stock').value = p.minimum_stock || 10;
      document.getElementById('prod-tracks-stock').value = p.tracks_stock ? '1' : '0';
      document.getElementById('prod-active').value = p.is_active ? '1' : '0';
      this.openModal('modal-product');
    });
  }

  async saveProduct() {
    const id = document.getElementById('prod-id').value;
    const name = document.getElementById('prod-name').value.trim();
    const category = document.getElementById('prod-category').value;
    const unit = document.getElementById('prod-unit').value.trim();
    const pricePesos = Number(document.getElementById('prod-price').value);
    const minStock = Number(document.getElementById('prod-min-stock').value) || 0;
    const tracksStock = Number(document.getElementById('prod-tracks-stock').value);
    const isActive = Number(document.getElementById('prod-active').value);

    if (!name || !unit || isNaN(pricePesos) || pricePesos < 0) {
      this.showToast('Please provide valid product details and non-negative price (FR-PROD-03).', 'danger');
      return;
    }

    const priceCentavos = Currency.toCentavos(pricePesos);

    if (id) {
      // Edit existing product
      const existing = await window.wrsmsDB.getById('Products', id);
      await window.wrsmsDB.update('Products', id, {
        name,
        category,
        unit,
        unit_price: priceCentavos,
        minimum_stock: minStock,
        tracks_stock: tracksStock,
        is_active: isActive
      });

      await window.wrsmsDB.logAudit(
        'PRODUCT_UPDATE',
        'Products',
        id,
        'Administrator updated product information',
        existing,
        { name, unit_price: priceCentavos, is_active: isActive }
      );
      this.showToast('Product updated successfully.', 'success');
    } else {
      // Add new product
      const newProd = await window.wrsmsDB.insert('Products', {
        name,
        category,
        unit,
        unit_price: priceCentavos,
        minimum_stock: minStock,
        tracks_stock: tracksStock,
        is_active: isActive
      });

      await window.wrsmsDB.logAudit(
        'PRODUCT_CREATE',
        'Products',
        newProd.product_id,
        'Administrator registered new product in catalog'
      );
      this.showToast('New product added to catalog.', 'success');
    }

    this.closeModal('modal-product');
    await this.renderProductsTable();
    await this.renderPOSCatalog();
  }

  deleteProduct(productId) {
    this.openConfirmation(
      'Delete Product Catalog Item',
      'Are you sure you want to permanently delete this product from the catalog? This action will be recorded in the system audit trail.',
      true,
      async (reason) => {
        const product = await window.wrsmsDB.getById('Products', productId);
        if (!product) return;

        // Clean up any inventory record tied to this product
        const inv = await window.wrsmsDB.getAll('Inventory');
        const tiedInv = inv.find(i => i.product_id === productId);
        if (tiedInv) {
          await window.wrsmsDB.delete('Inventory', tiedInv.inventory_id);
        }

        await window.wrsmsDB.delete('Products', productId);
        await window.wrsmsDB.logAudit(
          'PRODUCT_DELETED',
          'Products',
          String(productId),
          `Product "${product.name}" deleted. Reason: ${reason || 'Admin deletion'}`
        );
        this.showToast(`Product "${product.name}" deleted from catalog.`, 'info');
        await this.renderProductsTable();
        await this.renderPOSCatalog();
        await this.renderInventoryView();
      }
    );
  }

  // =========================================================================
  // 6. CUSTOMERS & LEDGERS CONTROLLER (FR-CUST)
  // =========================================================================
  async renderCustomersTable() {
    const customers = await window.wrsmsDB.getAll('Customers');
    const tbody = document.getElementById('customers-table-body');

    let html = '';
    for (const c of customers) {
      const balance = await window.wrsmsDB.getCustomerBalance(c.customer_id);
      const heldContainers = await window.wrsmsDB.getCustomerContainerBalance(c.customer_id);

      html += `
        <tr>
          <td><strong>${c.full_name}</strong></td>
          <td><span class="badge badge-neutral">${c.customer_type}</span></td>
          <td>${c.phone || '-'}</td>
          <td>${c.address} ${c.landmark ? `<br><small style="color: var(--text-muted);">${c.landmark}</small>` : ''}</td>
          <td>${Currency.formatPHP(c.credit_limit)}</td>
          <td><strong style="color: ${balance > 0 ? '#dc2626' : 'var(--text-main)'};">${Currency.formatPHP(balance)}</strong></td>
          <td><span class="badge ${heldContainers > 0 ? 'badge-warning' : 'badge-neutral'}">${heldContainers} unit(s)</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.viewCustomerLedger(${c.customer_id})">Ledger</button>
              ${balance > 0 ? `
                <button class="btn btn-success btn-sm" onclick="window.wrsmsApp.openCollectionModal(${c.customer_id}, '${c.full_name.replace(/'/g, "\\'")}', ${balance})">Collect Cash</button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.editCustomerModal(${c.customer_id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteCustomer(${c.customer_id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }
    tbody.innerHTML = html || '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No customer profiles registered.</td></tr>';
  }

  openCollectionModal(customerId, customerName, balanceCentavos) {
    document.getElementById('coll-cust-id').value = customerId;
    document.getElementById('coll-cust-name').value = customerName;
    document.getElementById('coll-balance-due').value = Currency.formatPHP(balanceCentavos);
    document.getElementById('coll-amount').value = Currency.toPesos(balanceCentavos).toFixed(2);
    document.getElementById('coll-notes').value = '';
    this.openModal('modal-collection');
  }

  async recordCashCollection() {
    const customerId = Number(document.getElementById('coll-cust-id').value);
    const amountPesos = Number(document.getElementById('coll-amount').value);
    const notes = document.getElementById('coll-notes').value.trim() || 'Physical cash collection against customer balance';

    if (!customerId || isNaN(amountPesos) || amountPesos <= 0) {
      this.showToast('Please enter a valid cash collection amount.', 'danger');
      return;
    }

    const amountCentavos = Currency.toCentavos(amountPesos);

    // 1. Insert Payment Record
    await window.wrsmsDB.insert('Payments', {
      order_id: null,
      customer_id: customerId,
      transaction_type: 'account_collection',
      amount: amountCentavos,
      cash_tendered: amountCentavos,
      change_due: 0,
      received_at: DateTimeUtil.nowISO(),
      reference_note: notes
    });

    // 2. Insert Customer_Account_Ledger credit entry (FR-CUST-07, FR-CASH-03)
    await window.wrsmsDB.insert('Customer_Account_Ledger', {
      customer_id: customerId,
      order_id: null,
      entry_type: 'cash_collection',
      debit_amount: 0,
      credit_amount: amountCentavos,
      entry_date: DateTimeUtil.nowISO(),
      notes: notes
    });

    // 3. Deduct / settle pending On-Account orders for this customer
    let remaining = amountCentavos;
    const allOrders = await window.wrsmsDB.getAll('Orders');
    const customerUnpaidOrders = allOrders
      .filter(o => o.customer_id === customerId && o.payment_status === 'On-Account')
      .sort((a, b) => (a.order_id || 0) - (b.order_id || 0));

    for (const ord of customerUnpaidOrders) {
      if (remaining <= 0) break;
      if (remaining >= ord.total_amount) {
        await window.wrsmsDB.update('Orders', ord.order_id, {
          payment_status: 'Paid',
          notes: `${ord.notes || ''} [Paid via Account Collection]`
        });
        remaining -= ord.total_amount;
      }
    }

    await window.wrsmsDB.logAudit(
      'CASH_COLLECTION',
      'Customer_Account_Ledger',
      customerId,
      `Physical cash collected: ${Currency.formatPHP(amountCentavos)} (${notes})`
    );

    this.showToast(`Recorded physical cash collection of ${Currency.formatPHP(amountCentavos)}!`, 'success');
    this.closeModal('modal-collection');
    await this.renderCustomersTable();
    await this.renderOrdersTable();
    await this.renderDashboard();
    await this.renderCashView();
    if (this.currentView === 'reports') {
      await this.generateReport();
    }
  }

  editCustomerModal(customerId) {
    window.wrsmsDB.getById('Customers', customerId).then(c => {
      if (!c) return;
      document.getElementById('modal-customer-title').textContent = 'Edit Customer Profile';
      document.getElementById('cust-id').value = c.customer_id;
      document.getElementById('cust-name').value = c.full_name;
      document.getElementById('cust-phone').value = c.phone || '';
      document.getElementById('cust-type').value = c.customer_type || 'Household';
      document.getElementById('cust-address').value = c.address;
      document.getElementById('cust-landmark').value = c.landmark || '';
      document.getElementById('cust-credit-limit').value = Currency.toPesos(c.credit_limit || 0);
      document.getElementById('cust-active').value = c.is_active ? '1' : '0';
      this.openModal('modal-customer');
    });
  }

  async saveCustomer() {
    const id = document.getElementById('cust-id').value;
    const fullName = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const type = document.getElementById('cust-type').value;
    const address = document.getElementById('cust-address').value.trim();
    const landmark = document.getElementById('cust-landmark').value.trim();
    const creditLimitPesos = Number(document.getElementById('cust-credit-limit').value) || 0;
    const isActive = Number(document.getElementById('cust-active').value);

    if (!fullName || !address) {
      this.showToast('Customer name and delivery address are required.', 'danger');
      return;
    }

    const creditLimitCentavos = Currency.toCentavos(creditLimitPesos);

    let savedCustId = null;
    if (id) {
      await window.wrsmsDB.update('Customers', Number(id), {
        full_name: fullName,
        phone,
        customer_type: type,
        address,
        landmark,
        credit_limit: creditLimitCentavos,
        is_active: isActive
      });
      savedCustId = Number(id);
      this.showToast('Customer profile updated.', 'success');
    } else {
      const rec = await window.wrsmsDB.insert('Customers', {
        full_name: fullName,
        phone,
        customer_type: type,
        address,
        landmark,
        credit_limit: creditLimitCentavos,
        is_active: isActive,
        created_at: DateTimeUtil.nowISO()
      });
      savedCustId = rec.customer_id;
      this.showToast('New customer registered.', 'success');
    }

    this.closeModal('modal-customer');
    await this.renderCustomersTable();
    await this.populatePOSCustomerDropdown(savedCustId);
  }

  async deleteCustomer(customerId) {
    const customer = await window.wrsmsDB.getById('Customers', customerId);
    if (!customer) return;
    const balance = await window.wrsmsDB.getCustomerBalance(customerId);
    const balanceWarning = balance > 0
      ? ` Note: Customer currently has an outstanding receivables balance of ${Currency.formatPHP(balance)}.`
      : '';

    this.openConfirmation(
      'Delete Customer Profile',
      `Are you sure you want to delete profile for "${customer.full_name}"?${balanceWarning}`,
      true,
      async (reason) => {
        await window.wrsmsDB.delete('Customers', customerId);
        await window.wrsmsDB.logAudit(
          'CUSTOMER_DELETED',
          'Customers',
          customer.full_name,
          `Customer profile deleted. Reason: ${reason || 'Admin deletion'}`
        );
        this.showToast(`Customer profile for "${customer.full_name}" deleted.`, 'info');
        await this.renderCustomersTable();
        await this.renderDashboard();
        await this.populatePOSCustomerDropdown();
      }
    );
  }

  // Customer Account Ledgers View & Management (FR-CUST-04, 05, 07)
  async viewCustomerLedger(customerId) {
    const customer = await window.wrsmsDB.getById('Customers', customerId);
    if (!customer) return;

    const ledger = await window.wrsmsDB.getAll('Customer_Account_Ledger');
    const myEntries = ledger.filter(l => Number(l.customer_id) === Number(customerId));
    const orders = await window.wrsmsDB.getAll('Orders');

    const balance = await window.wrsmsDB.getCustomerBalance(customerId);
    const containers = await window.wrsmsDB.getCustomerContainerBalance(customerId);

    document.getElementById('cust-ledger-title').textContent = `${customer.full_name} — Account Ledger`;
    document.getElementById('cust-ledger-subtitle').innerHTML = `${customer.customer_type} Profile &bull; ${customer.address} (${customer.landmark || 'No landmark'})`;
    document.getElementById('cust-ledger-phone').textContent = customer.phone || 'None';
    document.getElementById('cust-ledger-credit-limit').textContent = Currency.formatPHP(customer.credit_limit);
    document.getElementById('cust-ledger-balance').textContent = Currency.formatPHP(balance);
    document.getElementById('cust-ledger-containers').textContent = `${containers} unit(s)`;

    // Collect Cash button inside ledger
    const collectBtn = document.getElementById('btn-ledger-collect-cash');
    if (balance > 0) {
      collectBtn.style.display = 'inline-block';
      collectBtn.onclick = () => {
        this.closeModal('modal-customer-ledger');
        this.openCollectionModal(customer.customer_id, customer.full_name, balance);
      };
    } else {
      collectBtn.style.display = 'none';
    }

    // Add manual entry button inside ledger
    document.getElementById('btn-add-ledger-entry').onclick = () => {
      this.openAddLedgerEntryModal(customerId);
    };

    const tbody = document.getElementById('cust-ledger-table-body');
    if (myEntries.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 16px;">No ledger transactions recorded yet.</td></tr>';
    } else {
      tbody.innerHTML = [...myEntries].reverse().map(e => {
        let orderNum = '-';
        if (e.order_id) {
          const ord = orders.find(o => o.order_id === e.order_id);
          orderNum = ord ? ord.order_number : `#${e.order_id}`;
        }

        const badgeClass = e.entry_type === 'charge' ? 'badge-danger' :
          e.entry_type === 'cash_collection' ? 'badge-success' : 'badge-info';

        return `
          <tr>
            <td>${DateTimeUtil.formatDateTime(e.entry_date)}</td>
            <td><span class="badge ${badgeClass}">${e.entry_type}</span></td>
            <td>${orderNum}</td>
            <td>${e.debit_amount > 0 ? `<strong style="color: #dc2626;">+${Currency.formatPHP(e.debit_amount)}</strong>` : '-'}</td>
            <td>${e.credit_amount > 0 ? `<strong style="color: #059669;">-${Currency.formatPHP(e.credit_amount)}</strong>` : '-'}</td>
            <td>${e.notes || '-'}</td>
            <td>
              <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteLedgerEntry(${e.entry_id}, ${customerId})">Void</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    this.openModal('modal-customer-ledger');
  }

  openAddLedgerEntryModal(customerId) {
    document.getElementById('manual-ledger-cust-id').value = customerId;
    document.getElementById('manual-ledger-type').value = 'charge';
    document.getElementById('manual-ledger-amount').value = '';
    document.getElementById('manual-ledger-notes').value = '';
    this.openModal('modal-add-ledger-entry');
  }

  async saveManualLedgerEntry() {
    const custId = Number(document.getElementById('manual-ledger-cust-id').value);
    const type = document.getElementById('manual-ledger-type').value;
    const amountPesos = Number(document.getElementById('manual-ledger-amount').value);
    const notes = document.getElementById('manual-ledger-notes').value.trim();

    if (!custId || isNaN(amountPesos) || amountPesos <= 0 || !notes) {
      this.showToast('Please enter a valid amount and mandatory reason/notes.', 'danger');
      return;
    }

    const amountCentavos = Currency.toCentavos(amountPesos);

    await window.wrsmsDB.insert('Customer_Account_Ledger', {
      customer_id: custId,
      order_id: null,
      entry_type: type,
      debit_amount: type === 'charge' ? amountCentavos : 0,
      credit_amount: type === 'adjustment' ? amountCentavos : 0,
      entry_date: DateTimeUtil.nowISO(),
      notes: notes
    });

    if (type === 'adjustment') {
      let remaining = amountCentavos;
      const allOrders = await window.wrsmsDB.getAll('Orders');
      const customerUnpaidOrders = allOrders
        .filter(o => o.customer_id === custId && o.payment_status === 'On-Account')
        .sort((a, b) => (a.order_id || 0) - (b.order_id || 0));

      for (const ord of customerUnpaidOrders) {
        if (remaining <= 0) break;
        if (remaining >= ord.total_amount) {
          await window.wrsmsDB.update('Orders', ord.order_id, {
            payment_status: 'Paid',
            notes: `${ord.notes || ''} [Paid via Ledger Adjustment]`
          });
          remaining -= ord.total_amount;
        }
      }
    }

    await window.wrsmsDB.logAudit(
      'LEDGER_MANUAL_ENTRY',
      'Customer_Account_Ledger',
      custId,
      `Manual ledger entry (${type}): ${Currency.formatPHP(amountCentavos)} (${notes})`
    );

    this.showToast('Customer ledger entry added successfully.', 'success');
    this.closeModal('modal-add-ledger-entry');
    await this.viewCustomerLedger(custId);
    await this.renderCustomersTable();
    await this.renderOrdersTable();
    await this.renderDashboard();
    if (this.currentView === 'reports') {
      await this.generateReport();
    }
  }

  deleteLedgerEntry(entryId, customerId) {
    this.openConfirmation(
      'Void / Delete Ledger Entry',
      'Are you sure you want to void this customer account ledger entry? The customer receivables balance will be recalculated.',
      true,
      async (reason) => {
        const entry = await window.wrsmsDB.getById('Customer_Account_Ledger', entryId);
        await window.wrsmsDB.delete('Customer_Account_Ledger', entryId);
        await window.wrsmsDB.logAudit(
          'LEDGER_ENTRY_DELETED',
          'Customer_Account_Ledger',
          String(entryId),
          `Ledger entry deleted. Prior type: ${entry ? entry.entry_type : 'N/A'}. Reason: ${reason || 'Admin void'}`
        );
        this.showToast('Ledger entry voided.', 'info');
        await this.viewCustomerLedger(customerId);
        await this.renderCustomersTable();
        await this.renderDashboard();
      }
    );
  }

  // =========================================================================
  // 7. INVENTORY & REUSABLE CONTAINERS (FR-INV)
  // =========================================================================
  async renderInventoryView() {
    const cStats = await window.wrsmsDB.getContainerStats();
    document.getElementById('inv-cnt-filled').textContent = cStats.filledAvailable;
    document.getElementById('inv-cnt-empty').textContent = cStats.emptyAtStation;
    document.getElementById('inv-cnt-held').textContent = cStats.customerHeld;
    document.getElementById('inv-cnt-damaged').textContent = cStats.damagedLost;

    // Tracked Products Table
    const products = await window.wrsmsDB.getAll('Products');
    const tracked = products.filter(p => p.tracks_stock && p.is_active);

    const stockTbody = document.getElementById('inventory-stock-table-body');
    let stockHtml = '';
    for (const p of tracked) {
      const stock = await window.wrsmsDB.getProductStock(p.product_id);
      const isLow = stock <= (p.minimum_stock || 0);

      stockHtml += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td>${p.unit}</td>
          <td><strong style="font-size: 14px; color: ${isLow ? '#dc2626' : 'var(--text-main)'};">${stock}</strong></td>
          <td>${p.minimum_stock}</td>
          <td>
            <span class="badge ${isLow ? 'badge-danger' : 'badge-success'}">
              ${isLow ? 'Low Stock Warning' : 'Adequate'}
            </span>
          </td>
        </tr>
      `;
    }
    stockTbody.innerHTML = stockHtml || '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No tracked items.</td></tr>';

    // Stock Movements History (Traceable log)
    const movements = await window.wrsmsDB.getAll('Inventory_Movements');
    const moveTbody = document.getElementById('inventory-movements-table-body');
    const recentMovements = [...movements].reverse().slice(0, 15);

    moveTbody.innerHTML = recentMovements.map(m => {
      const prod = products.find(p => p.product_id === m.product_id);
      const prodName = prod ? prod.name : `Product #${m.product_id}`;
      return `
        <tr>
          <td>${DateTimeUtil.formatDateTime(m.created_at)}</td>
          <td>${prodName}</td>
          <td><span class="badge badge-neutral">${m.movement_type}</span></td>
          <td><strong>${m.quantity}</strong></td>
          <td>${m.related_order_id ? `#${m.related_order_id}` : '-'}</td>
          <td>${m.reason || '-'}</td>
        </tr>
      `;
    }).join('');
  }

  // Record Refilling Production (Empty -> Filled)
  async openRefillModal() {
    const products = await window.wrsmsDB.getAll('Products');
    const refillProds = products.filter(p => p.category === 'Refill' && p.is_active);

    const sel = document.getElementById('refill-product-select');
    sel.innerHTML = refillProds.map(p => `<option value="${p.product_id}">${p.name}</option>`).join('');
    document.getElementById('refill-qty').value = '20';
    document.getElementById('refill-notes').value = '';
    this.openModal('modal-refill');
  }

  async recordRefillProduction() {
    const productId = Number(document.getElementById('refill-product-select').value);
    const qty = Number(document.getElementById('refill-qty').value);
    const notes = document.getElementById('refill-notes').value.trim() || 'Daily production batch filling';

    if (!productId || isNaN(qty) || qty <= 0) {
      this.showToast('Please enter a valid production quantity.', 'danger');
      return;
    }

    // Check empty container availability
    const cStats = await window.wrsmsDB.getContainerStats();
    if (cStats.emptyAtStation < qty) {
      const proceed = confirm(`Notice: Empty container stock (${cStats.emptyAtStation}) is lower than production count (${qty}). Record production anyway?`);
      if (!proceed) return;
    }

    await window.wrsmsDB.insert('Inventory_Movements', {
      product_id: productId,
      movement_type: 'production_refill',
      quantity: qty,
      related_order_id: null,
      reason: notes,
      created_at: DateTimeUtil.nowISO(),
      admin_id: 1
    });

    await window.wrsmsDB.logAudit(
      'STOCK_PRODUCTION',
      'Inventory_Movements',
      productId,
      `Refill production completed: ${qty} units (${notes})`
    );

    this.showToast(`Recorded production of ${qty} filled water containers!`, 'success');
    this.closeModal('modal-refill');
    await this.renderInventoryView();
    await this.renderDashboard();
  }

  // Manual Stock Adjustment with Mandatory Reason (FR-INV-07)
  async openStockAdjustModal() {
    const products = await window.wrsmsDB.getAll('Products');
    const sel = document.getElementById('adjust-product-select');
    sel.innerHTML = products.filter(p => p.tracks_stock && p.is_active).map(p => `
      <option value="${p.product_id}">${p.name} (${p.unit})</option>
    `).join('');
    document.getElementById('adjust-qty').value = '1';
    document.getElementById('adjust-reason').value = '';
    this.openModal('modal-stock-adjust');
  }

  async submitStockAdjustment() {
    const productId = Number(document.getElementById('adjust-product-select').value);
    const adjustType = document.getElementById('adjust-type').value;
    let qty1 = Number(document.getElementById('adjust-qty').value);
    const reason = document.getElementById('adjust-reason').value.trim();

    if (!productId || isNaN(qty1) || qty1 <= 0 || !reason) {
      this.showToast('Mandatory reason and valid positive quantity are required (FR-INV-07).', 'danger');
      return;
    }

    // Check negative stock restriction (FR-INV-07)
    if (['manual_subtract', 'damage', 'loss'].includes(adjustType)) {
      const currentStock = await window.wrsmsDB.getProductStock(productId);
    
//an sa pag debug kun na minus/ para ma prevent an value na < 0
      console.log("currentStock:", currentStock);
      console.log("qty1:", qty1);

      if (currentStock < qty1) {

        const proceed = confirm(`Warning: Adjustment will cause stock to drop zero (Current: ${currentStock}, Deduction: ${qty1}). Confirm authorized adjustment?`);
      
        if (!proceed) return;
         qty1 = currentStock;
      }
    }

    await window.wrsmsDB.insert('Inventory_Movements', {
      product_id: productId,
      movement_type: adjustType,
      quantity: qty1,
      related_order_id: null,
      reason: reason,
      created_at: DateTimeUtil.nowISO(),
      admin_id: 1
    });

    await window.wrsmsDB.logAudit(
      'STOCK_ADJUSTMENT',
      'Inventory_Movements',
      productId,
      `Manual stock adjustment [${adjustType}]: ${qty1} units. Reason: ${reason}`
    );

    this.showToast('Stock adjustment recorded and logged.', 'success');
    this.closeModal('modal-stock-adjust');
    await this.renderInventoryView();
    await this.renderDashboard();
  }

  // Reset Stock Movement History (Traceable Log)
  async resetStockMovements() {
    this.openConfirmation(
      'Reset Stock Movement History (Traceable Log)',
      'Are you sure you want to reset the Stock Movement History? The current stock balance for each product will be preserved as the new initial baseline, and older traceable movement entries will be cleared.',
      true,
      async (reason) => {
        const products = await window.wrsmsDB.getAll('Products');
        const tracked = products.filter(p => p.tracks_stock && p.is_active);
        const baselines = [];

        for (const p of tracked) {
          const currentStock = await window.wrsmsDB.getProductStock(p.product_id);
          if (currentStock > 0) {
            baselines.push({
              product_id: p.product_id,
              movement_type: 'initial_stock',
              quantity: currentStock,
              related_order_id: null,
              reason: `Baseline established after traceable log reset: ${reason || 'Administrator reset'}`,
              created_at: DateTimeUtil.nowISO(),
              admin_id: 1
            });
          }
        }

        await window.wrsmsDB.clearTable('Inventory_Movements');
        for (const b of baselines) {
          await window.wrsmsDB.insert('Inventory_Movements', b);
        }

        await window.wrsmsDB.logAudit(
          'STOCK_LOG_RESET',
          'Inventory_Movements',
          'ALL',
          reason || 'Stock movement history reset by administrator',
          '',
          `Reset complete. Established ${baselines.length} product baseline records.`
        );

        this.showToast('Stock movement history has been reset. Current stock balances preserved.', 'success');
        await this.renderInventoryView();
        await this.renderDashboard();
      }
    );
  }

  // =========================================================================
  // 8. DELIVERY DISPATCH & COD TRIPS (FR-DEL)
  // =========================================================================
  async renderDeliveryView() {
    const riders = await window.wrsmsDB.getAll('Delivery_Riders');
    const trips = await window.wrsmsDB.getAll('Delivery_Trips');

    // Riders Table
    const ridersTbody = document.getElementById('delivery-riders-table-body');
    ridersTbody.innerHTML = riders.map(r => `
      <tr>
        <td><strong>${r.full_name}</strong></td>
        <td>${r.phone || '-'}</td>
        <td>${r.notes || '-'}</td>
        <td><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.editRiderModal(${r.rider_id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteRider(${r.rider_id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No delivery riders registered.</td></tr>';

    // Trips Table
    const tripsTbody = document.getElementById('delivery-trips-table-body');
    if (trips.length === 0) {
      tripsTbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No delivery trips dispatched yet.</td></tr>';
      return;
    }

    tripsTbody.innerHTML = [...trips].reverse().map(t => {
      const rider = riders.find(r => r.rider_id === t.rider_id);
      const riderName = rider ? rider.full_name : `Rider #${t.rider_id}`;

      const statusBadge = t.trip_status === 'reconciled' ? 'badge-success' : 'badge-warning';

      return `
        <tr>
          <td><strong>TRIP-#${t.trip_id}</strong></td>
          <td>${riderName}</td>
          <td>${DateTimeUtil.formatDateTime(t.dispatch_time)}</td>
          <td><strong>${Currency.formatPHP(t.expected_cod)}</strong></td>
          <td>${t.actual_remittance ? Currency.formatPHP(t.actual_remittance) : '-'}</td>
          <td>${t.variance ? Currency.formatPHP(t.variance) : '₱0.00'}</td>
          <td><span class="badge ${statusBadge}">${t.trip_status}</span></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.printTripManifest(${t.trip_id})">Manifest</button>
              ${t.trip_status === 'dispatched' ? `
                <button class="btn btn-primary btn-sm" onclick="window.wrsmsApp.openReconcileTripModal(${t.trip_id})">Reconcile COD</button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Delivery Riders CRUD (FR-DEL-01)
  openRiderModal(preselectedFromDispatch = false) {
    this.riderAddedFromDispatch = preselectedFromDispatch;
    document.getElementById('rider-id').value = '';
    document.getElementById('rider-name').value = '';
    document.getElementById('rider-phone').value = '';
    document.getElementById('rider-notes').value = '';
    document.getElementById('rider-active').value = '1';
    document.getElementById('modal-rider-title').textContent = 'Add Delivery Rider Contact';
    document.getElementById('btn-save-rider').textContent = 'Save Rider Contact';
    this.openModal('modal-rider');
  }

  async editRiderModal(riderId) {
    const rider = await window.wrsmsDB.getById('Delivery_Riders', riderId);
    if (!rider) return;

    this.riderAddedFromDispatch = false;
    document.getElementById('rider-id').value = rider.rider_id;
    document.getElementById('rider-name').value = rider.full_name;
    document.getElementById('rider-phone').value = rider.phone || '';
    document.getElementById('rider-notes').value = rider.notes || '';
    document.getElementById('rider-active').value = rider.is_active ? '1' : '0';
    document.getElementById('modal-rider-title').textContent = 'Edit Delivery Rider Contact';
    document.getElementById('btn-save-rider').textContent = 'Update Rider Contact';
    this.openModal('modal-rider');
  }

  async saveRider() {
    const riderId = document.getElementById('rider-id').value;
    const fullName = document.getElementById('rider-name').value.trim();
    const phone = document.getElementById('rider-phone').value.trim();
    const notes = document.getElementById('rider-notes').value.trim();
    const isActive = Number(document.getElementById('rider-active').value);

    if (!fullName || !phone) {
      this.showToast('Rider full name and contact phone number are required.', 'danger');
      return;
    }

    let savedRiderId = null;
    if (riderId) {
      await window.wrsmsDB.update('Delivery_Riders', Number(riderId), {
        full_name: fullName,
        phone,
        notes,
        is_active: isActive
      });
      savedRiderId = Number(riderId);
      await window.wrsmsDB.logAudit('RIDER_UPDATED', 'Delivery_Riders', fullName, `Rider profile updated (${phone})`);
      this.showToast('Delivery rider contact updated.', 'success');
    } else {
      const rec = await window.wrsmsDB.insert('Delivery_Riders', {
        full_name: fullName,
        phone,
        notes,
        is_active: isActive
      });
      savedRiderId = rec.rider_id;
      await window.wrsmsDB.logAudit('RIDER_CREATED', 'Delivery_Riders', fullName, `New delivery rider added (${phone})`);
      this.showToast('New delivery rider registered.', 'success');
    }

    this.closeModal('modal-rider');
    await this.renderDeliveryView();

    // If trip modal is active, update dropdown
    const tripRiderSelect = document.getElementById('trip-rider-select');
    if (tripRiderSelect) {
      const riders = await window.wrsmsDB.getAll('Delivery_Riders');
      tripRiderSelect.innerHTML = riders.filter(r => r.is_active).map(r => `
        <option value="${r.rider_id}">${r.full_name}</option>
      `).join('');
      if (savedRiderId) {
        tripRiderSelect.value = String(savedRiderId);
      }
    }
  }

  deleteRider(riderId) {
    this.openConfirmation(
      'Delete Delivery Rider Contact',
      'Are you sure you want to delete this delivery rider contact record? This will be recorded in the system audit trail.',
      true,
      async (reason) => {
        const rider = await window.wrsmsDB.getById('Delivery_Riders', riderId);
        await window.wrsmsDB.delete('Delivery_Riders', riderId);
        await window.wrsmsDB.logAudit(
          'RIDER_DELETED',
          'Delivery_Riders',
          rider ? rider.full_name : String(riderId),
          `Delivery rider deleted. Reason: ${reason || 'Admin deletion'}`
        );
        this.showToast('Delivery rider contact deleted.', 'info');
        await this.renderDeliveryView();

        const tripRiderSelect = document.getElementById('trip-rider-select');
        if (tripRiderSelect) {
          const riders = await window.wrsmsDB.getAll('Delivery_Riders');
          tripRiderSelect.innerHTML = riders.filter(r => r.is_active).map(r => `
            <option value="${r.rider_id}">${r.full_name}</option>
          `).join('');
        }
      }
    );
  }

  // Create Delivery Trip Batch Modal (FR-DEL-02)
  async openCreateTripModal() {
    const riders = await window.wrsmsDB.getAll('Delivery_Riders');
    const orders = await window.wrsmsDB.getAll('Orders');
    const customers = await window.wrsmsDB.getAll('Customers');

    const riderSel = document.getElementById('trip-rider-select');
    riderSel.innerHTML = riders.filter(r => r.is_active).map(r => `
      <option value="${r.rider_id}">${r.full_name}</option>
    `).join('');

    // Eligible Delivery Orders (Pending / Preparing)
    const eligibleOrders = orders.filter(o => o.order_type === 'Delivery' && (o.order_status === 'Pending' || o.order_status === 'Preparing'));

    const list = document.getElementById('trip-orders-selector-list');
    if (eligibleOrders.length === 0) {
      list.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No pending delivery orders available for dispatch.</div>';
    } else {
      list.innerHTML = eligibleOrders.map(o => {
        let custName = 'Walk-In Guest';
        let addr = '';
        let phone = '';
        if (o.customer_id) {
          const c = customers.find(x => x.customer_id === o.customer_id);
          if (c) {
            custName = c.full_name;
            addr = `${c.address} (${c.landmark || 'No landmark'})`;
            phone = c.phone ? ` &bull; 📞 ${c.phone}` : '';
          }
        }
        return `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border-color);">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px; cursor: pointer;">
              <input type="checkbox" class="trip-order-checkbox" value="${o.order_id}" data-total="${o.total_amount}">
              <span><strong>${o.order_number}</strong> &bull; 👤 ${custName}${phone} &bull; <small style="color: var(--text-muted);">${addr}</small></span>
            </label>
            <strong>${Currency.formatPHP(o.total_amount)}</strong>
          </div>
        `;
      }).join('');
    }

    this.openModal('modal-trip-create');
  }

  async submitCreateTrip() {
    const riderId = Number(document.getElementById('trip-rider-select').value);
    const notes = document.getElementById('trip-notes').value.trim() || 'Standard route trip dispatch';

    const checkedBoxes = document.querySelectorAll('.trip-order-checkbox:checked');
    if (checkedBoxes.length === 0) {
      this.showToast('Please select at least one delivery order to dispatch.', 'warning');
      return;
    }

    let expectedCod = 0;
    const orderIds = [];
    checkedBoxes.forEach(cb => {
      orderIds.push(Number(cb.value));
      expectedCod += Number(cb.dataset.total) || 0;
    });

    // 1. Create Trip
    const trip = await window.wrsmsDB.insert('Delivery_Trips', {
      rider_id: riderId,
      dispatch_time: DateTimeUtil.nowISO(),
      return_time: null,
      expected_cod: expectedCod,
      actual_remittance: 0,
      variance: 0,
      trip_status: 'dispatched',
      notes: notes
    });

    // 2. Link Orders & Update Order Status
    for (const oid of orderIds) {
      await window.wrsmsDB.insert('Delivery_Trip_Orders', {
        trip_id: trip.trip_id,
        order_id: oid,
        delivery_result: 'dispatched',
        quantities_delivered: 0,
        empties_returned: 0,
        notes: ''
      });
      await window.wrsmsDB.update('Orders', oid, { order_status: 'Dispatched' });
    }

    await window.wrsmsDB.logAudit(
      'DELIVERY_DISPATCH',
      'Delivery_Trips',
      trip.trip_id,
      `Trip dispatched with ${orderIds.length} orders. Expected COD: ${Currency.formatPHP(expectedCod)}`
    );

    this.showToast(`Delivery Trip #${trip.trip_id} dispatched!`, 'success');
    this.closeModal('modal-trip-create');
    await this.renderDeliveryView();
    await this.renderDashboard();
  }

  // Print Trip Manifest (FR-DEL-03)
  async printTripManifest(tripId) {
    const trip = await window.wrsmsDB.getById('Delivery_Trips', tripId);
    if (!trip) return;

    const rider = await window.wrsmsDB.getById('Delivery_Riders', trip.rider_id);
    const tripOrders = await window.wrsmsDB.getAll('Delivery_Trip_Orders');
    const myTripOrders = tripOrders.filter(to => to.trip_id === trip.trip_id);

    const orders = await window.wrsmsDB.getAll('Orders');
    const customers = await window.wrsmsDB.getAll('Customers');

    let manifestRows = '';
    for (const to of myTripOrders) {
      const o = orders.find(x => x.order_id === to.order_id);
      if (!o) continue;
      const c = customers.find(x => x.customer_id === o.customer_id);

      manifestRows += `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>${c ? c.full_name : 'Guest'}</td>
          <td>${c ? `${c.address} (${c.landmark || ''})` : '-'}</td>
          <td>${c ? c.phone : '-'}</td>
          <td><strong>${Currency.formatPHP(o.total_amount)}</strong></td>
        </tr>
      `;
    }

    const container = document.getElementById('report-render-target');
    container.innerHTML = `
      <div style="background: white; padding: 24px; font-family: sans-serif;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="margin-bottom: 4px;">AQUA PURE WATER REFILLING STATION</h2>
          <h3 style="color: #0284c7; margin-bottom: 2px;">DELIVERY TRIP MANIFEST (FR-DEL-03)</h3>
          <p style="font-size: 13px; color: var(--text-muted);">Trip ID: #${trip.trip_id} &bull; Dispatch: ${DateTimeUtil.formatDateTime(trip.dispatch_time)}</p>
          <p style="font-size: 13px;"><strong>Assigned Rider:</strong> ${rider ? rider.full_name : 'Rider'}</p>
        </div>
        <table class="data-table" style="margin-bottom: 20px;">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Customer</th>
              <th>Address &amp; Landmark</th>
              <th>Phone</th>
              <th>COD Due</th>
            </tr>
          </thead>
          <tbody>
            ${manifestRows}
          </tbody>
        </table>
        <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; padding: 12px; background: #f8fafc; border: 1px solid var(--border-color);">
          <span>Total Expected COD Remittance:</span>
          <span>${Currency.formatPHP(trip.expected_cod)}</span>
        </div>
        <div style="margin-top: 40px; display: flex; justify-content: space-between; font-size: 12px;">
          <div>Rider Signature: _______________________</div>
          <div>Admin Dispatcher Signature: _______________________</div>
        </div>
      </div>
    `;

    this.switchView('reports');
    window.print();
  }

  // Reconcile Delivery Trip (FR-DEL-06, FR-DEL-07, FR-DEL-08)
  async openReconcileTripModal(tripId) {
    const trip = await window.wrsmsDB.getById('Delivery_Trips', tripId);
    if (!trip) return;

    const rider = await window.wrsmsDB.getById('Delivery_Riders', trip.rider_id);

    document.getElementById('recon-trip-id').value = trip.trip_id;
    document.getElementById('recon-rider-name').value = rider ? rider.full_name : 'Rider';
    document.getElementById('recon-expected-cod').value = Currency.formatPHP(trip.expected_cod);
    document.getElementById('recon-actual-remit').value = Currency.toPesos(trip.expected_cod).toFixed(2);
    document.getElementById('recon-variance').value = '₱0.00 (Balanced)';
    document.getElementById('recon-empties').value = '0';
    document.getElementById('recon-notes').value = '';

    // Calculate variance on input change
    const actualInput = document.getElementById('recon-actual-remit');
    actualInput.oninput = () => {
      const act = Currency.toCentavos(Number(actualInput.value) || 0);
      const diff = act - trip.expected_cod;
      const vEl = document.getElementById('recon-variance');
      if (diff === 0) {
        vEl.value = '₱0.00 (Balanced)';
        vEl.style.color = 'var(--success)';
      } else if (diff > 0) {
        vEl.value = `+${Currency.formatPHP(diff)} (Over)`;
        vEl.style.color = 'var(--info)';
      } else {
        vEl.value = `${Currency.formatPHP(diff)} (Short)`;
        vEl.style.color = 'var(--danger)';
      }
    };

    this.openModal('modal-trip-reconcile');
  }

  async submitReconcileTrip() {
    const tripId = Number(document.getElementById('recon-trip-id').value);
    const actualRemitPesos = Number(document.getElementById('recon-actual-remit').value);
    const emptiesReturned = Number(document.getElementById('recon-empties').value) || 0;
    const notes = document.getElementById('recon-notes').value.trim();

    if (isNaN(actualRemitPesos) || actualRemitPesos < 0) {
      this.showToast('Please enter a valid remitted cash amount.', 'danger');
      return;
    }

    const trip = await window.wrsmsDB.getById('Delivery_Trips', tripId);
    if (!trip) return;

    const actualRemitCentavos = Currency.toCentavos(actualRemitPesos);
    const variance = actualRemitCentavos - trip.expected_cod;

    // 1. Update Trip Record
    await window.wrsmsDB.update('Delivery_Trips', tripId, {
      return_time: DateTimeUtil.nowISO(),
      actual_remittance: actualRemitCentavos,
      variance: variance,
      trip_status: 'reconciled',
      notes: notes
    });

    // 2. Mark Linked Orders Completed & Insert COD Cash Payment (FR-DEL-08)
    const tripOrders = await window.wrsmsDB.getAll('Delivery_Trip_Orders');
    const myTripOrders = tripOrders.filter(to => to.trip_id === tripId);

    for (const to of myTripOrders) {
      await window.wrsmsDB.update('Delivery_Trip_Orders', to.trip_order_id, {
        delivery_result: 'delivered'
      });
      await window.wrsmsDB.update('Orders', to.order_id, {
        order_status: 'Completed',
        payment_status: 'Paid'
      });

      // Record cash received from rider remittance
      const order = await window.wrsmsDB.getById('Orders', to.order_id);
      if (order) {
        await window.wrsmsDB.insert('Payments', {
          order_id: order.order_id,
          customer_id: order.customer_id,
          transaction_type: 'delivery_cod',
          amount: order.total_amount,
          cash_tendered: order.total_amount,
          change_due: 0,
          received_at: DateTimeUtil.nowISO(),
          reference_note: `COD remitted by rider for Trip #${tripId}`
        });
      }
    }

    // 3. Record returned empty containers
    if (emptiesReturned > 0) {
      await window.wrsmsDB.insert('Inventory_Movements', {
        product_id: 1, // baseline refill
        movement_type: 'empty_return',
        quantity: emptiesReturned,
        related_order_id: null,
        reason: `Empty containers returned from Delivery Trip #${tripId}`,
        created_at: DateTimeUtil.nowISO(),
        admin_id: 1
      });
    }

    await window.wrsmsDB.logAudit(
      'DELIVERY_RECONCILE',
      'Delivery_Trips',
      tripId,
      `Trip reconciled: Expected COD: ${Currency.formatPHP(trip.expected_cod)}, Actual Remitted: ${Currency.formatPHP(actualRemitCentavos)}, Variance: ${Currency.formatPHP(variance)}`
    );

    this.showToast(`Trip #${tripId} reconciled and COD cash accepted into station drawer!`, 'success');
    this.closeModal('modal-trip-reconcile');
    await this.renderDeliveryView();
    await this.renderCashView();
    await this.renderDashboard();
  }

  // =========================================================================
  // 9. CASH DRAWER & DAILY CLOSING (Z-READING) (FR-CASH)
  // =========================================================================
  async renderCashView() {
    const todayStr = DateTimeUtil.todayDateStr();
    const payments = await window.wrsmsDB.getAll('Payments');
    const expenses = await window.wrsmsDB.getAll('Expenses');
    const closings = await window.wrsmsDB.getAll('Cash_Closings');

    // Filter today's physical cash inflows using robust date comparison
    const todayPayments = payments.filter(p => p.received_at && DateTimeUtil.toDateOnlyStr(p.received_at) === todayStr);

    let counterCash = 0;
    let riderCod = 0;
    let collections = 0;
    let deposits = 0;

    for (const p of todayPayments) {
      if (p.transaction_type === 'cash_sale') counterCash += Number(p.amount) || 0;
      else if (p.transaction_type === 'delivery_cod') riderCod += Number(p.amount) || 0;
      else if (p.transaction_type === 'account_collection') collections += Number(p.amount) || 0;
      else if (p.transaction_type === 'container_deposit') deposits += Number(p.amount) || 0;
    }

    // Drawer Expenses for today
    const todayExpenses = expenses.filter(e => {
      const isToday = e.expense_date && DateTimeUtil.toDateOnlyStr(e.expense_date) === todayStr;
      const isDrawer = Boolean(Number(e.paid_from_drawer) || e.paid_from_drawer === true || e.paid_from_drawer === 'true');
      return isToday && isDrawer;
    });

    let drawerExp = 0;
    for (const e of todayExpenses) {
      drawerExp += Number(e.amount) || 0;
    }

    document.getElementById('cash-reg-receipts').textContent = Currency.formatPHP(counterCash);
    document.getElementById('cash-reg-cod').textContent = Currency.formatPHP(riderCod);
    document.getElementById('cash-reg-collections').textContent = Currency.formatPHP(collections);
    document.getElementById('cash-reg-deposits').textContent = Currency.formatPHP(deposits);
    document.getElementById('cash-reg-expenses').textContent = Currency.formatPHP(drawerExp);

    // Expenses Table with CRUD Actions
    const expTbody = document.getElementById('expenses-table-body');
    expTbody.innerHTML = [...expenses].reverse().map(e => {
      const isDrawer = Boolean(Number(e.paid_from_drawer) || e.paid_from_drawer === true || e.paid_from_drawer === 'true');
      return `
        <tr>
          <td>${DateTimeUtil.formatDate(e.expense_date)}</td>
          <td><span class="badge badge-neutral">${e.category}</span></td>
          <td>${e.description}</td>
          <td>${isDrawer ? '<span class="badge badge-warning">Drawer Paid</span>' : '<span class="badge badge-neutral">Other</span>'}</td>
          <td><strong style="color: #dc2626;">-${Currency.formatPHP(e.amount)}</strong></td>
          <td>
            <div style="display: flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.editExpenseModal(${e.expense_id})">Edit</button>
              <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteExpense(${e.expense_id})">Delete</button>
            </div>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No expenses recorded.</td></tr>';

    // Closings Archive with CRUD Actions
    const closingsTbody = document.getElementById('closings-table-body');
    closingsTbody.innerHTML = [...closings].reverse().map(c => `
      <tr>
        <td><strong>${DateTimeUtil.formatDate(c.business_date)}</strong></td>
        <td>${Currency.formatPHP(c.opening_float)}</td>
        <td>${Currency.formatPHP(c.cash_receipts + c.accepted_rider_remittance + c.account_collections + c.deposits)}</td>
        <td>${Currency.formatPHP(c.drawer_expenses + (c.cash_refunds || 0))}</td>
        <td><strong>${Currency.formatPHP(c.expected_cash)}</strong></td>
        <td><strong>${Currency.formatPHP(c.actual_cash)}</strong></td>
        <td>
          <span class="badge ${c.variance === 0 ? 'badge-success' : c.variance > 0 ? 'badge-info' : 'badge-danger'}">
            ${c.variance === 0 ? 'Exact' : c.variance > 0 ? `+${Currency.formatPHP(c.variance)} (Over)` : `${Currency.formatPHP(c.variance)} (Short)`}
          </span>
        </td>
        <td>${DateTimeUtil.formatDateTime(c.closed_at)}</td>
        <td>
          <div style="display: flex; gap: 6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.wrsmsApp.printZReading(${c.closing_id})">Print Z-Slip</button>
            <button class="btn btn-primary btn-sm" onclick="window.wrsmsApp.editClosingModal(${c.closing_id})">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window.wrsmsApp.deleteClosing(${c.closing_id})">Delete</button>
          </div>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="9" style="text-align: center; color: var(--text-muted);">No daily closings recorded yet.</td></tr>';
  }

  // Operating Expense CRUD (FR-CASH-05)
  openExpenseModal() {
    document.getElementById('exp-id').value = '';
    document.getElementById('exp-date').value = DateTimeUtil.todayDateStr();
    document.getElementById('exp-category').value = 'Supplies';
    document.getElementById('exp-amount').value = '';
    document.getElementById('exp-desc').value = '';
    document.getElementById('exp-drawer').checked = true;
    document.getElementById('modal-expense-title').textContent = 'Record Station Expense (FR-CASH-05)';
    document.getElementById('btn-submit-expense').textContent = 'Save Expense Record';
    this.openModal('modal-expense');
  }

  async editExpenseModal(expenseId) {
    const expense = await window.wrsmsDB.getById('Expenses', expenseId);
    if (!expense) return;

    document.getElementById('exp-id').value = expense.expense_id;
    document.getElementById('exp-date').value = DateTimeUtil.toDateOnlyStr(expense.expense_date) || DateTimeUtil.todayDateStr();
    document.getElementById('exp-category').value = expense.category;
    document.getElementById('exp-amount').value = Currency.toPesos(expense.amount).toFixed(2);
    document.getElementById('exp-desc').value = expense.description || '';
    document.getElementById('exp-drawer').checked = Boolean(Number(expense.paid_from_drawer) || expense.paid_from_drawer === true || expense.paid_from_drawer === 'true');
    document.getElementById('modal-expense-title').textContent = 'Edit Station Expense (FR-CASH-05)';
    document.getElementById('btn-submit-expense').textContent = 'Update Expense Record';
    this.openModal('modal-expense');
  }

  async saveExpense() {
    const expId = document.getElementById('exp-id').value;
    const category = document.getElementById('exp-category').value;
    const amountPesos = Number(document.getElementById('exp-amount').value);
    const desc = document.getElementById('exp-desc').value.trim();
    const expDate = document.getElementById('exp-date').value || DateTimeUtil.todayDateStr();
    const paidFromDrawer = document.getElementById('exp-drawer').checked ? 1 : 0;

    if (isNaN(amountPesos) || amountPesos <= 0 || !desc) {
      this.showToast('Please enter a valid expense description and positive amount.', 'danger');
      return;
    }

    const amountCentavos = Currency.toCentavos(amountPesos);

    if (expId) {
      await window.wrsmsDB.update('Expenses', Number(expId), {
        category,
        amount: amountCentavos,
        description: desc,
        expense_date: expDate,
        paid_from_drawer: paidFromDrawer
      });

      await window.wrsmsDB.logAudit(
        'EXPENSE_UPDATED',
        'Expenses',
        category,
        `Station expense updated: ${Currency.formatPHP(amountCentavos)} (${desc})`
      );

      this.showToast('Operating expense updated.', 'success');
    } else {
      await window.wrsmsDB.insert('Expenses', {
        category,
        amount: amountCentavos,
        description: desc,
        expense_date: expDate,
        paid_from_drawer: paidFromDrawer,
        admin_id: 1
      });

      await window.wrsmsDB.logAudit(
        'EXPENSE_RECORD',
        'Expenses',
        category,
        `Station expense recorded: ${Currency.formatPHP(amountCentavos)} (${desc})`
      );

      this.showToast('Operating expense recorded.', 'success');
    }

    this.closeModal('modal-expense');
    await this.renderCashView();
  }

  deleteExpense(expenseId) {
    this.openConfirmation(
      'Delete Operating Expense',
      'Are you sure you want to delete this expense record? This will adjust drawer cash calculations.',
      true,
      async (reason) => {
        const exp = await window.wrsmsDB.getById('Expenses', expenseId);
        await window.wrsmsDB.delete('Expenses', expenseId);
        await window.wrsmsDB.logAudit(
          'EXPENSE_DELETED',
          'Expenses',
          exp ? exp.category : String(expenseId),
          `Operating expense deleted: ${exp ? Currency.formatPHP(exp.amount) : ''}. Reason: ${reason || 'Admin deletion'}`
        );
        this.showToast('Operating expense deleted.', 'info');
        await this.renderCashView();
      }
    );
  }

  // Daily Closing / Z-Reading CRUD (FR-CASH-06, FR-CASH-07, FR-CASH-08)
  async openClosingModal() {
    const todayStr = DateTimeUtil.todayDateStr();
    document.getElementById('close-id').value = '';
    document.getElementById('close-date').value = todayStr;
    document.getElementById('close-float').value = '1000.00';
    document.getElementById('close-actual').value = '';
    document.getElementById('modal-closing-title').textContent = 'Perform Daily Cash Closing / Z-Reading';
    document.getElementById('btn-submit-daily-closing').textContent = 'Finalize & Save Daily Closing';

    await this.recalcClosingModalValues();

    const floatInput = document.getElementById('close-float');
    const actualInput = document.getElementById('close-actual');
    const dateInput = document.getElementById('close-date');

    floatInput.oninput = () => this.recalcClosingModalValues();
    actualInput.oninput = () => this.recalcClosingModalValues();
    dateInput.onchange = () => this.recalcClosingModalValues();
    dateInput.oninput = () => this.recalcClosingModalValues();

    this.openModal('modal-closing');
  }

  async editClosingModal(closingId) {
    const closing = await window.wrsmsDB.getById('Cash_Closings', closingId);
    if (!closing) return;

    document.getElementById('close-id').value = closing.closing_id;
    document.getElementById('close-date').value = closing.business_date;
    document.getElementById('close-float').value = Currency.toPesos(closing.opening_float).toFixed(2);
    document.getElementById('close-actual').value = Currency.toPesos(closing.actual_cash).toFixed(2);
    document.getElementById('modal-closing-title').textContent = 'Edit Daily Cash Closing / Z-Reading';
    document.getElementById('btn-submit-daily-closing').textContent = 'Update Daily Closing';

    await this.recalcClosingModalValues();

    const floatInput = document.getElementById('close-float');
    const actualInput = document.getElementById('close-actual');
    const dateInput = document.getElementById('close-date');

    floatInput.oninput = () => this.recalcClosingModalValues();
    actualInput.oninput = () => this.recalcClosingModalValues();
    dateInput.onchange = () => this.recalcClosingModalValues();
    dateInput.oninput = () => this.recalcClosingModalValues();

    this.openModal('modal-closing');
  }

  async recalcClosingModalValues() {
    const businessDate = document.getElementById('close-date').value || DateTimeUtil.todayDateStr();
    const floatPesos = Number(document.getElementById('close-float').value) || 0;
    const floatCentavos = Currency.toCentavos(floatPesos);

    const payments = await window.wrsmsDB.getAll('Payments');
    const expenses = await window.wrsmsDB.getAll('Expenses');

    const dayPayments = payments.filter(p => p.received_at && DateTimeUtil.toDateOnlyStr(p.received_at) === businessDate);
    let counterCash = 0;
    let riderRemit = 0;
    let collections = 0;
    let deposits = 0;
    let refunds = 0;

    for (const p of dayPayments) {
      if (p.transaction_type === 'cash_sale') counterCash += Number(p.amount) || 0;
      else if (p.transaction_type === 'delivery_cod') riderRemit += Number(p.amount) || 0;
      else if (p.transaction_type === 'account_collection') collections += Number(p.amount) || 0;
      else if (p.transaction_type === 'container_deposit') deposits += Number(p.amount) || 0;
      else if (p.transaction_type === 'deposit_refund') refunds += Number(p.amount) || 0;
    }

    // Get all expenses recorded for the selected business date
    const dayExpensesAll = expenses.filter(e => e.expense_date && DateTimeUtil.toDateOnlyStr(e.expense_date) === businessDate);
    let drawerExp = 0;
    for (const e of dayExpensesAll) {
      const isDrawer = Boolean(Number(e.paid_from_drawer) || e.paid_from_drawer === true || e.paid_from_drawer === 'true');
      if (isDrawer) {
        drawerExp += Number(e.amount) || 0;
      }
    }

    // Render detailed expense breakdown in modal to make expense connectivity 100% visible
    const countBadge = document.getElementById('close-expenses-count-badge');
    const breakdownList = document.getElementById('close-expenses-breakdown-list');
    if (countBadge && breakdownList) {
      countBadge.textContent = `${dayExpensesAll.length} item(s)`;
      if (dayExpensesAll.length === 0) {
        breakdownList.innerHTML = `<div style="color: var(--text-muted); padding: 6px 0; text-align: center;">No operating expenses recorded for this business date.</div>`;
      } else {
        breakdownList.innerHTML = dayExpensesAll.map(e => {
          const isDrawer = Boolean(Number(e.paid_from_drawer) || e.paid_from_drawer === true || e.paid_from_drawer === 'true');
          return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--border-color);">
              <div>
                <strong>${e.category}</strong>: ${e.description}
                <span class="badge ${isDrawer ? 'badge-warning' : 'badge-neutral'}" style="font-size: 10.5px; margin-left: 6px;">
                  ${isDrawer ? 'Deducted from Drawer' : 'Non-Drawer'}
                </span>
              </div>
              <strong style="color: ${isDrawer ? '#dc2626' : 'var(--text-main)'};">-${Currency.formatPHP(e.amount)}</strong>
            </div>
          `;
        }).join('');
      }
    }

    // Formula (FR-CASH-06)
    const expectedCashCentavos = floatCentavos + counterCash + riderRemit + collections + deposits - refunds - drawerExp;

    document.getElementById('close-disp-receipts').textContent = Currency.formatPHP(counterCash);
    document.getElementById('close-disp-cod').textContent = Currency.formatPHP(riderRemit);
    document.getElementById('close-disp-colls').textContent = Currency.formatPHP(collections);
    document.getElementById('close-disp-deposits').textContent = Currency.formatPHP(deposits);
    document.getElementById('close-disp-refunds').textContent = Currency.formatPHP(refunds);
    document.getElementById('close-disp-expenses').textContent = Currency.formatPHP(drawerExp);
    document.getElementById('close-disp-expected').textContent = Currency.formatPHP(expectedCashCentavos);

    const actualPesos = Number(document.getElementById('close-actual').value) || 0;
    const actualCentavos = Currency.toCentavos(actualPesos);
    const variance = actualCentavos - expectedCashCentavos;

    const varEl = document.getElementById('close-variance');
    if (variance === 0) {
      varEl.value = '₱0.00 (Exact Balance)';
      varEl.style.color = 'var(--success)';
    } else if (variance > 0) {
      varEl.value = `+${Currency.formatPHP(variance)} (Cash Over)`;
      varEl.style.color = 'var(--info)';
    } else {
      varEl.value = `${Currency.formatPHP(variance)} (Cash Short)`;
      varEl.style.color = 'var(--danger)';
    }

    return {
      opening_float: floatCentavos,
      cash_receipts: counterCash,
      accepted_rider_remittance: riderRemit,
      account_collections: collections,
      deposits,
      cash_refunds: refunds,
      drawer_expenses: drawerExp,
      expected_cash: expectedCashCentavos,
      actual_cash: actualCentavos,
      variance
    };
  }

  async finalizeDailyClosing() {
    const calc = await this.recalcClosingModalValues();
    const businessDate = document.getElementById('close-date').value;
    const closeId = document.getElementById('close-id').value;

    if (closeId) {
      // Update existing record
      await window.wrsmsDB.update('Cash_Closings', Number(closeId), {
        business_date: businessDate,
        opening_float: calc.opening_float,
        cash_receipts: calc.cash_receipts,
        accepted_rider_remittance: calc.accepted_rider_remittance,
        account_collections: calc.account_collections,
        deposits: calc.deposits,
        cash_refunds: calc.cash_refunds,
        drawer_expenses: calc.drawer_expenses,
        expected_cash: calc.expected_cash,
        actual_cash: calc.actual_cash,
        variance: calc.variance,
        closed_at: DateTimeUtil.nowISO()
      });

      await window.wrsmsDB.logAudit(
        'CLOSING_UPDATED',
        'Cash_Closings',
        businessDate,
        `Z-Reading daily cash closing updated. Expected: ${Currency.formatPHP(calc.expected_cash)}, Counted: ${Currency.formatPHP(calc.actual_cash)}, Variance: ${Currency.formatPHP(calc.variance)}`
      );

      this.showToast(`Daily closing for ${businessDate} updated successfully!`, 'success');
      this.closeModal('modal-closing');
      await this.renderCashView();
      this.printZReading(Number(closeId));
      return;
    }

    const closings = await window.wrsmsDB.getAll('Cash_Closings');
    const existing = closings.find(c => c.business_date === businessDate);

    if (existing) {
      const proceed = confirm(`A daily closing already exists for ${businessDate}. Overwriting a finalized closing is logged to the system audit trail (FR-CASH-08). Proceed?`);
      if (!proceed) return;
    }

    const record = await window.wrsmsDB.insert('Cash_Closings', {
      business_date: businessDate,
      opening_float: calc.opening_float,
      cash_receipts: calc.cash_receipts,
      accepted_rider_remittance: calc.accepted_rider_remittance,
      account_collections: calc.account_collections,
      deposits: calc.deposits,
      cash_refunds: calc.cash_refunds,
      drawer_expenses: calc.drawer_expenses,
      expected_cash: calc.expected_cash,
      actual_cash: calc.actual_cash,
      variance: calc.variance,
      closed_at: DateTimeUtil.nowISO()
    });

    await window.wrsmsDB.logAudit(
      'CLOSING_FINALIZED',
      'Cash_Closings',
      businessDate,
      `Z-Reading daily cash closing finalized. Expected: ${Currency.formatPHP(calc.expected_cash)}, Counted: ${Currency.formatPHP(calc.actual_cash)}, Variance: ${Currency.formatPHP(calc.variance)}`
    );

    this.showToast(`Daily closing for ${businessDate} saved successfully!`, 'success');
    this.closeModal('modal-closing');
    await this.renderCashView();
    this.printZReading(record.closing_id);
  }

  deleteClosing(closingId) {
    this.openConfirmation(
      'Delete Daily Cash Closing Record',
      'Are you sure you want to delete this Daily Cash Closing record? This action will be recorded in the system audit trail.',
      true,
      async (reason) => {
        const closing = await window.wrsmsDB.getById('Cash_Closings', closingId);
        await window.wrsmsDB.delete('Cash_Closings', closingId);
        await window.wrsmsDB.logAudit(
          'CLOSING_DELETED',
          'Cash_Closings',
          closing ? closing.business_date : String(closingId),
          `Daily closing record deleted. Reason: ${reason || 'Admin deletion'}`
        );
        this.showToast('Daily closing record deleted.', 'info');
        await this.renderCashView();
      }
    );
  }

  // Print Z-Reading Slip (FR-CASH-07)
  async printZReading(closingId) {
    const closing = await window.wrsmsDB.getById('Cash_Closings', closingId);
    if (!closing) return;

    const container = document.getElementById('z-slip-print-container');
    if (!container) return;

    container.innerHTML = `
      <div class="receipt-paper" style="max-width: 420px; font-size: 13px;">
        <div class="receipt-center">
          <h2 style="font-size: 17px; font-weight: bold;">AQUA PURE WATER REFILLING</h2>
          <p style="font-size: 13px; font-weight: bold; margin: 4px 0;">DAILY CASH CLOSING / Z-READING</p>
          <p style="font-size: 11px;">Business Date: ${DateTimeUtil.formatDate(closing.business_date)}</p>
          <p style="font-size: 11px;">Closed At: ${DateTimeUtil.formatDateTime(closing.closed_at)}</p>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-row">
          <span>Opening Cash Float:</span>
          <strong>${Currency.formatPHP(closing.opening_float)}</strong>
        </div>
        <div class="receipt-divider"></div>
        <div style="font-weight: bold; margin-bottom: 4px;">PHYSICAL CASH INFLOWS:</div>
        <div class="receipt-row">
          <span>(+) Counter Cash Sales:</span>
          <span>${Currency.formatPHP(closing.cash_receipts)}</span>
        </div>
        <div class="receipt-row">
          <span>(+) Accepted Rider Remittance:</span>
          <span>${Currency.formatPHP(closing.accepted_rider_remittance)}</span>
        </div>
        <div class="receipt-row">
          <span>(+) Account Collections (Ledger Paid):</span>
          <span>${Currency.formatPHP(closing.account_collections)}</span>
        </div>
        <div class="receipt-row">
          <span>(+) Container Deposits:</span>
          <span>${Currency.formatPHP(closing.deposits)}</span>
        </div>
        <div class="receipt-divider"></div>
        <div style="font-weight: bold; margin-bottom: 4px;">CASH OUTFLOWS:</div>
        <div class="receipt-row" style="color: #dc2626;">
          <span>(-) Cash Refunds:</span>
          <span>${Currency.formatPHP(closing.cash_refunds || 0)}</span>
        </div>
        <div class="receipt-row" style="color: #dc2626;">
          <span>(-) Drawer Expenses:</span>
          <span>${Currency.formatPHP(closing.drawer_expenses)}</span>
        </div>
        <div class="receipt-divider"></div>
        <div class="receipt-row" style="font-size: 14px; font-weight: bold;">
          <span>EXPECTED CASH:</span>
          <span>${Currency.formatPHP(closing.expected_cash)}</span>
        </div>
        <div class="receipt-row" style="font-size: 14px; font-weight: bold;">
          <span>ACTUAL COUNTED CASH:</span>
          <span>${Currency.formatPHP(closing.actual_cash)}</span>
        </div>
        <div class="receipt-row" style="font-size: 14px; font-weight: bold; margin-top: 4px;">
          <span>CASH VARIANCE:</span>
          <span style="color: ${closing.variance === 0 ? 'var(--success)' : closing.variance > 0 ? 'var(--info)' : 'var(--danger)'};">
            ${closing.variance === 0 ? 'EXACT (₱0.00)' : closing.variance > 0 ? `+${Currency.formatPHP(closing.variance)} (OVER)` : `${Currency.formatPHP(closing.variance)} (SHORT)`}
          </span>
        </div>
        <div class="receipt-divider"></div>
        <div style="font-size: 11px; margin-top: 15px;">
          <p>Station Administrator: _____________________</p>
          <p style="margin-top: 8px;">Station Owner Verified: _____________________</p>
        </div>
      </div>
    `;

    this.openModal('modal-z-slip');
  }

  // =========================================================================
  // 10. OPERATIONAL & FINANCIAL REPORTS (FR-REP)
  // =========================================================================
  async initReportsView() {
    const today = DateTimeUtil.todayDateStr();
    document.getElementById('report-start-date').value = today;
    document.getElementById('report-end-date').value = today;
    await this.generateReport();
  }

  async generateReport() {
    const reportType = document.getElementById('report-type-select').value;
    const startDate = document.getElementById('report-start-date').value;
    const endDate = document.getElementById('report-end-date').value;

    const target = document.getElementById('report-render-target');
    target.innerHTML = `<div style="text-align: center; padding: 30px;">Generating ${reportType} report...</div>`;

    if (reportType === 'sales_summary') {
      await this.generateSalesSummaryReport(startDate, endDate);
    } else if (reportType === 'product_sales') {
      await this.generateProductSalesReport(startDate, endDate);
    } else if (reportType === 'customer_receivables') {
      await this.generateCustomerReceivablesReport();
    } else if (reportType === 'container_ledger') {
      await this.generateContainerLedgerReport();
    } else if (reportType === 'delivery_cod') {
      await this.generateDeliveryCodReport(startDate, endDate);
    } else if (reportType === 'expenses_report') {
      await this.generateExpensesReport(startDate, endDate);
    }
  }

  async generateSalesSummaryReport(startDate, endDate) {
    const orders = await window.wrsmsDB.getAll('Orders');
    const customers = await window.wrsmsDB.getAll('Customers');
    const payments = await window.wrsmsDB.getAll('Payments');

    const filteredOrders = orders.filter(o => {
      const d = DateTimeUtil.toDateOnlyStr(o.created_at);
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    });

    const periodPayments = payments.filter(p => {
      const d = p.received_at ? DateTimeUtil.toDateOnlyStr(p.received_at) : '';
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    });

    let totalCompleted = 0;
    let countWalkIn = 0;
    let countDelivery = 0;
    let totalGrossCreditSales = 0;

    for (const o of filteredOrders) {
      if (o.order_status === 'Completed') {
        totalCompleted += Number(o.total_amount) || 0;
        if (o.order_type === 'Walk-In') countWalkIn++;
        else countDelivery++;

        if (o.payment_status === 'On-Account') {
          totalGrossCreditSales += Number(o.total_amount) || 0;
        }
      }
    }

    // Cash Inflows Breakdown from Payments
    let counterCashSales = 0;
    let deliveryCodSales = 0;
    let accountCollections = 0;

    for (const p of periodPayments) {
      if (p.transaction_type === 'cash_sale') counterCashSales += Number(p.amount) || 0;
      else if (p.transaction_type === 'delivery_cod') deliveryCodSales += Number(p.amount) || 0;
      else if (p.transaction_type === 'account_collection') accountCollections += Number(p.amount) || 0;
    }

    const totalPhysicalCashInflow = counterCashSales + deliveryCodSales + accountCollections;
    const netOutstandingReceivables = Math.max(0, totalGrossCreditSales - accountCollections);

    // Build orders rows in reverse chronological order
    const displayOrders = [...filteredOrders].reverse();
    let rows = '';
    for (const o of displayOrders) {
      let cName = 'Walk-In Guest';
      if (o.customer_id) {
        const c = customers.find(x => x.customer_id === o.customer_id);
        if (c) cName = c.full_name;
      }

      const badgeClass = o.order_status === 'Completed' ? 'badge-success' :
        o.order_status === 'Cancelled' ? 'badge-danger' :
        o.order_status === 'Preparing' ? 'badge-warning' : 'badge-info';

      rows += `
        <tr>
          <td><strong>${o.order_number}</strong></td>
          <td>${DateTimeUtil.formatDateTime(o.created_at)}</td>
          <td><span class="badge badge-neutral">${o.order_type}</span></td>
          <td>${cName}</td>
          <td><span class="badge ${o.payment_status === 'Paid' ? 'badge-success' : 'badge-warning'}">${o.payment_status}</span></td>
          <td><strong>${Currency.formatPHP(o.total_amount)}</strong></td>
          <td><span class="badge ${badgeClass}">${o.order_status}</span></td>
        </tr>
      `;
    }

    // Build account collections breakdown rows
    const collectionPayments = periodPayments.filter(p => p.transaction_type === 'account_collection');
    let collectionSectionHtml = '';
    if (collectionPayments.length > 0) {
      const collRows = [...collectionPayments].reverse().map(cp => {
        const c = cp.customer_id ? customers.find(x => x.customer_id === cp.customer_id) : null;
        return `
          <tr>
            <td>${DateTimeUtil.formatDateTime(cp.received_at)}</td>
            <td><strong>${c ? c.full_name : 'Customer'}</strong></td>
            <td><strong style="color: var(--success);">${Currency.formatPHP(cp.amount)}</strong></td>
            <td>${cp.reference_note || 'Physical cash ledger settlement'}</td>
          </tr>
        `;
      }).join('');

      collectionSectionHtml = `
        <div style="margin-top: 24px; border-top: 1px dashed var(--border-color); padding-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h3 style="font-size: 15px; color: var(--primary-dark); margin: 0;">Customer Account Collections Received (Ledger Payments Settled)</h3>
            <span class="badge badge-success">${Currency.formatPHP(accountCollections)} collected</span>
          </div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Date / Time</th>
                <th>Customer Name</th>
                <th>Cash Amount Settled</th>
                <th>Payment Reference / Notes</th>
              </tr>
            </thead>
            <tbody>
              ${collRows}
            </tbody>
          </table>
        </div>
      `;
    }

    document.getElementById('report-render-target').innerHTML = `
      <div style="background: white; padding: 20px;">
        <div style="border-bottom: 2px solid var(--border-color); padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="font-size: 18px; color: var(--primary-dark);">Sales Summary Report (FR-REP-01)</h2>
          <p style="font-size: 13px; color: var(--text-muted);">Period: ${startDate || 'Start'} to ${endDate || 'Present'} &bull; Generated: ${DateTimeUtil.formatDateTime(new Date())}</p>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 12px; color: var(--text-muted);">Total Completed Sales</div>
            <strong style="font-size: 18px; color: var(--success);">${Currency.formatPHP(totalCompleted)}</strong>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Gross completed sales</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 12px; color: var(--text-muted);">Physical Cash Collected</div>
            <strong style="font-size: 18px; color: var(--primary);">${Currency.formatPHP(totalPhysicalCashInflow)}</strong>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Counter: ${Currency.formatPHP(counterCashSales)} &bull; COD: ${Currency.formatPHP(deliveryCodSales)} &bull; Collections: ${Currency.formatPHP(accountCollections)}</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 12px; color: var(--text-muted);">Net On-Account Receivables</div>
            <strong style="font-size: 18px; color: #d97706;">${Currency.formatPHP(netOutstandingReceivables)}</strong>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Charged: ${Currency.formatPHP(totalGrossCreditSales)} &bull; Paid: -${Currency.formatPHP(accountCollections)}</div>
          </div>
          <div style="background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-color);">
            <div style="font-size: 12px; color: var(--text-muted);">Walk-In vs Delivery</div>
            <strong style="font-size: 18px;">${countWalkIn} / ${countDelivery}</strong>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Orders dispatched/served</div>
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Order #</th>
              <th>Date / Time</th>
              <th>Type</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" style="text-align: center;">No orders in this period.</td></tr>'}
          </tbody>
        </table>
        ${collectionSectionHtml}
      </div>
    `;
  }

  async generateProductSalesReport(startDate, endDate) {
    const orderItems = await window.wrsmsDB.getAll('Order_Items');
    const orders = await window.wrsmsDB.getAll('Orders');
    const products = await window.wrsmsDB.getAll('Products');

    const completedOrderIds = new Set(
      orders.filter(o => {
        const d = DateTimeUtil.toDateOnlyStr(o.created_at);
        return o.order_status === 'Completed' && (!startDate || d >= startDate) && (!endDate || d <= endDate);
      }).map(o => o.order_id)
    );

    const stats = {};
    for (const oi of orderItems) {
      if (completedOrderIds.has(oi.order_id)) {
        if (!stats[oi.product_id]) {
          stats[oi.product_id] = { qty: 0, revenue: 0 };
        }
        stats[oi.product_id].qty += Number(oi.quantity) || 0;
        stats[oi.product_id].revenue += Number(oi.line_total) || 0;
      }
    }

    let rows = '';
    for (const p of products) {
      const s = stats[p.product_id] || { qty: 0, revenue: 0 };
      rows += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.category}</td>
          <td>${p.unit}</td>
          <td>${Currency.formatPHP(p.unit_price)}</td>
          <td><strong>${s.qty}</strong></td>
          <td><strong>${Currency.formatPHP(s.revenue)}</strong></td>
        </tr>
      `;
    }

    document.getElementById('report-render-target').innerHTML = `
      <div style="background: white; padding: 20px;">
        <h2 style="font-size: 18px; color: var(--primary-dark); margin-bottom: 6px;">Product Sales Performance (FR-REP-02)</h2>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Period: ${startDate} to ${endDate}</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Unit</th>
              <th>Active Price</th>
              <th>Units Sold</th>
              <th>Gross Revenue</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  async generateCustomerReceivablesReport() {
    const customers = await window.wrsmsDB.getAll('Customers');

    let totalDue = 0;
    let rows = '';
    for (const c of customers) {
      const bal = await window.wrsmsDB.getCustomerBalance(c.customer_id);
      if (bal > 0) totalDue += bal;
      rows += `
        <tr>
          <td><strong>${c.full_name}</strong></td>
          <td>${c.customer_type}</td>
          <td>${c.phone}</td>
          <td>${Currency.formatPHP(c.credit_limit)}</td>
          <td><strong style="color: ${bal > 0 ? '#dc2626' : 'var(--text-main)'};">${Currency.formatPHP(bal)}</strong></td>
        </tr>
      `;
    }

    document.getElementById('report-render-target').innerHTML = `
      <div style="background: white; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; color: var(--primary-dark);">Customer Receivables &amp; Aging (FR-REP-02)</h2>
            <p style="font-size: 13px; color: var(--text-muted);">Current outstanding balances approved on-account</p>
          </div>
          <div style="font-size: 16px; font-weight: bold; color: #dc2626;">
            Total Outstanding: ${Currency.formatPHP(totalDue)}
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Phone</th>
              <th>Approved Credit Limit</th>
              <th>Outstanding Receivables</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  async generateContainerLedgerReport() {
    const cStats = await window.wrsmsDB.getContainerStats();
    const customers = await window.wrsmsDB.getAll('Customers');

    let rows = '';
    for (const c of customers) {
      const held = await window.wrsmsDB.getCustomerContainerBalance(c.customer_id);
      if (held > 0) {
        rows += `
          <tr>
            <td><strong>${c.full_name}</strong></td>
            <td>${c.customer_type}</td>
            <td>${c.phone}</td>
            <td><strong>${held} units</strong></td>
          </tr>
        `;
      }
    }

    document.getElementById('report-render-target').innerHTML = `
      <div style="background: white; padding: 20px;">
        <h2 style="font-size: 18px; color: var(--primary-dark); margin-bottom: 16px;">Container Custody &amp; Balance Report (FR-REP-02)</h2>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px;">
          <div style="background: #f8fafc; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <div style="font-size: 12px; color: var(--text-muted);">Filled Units (Station)</div>
            <strong style="font-size: 20px; color: var(--success);">${cStats.filledAvailable}</strong>
          </div>
          <div style="background: #f8fafc; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <div style="font-size: 12px; color: var(--text-muted);">Empty Bottles (Station)</div>
            <strong style="font-size: 20px; color: var(--primary);">${cStats.emptyAtStation}</strong>
          </div>
          <div style="background: #f8fafc; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <div style="font-size: 12px; color: var(--text-muted);">Held by Customers</div>
            <strong style="font-size: 20px; color: var(--warning);">${cStats.customerHeld}</strong>
          </div>
          <div style="background: #f8fafc; padding: 12px; border: 1px solid var(--border-color); border-radius: var(--radius-sm);">
            <div style="font-size: 12px; color: var(--text-muted);">Damaged / Retired</div>
            <strong style="font-size: 20px; color: var(--danger);">${cStats.damagedLost}</strong>
          </div>
        </div>
        <h3 style="font-size: 15px; margin-bottom: 8px;">Customer Container Custody Breakdown</h3>
        <table class="data-table">
          <thead>
            <tr>
              <th>Customer Name</th>
              <th>Customer Type</th>
              <th>Contact Phone</th>
              <th>Reusable Containers Held</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="4" style="text-align: center;">No containers currently held by customers.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  async generateDeliveryCodReport(startDate, endDate) {
    const trips = await window.wrsmsDB.getAll('Delivery_Trips');
    const riders = await window.wrsmsDB.getAll('Delivery_Riders');

    const filtered = trips.filter(t => {
      const d = DateTimeUtil.toDateOnlyStr(t.dispatch_time);
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    });

    let totalExpected = 0;
    let totalRemitted = 0;

    let rows = filtered.map(t => {
      const rider = riders.find(r => r.rider_id === t.rider_id);
      totalExpected += Number(t.expected_cod) || 0;
      totalRemitted += Number(t.actual_remittance) || 0;
      return `
        <tr>
          <td>#${t.trip_id}</td>
          <td>${rider ? rider.full_name : 'Rider'}</td>
          <td>${DateTimeUtil.formatDateTime(t.dispatch_time)}</td>
          <td>${Currency.formatPHP(t.expected_cod)}</td>
          <td>${Currency.formatPHP(t.actual_remittance)}</td>
          <td>${Currency.formatPHP(t.variance)}</td>
          <td>${t.trip_status}</td>
        </tr>
      `;
    }).join('');

    document.getElementById('report-render-target').innerHTML = `
      <div style="background: white; padding: 20px;">
        <h2 style="font-size: 18px; color: var(--primary-dark); margin-bottom: 6px;">Delivery &amp; COD Remittance Summary (FR-REP-02)</h2>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">Period: ${startDate} to ${endDate}</p>
        <table class="data-table">
          <thead>
            <tr>
              <th>Trip #</th>
              <th>Rider</th>
              <th>Dispatched</th>
              <th>Expected COD</th>
              <th>Actual Remitted</th>
              <th>Variance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="7" style="text-align: center;">No trips recorded in this period.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  async generateExpensesReport(startDate, endDate) {
    const expenses = await window.wrsmsDB.getAll('Expenses');
    const filtered = expenses.filter(e => {
      const d = DateTimeUtil.toDateOnlyStr(e.expense_date);
      return (!startDate || d >= startDate) && (!endDate || d <= endDate);
    });

    let total = 0;
    let rows = filtered.map(e => {
      total += Number(e.amount) || 0;
      return `
        <tr>
          <td>${DateTimeUtil.formatDate(e.expense_date)}</td>
          <td>${e.category}</td>
          <td>${e.description}</td>
          <td>${e.paid_from_drawer ? 'Drawer Paid' : 'Other'}</td>
          <td><strong>${Currency.formatPHP(e.amount)}</strong></td>
        </tr>
      `;
    }).join('');

    document.getElementById('report-render-target').innerHTML = `
      <div style="background: white; padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="font-size: 18px; color: var(--primary-dark);">Station Expenses Report (FR-REP-02)</h2>
            <p style="font-size: 13px; color: var(--text-muted);">Period: ${startDate} to ${endDate}</p>
          </div>
          <div style="font-size: 16px; font-weight: bold; color: #dc2626;">
            Total Expenses: ${Currency.formatPHP(total)}
          </div>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Payment Source</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${rows || '<tr><td colspan="5" style="text-align: center;">No expenses recorded in this period.</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  }

  // Export CSV (Excel-Compatible Standard RFC 4180 with UTF-8 BOM) (FR-REP-05)
  exportCurrentReportCSV() {
    const table = document.querySelector('#report-render-target table');
    if (!table) {
      this.showToast('Please generate a report first.', 'warning');
      return;
    }

    let csv = '\uFEFF'; // UTF-8 BOM
    const rows = table.querySelectorAll('tr');

    rows.forEach(tr => {
      const cols = tr.querySelectorAll('th, td');
      const rowData = [];
      cols.forEach(c => {
        let text = c.innerText.replace(/"/g, '""').trim();
        rowData.push(`"${text}"`);
      });
      csv += rowData.join(',') + '\r\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `wrsms_report_${document.getElementById('report-type-select').value}_${DateTimeUtil.todayDateStr()}.csv`;
    link.click();
    this.showToast('Report CSV exported.', 'success');
  }

  // =========================================================================
  // 11. AUDIT LOGS CONTROLLER (FR-AUD-01, FR-AUD-02)
  // =========================================================================
  async renderAuditLogsTable() {
    const logs = await window.wrsmsDB.getAll('Audit_Logs');
    const filter = document.getElementById('audit-filter-action')?.value || 'all';

    let list = [...logs].reverse();
    if (filter !== 'all') {
      list = list.filter(l => l.action_type === filter);
    }

    const tbody = document.getElementById('audit-logs-table-body');
    if (list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No audit entries found.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map(l => `
      <tr>
        <td><strong>#${l.log_id}</strong></td>
        <td>${DateTimeUtil.formatDateTime(l.created_at)}</td>
        <td>Admin (#${l.admin_id})</td>
        <td><span class="badge badge-neutral">${l.action_type}</span></td>
        <td>${l.entity_name}</td>
        <td>${l.record_id}</td>
        <td>${l.reason || '-'}</td>
        <td><small style="color: var(--text-muted); font-family: monospace;">${l.after_summary || '-'}</small></td>
      </tr>
    `).join('');
  }

  resetAuditLogs() {
    this.openConfirmation(
      'Reset Traceable System Audit Log',
      'Are you sure you want to clear the entire Traceable System Audit Log (FR-AUD-01, FR-AUD-02)? An audit baseline initialization record will be permanently created.',
      true,
      async (reason) => {
        await window.wrsmsDB.clearTable('Audit_Logs');
        await window.wrsmsDB.logAudit(
          'AUDIT_LOG_RESET',
          'Audit_Logs',
          'ALL',
          `System audit log cleared and reset by Administrator. Justification: ${reason || 'Periodic log maintenance'}`
        );
        this.showToast('System audit log reset successfully.', 'success');
        await this.renderAuditLogsTable();
      }
    );
  }

  // =========================================================================
  // 12. BACKUP & RESTORE CONTROLLER (FR-BKP)
  // =========================================================================
  async renderBackupHistoryTable() {
    const history = await window.wrsmsDB.getAll('Backup_History');
    const tbody = document.getElementById('backup-history-table-body');

    tbody.innerHTML = [...history].reverse().map(h => `
      <tr>
        <td>#${h.backup_id}</td>
        <td>${DateTimeUtil.formatDateTime(h.created_at)}</td>
        <td><code>${h.file_path}</code></td>
        <td><span class="badge ${h.result === 'success' ? 'badge-success' : 'badge-danger'}">${h.result}</span></td>
        <td>${h.notes || '-'}</td>
      </tr>
    `).join('') || '<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No backups recorded yet.</td></tr>';
  }

  async checkDailyBackupReminder() {
    // Prompt administrator to create backup if none created today (NFR-REL-04)
    const history = await window.wrsmsDB.getAll('Backup_History');
    const todayStr = DateTimeUtil.todayDateStr();
    const doneToday = history.some(h => h.created_at && h.created_at.startsWith(todayStr) && h.result === 'success');

    if (!doneToday) {
      setTimeout(() => {
        this.showToast('Reminder: No database backup has been created today yet (NFR-REL-04).', 'warning');
      }, 2000);
    }
  }

  async createBackup() {
    try {
      const backup = await window.wrsmsDB.generateBackup();

      // 1. Download JSON Backup
      const jsonBlob = new Blob([backup.jsonData], { type: 'application/json' });
      const jsonLink = document.createElement('a');
      jsonLink.href = URL.createObjectURL(jsonBlob);
      jsonLink.download = backup.fileName;
      jsonLink.click();

      // 2. Download SQL DDL/INSERT dump
      const sqlBlob = new Blob([backup.sqlData], { type: 'text/plain' });
      const sqlLink = document.createElement('a');
      sqlLink.href = URL.createObjectURL(sqlBlob);
      sqlLink.download = backup.fileName.replace('.json', '.sql');
      setTimeout(() => sqlLink.click(), 400);

      // 3. Download genuine binary SQLite .sqlite file (openable directly in DB Browser for SQLite)
      if (backup.sqliteBinary) {
        const sqliteBlob = new Blob([backup.sqliteBinary], { type: 'application/x-sqlite3' });
        const sqliteLink = document.createElement('a');
        sqliteLink.href = URL.createObjectURL(sqliteBlob);
        sqliteLink.download = backup.fileName.replace('.json', '.sqlite');
        setTimeout(() => sqliteLink.click(), 800);
      }

      this.showToast(`Backup created and downloaded (.json, .sql, .sqlite)!`, 'success');
      await this.renderBackupHistoryTable();
    } catch (err) {
      this.showToast(`Backup error: ${err.message}`, 'danger');
    }
  }

  async restoreBackup() {
    const input = document.getElementById('backup-file-input');
    if (!input.files || input.files.length === 0) {
      this.showToast('Please select a JSON or .sqlite backup file first.', 'warning');
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const fileContent = e.target.result;
        this.openConfirmation(
          'Restore Database Confirmation',
          'WARNING: Restoring will overwrite all 16 tables with the backup file data. This cannot be undone. Are you sure you want to proceed?',
          false,
          async () => {
            await window.wrsmsDB.restoreFromBackup(fileContent);
            this.showToast('Database successfully restored from backup snapshot!', 'success');
            await this.refreshAll();
          }
        );
      } catch (err) {
        this.showToast(`Restore failed: ${err.message}`, 'danger');
      }
    };

    if (file.name.endsWith('.sqlite') || file.name.endsWith('.db')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  }

  // =========================================================================
  // 13. MODALS & CONFIRMATION HELPER
  // =========================================================================
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  openConfirmation(title, message, requireReason, callback) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-msg').textContent = message;

    const reasonBox = document.getElementById('confirm-reason-box');
    const reasonInput = document.getElementById('confirm-reason-input');

    if (requireReason) {
      reasonBox.style.display = 'block';
      reasonInput.value = '';
    } else {
      reasonBox.style.display = 'none';
    }

    this.confirmCallback = callback;
    this.openModal('modal-confirmation');
  }

  // =========================================================================
  // 14. EVENT LISTENERS INITIALIZATION
  // =========================================================================
  initEventListeners() {
    // Auth: Login Form
    let isLoggingIn = false;
    const handleLogin = async (e) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isLoggingIn) return;
      isLoggingIn = true;
      const u = (document.getElementById('login-username')?.value || '').trim();
      const p = (document.getElementById('login-password')?.value || '').trim();
      try {
        await window.wrsmsAuth.login(u, p);
        this.hideAuthError();
        await this.showAppView();
        this.showToast('Authenticated successfully as Administrator.', 'success');
      } catch (err) {
        this.showAuthError(err.message);
      } finally {
        isLoggingIn = false;
      }
    };

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.onsubmit = handleLogin;
    }



    // Reset Admin Credentials & Unlock Link
    const resetAdminLink = document.getElementById('btn-reset-admin');
    if (resetAdminLink) {
      resetAdminLink.addEventListener('click', async (e) => {
        e.preventDefault();
        await window.wrsmsAuth.resetDefaultCredentials();
        const uEl = document.getElementById('login-username');
        const pEl = document.getElementById('login-password');
        if (uEl) uEl.value = 'admin';
        if (pEl) pEl.value = 'admin123';
        this.hideAuthError();
        this.showToast('Lockout cleared and default credentials (admin / admin123) restored!', 'success');
      });
    }

    // Hide error on typing
    document.getElementById('login-username')?.addEventListener('input', () => this.hideAuthError());
    document.getElementById('login-password')?.addEventListener('input', () => this.hideAuthError());

    // Logout
    document.getElementById('btn-logout').addEventListener('click', () => {
      window.wrsmsAuth.logout('User clicked sign-out');
      this.showAuthView();
    });

    window.onAuthLoggedOut = (reason) => {
      this.showAuthView();
      this.showToast(reason, 'warning');
    };

    // Sidebar Navigation Click
    document.querySelectorAll('.sidebar-nav .nav-item').forEach(el => {
      el.addEventListener('click', (e) => {
        const view = el.getAttribute('data-view');
        if (view) this.switchView(view);
      });
    });

    // Top button New Order
    document.getElementById('top-btn-new-order').addEventListener('click', () => {
      this.switchView('pos');
    });

    // Dashboard Range Filter Buttons
    document.querySelectorAll('.dash-filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderDashboard(btn.dataset.range);
      });
    });

    // POS Search & Category Filter
    document.getElementById('pos-search-input')?.addEventListener('input', () => this.renderPOSCatalog());
    document.querySelectorAll('.pos-cat-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pos-cat-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.renderPOSCatalog();
      });
    });

    // POS Customer Select change listener
    document.getElementById('pos-customer-select')?.addEventListener('change', () => this.updatePOSCustomerInfo());

    // POS Payment Mode Toggle
    const cashBtn = document.getElementById('pos-pay-cash-btn');
    const creditBtn = document.getElementById('pos-pay-credit-btn');
    cashBtn.addEventListener('click', () => {
      this.cartPaymentMode = 'cash';
      cashBtn.className = 'btn btn-primary btn-sm';
      creditBtn.className = 'btn btn-secondary btn-sm';
      document.getElementById('pos-cash-tender-group').style.display = 'block';
      document.getElementById('pos-credit-notice').style.display = 'none';
      this.calcChange();
    });
    creditBtn.addEventListener('click', () => {
      this.cartPaymentMode = 'credit';
      creditBtn.className = 'btn btn-primary btn-sm';
      cashBtn.className = 'btn btn-secondary btn-sm';
      document.getElementById('pos-cash-tender-group').style.display = 'none';
      document.getElementById('pos-credit-notice').style.display = 'block';
      this.calcChange();
    });

    // Cash Tendered Live Change Calculation
    document.getElementById('pos-cash-tendered').addEventListener('input', () => this.calcChange());

    // Apply Discount Button
    document.getElementById('pos-btn-discount').addEventListener('click', () => {
      const discStr = prompt('Enter discount amount in PHP (FR-PROD-06):', '0.00');
      if (discStr === null) return;
      const disc = Number(discStr);
      if (isNaN(disc) || disc < 0) {
        this.showToast('Invalid discount amount.', 'danger');
        return;
      }
      if (disc > 0) {
        const reason = prompt('Mandatory reason for discount override (Logged in Audit Log):', '');
        if (!reason) {
          this.showToast('Discount override requires a reason (FR-PROD-06).', 'danger');
          return;
        }
        this.cartDiscount = Currency.toCentavos(disc);
        this.cartDiscountReason = reason;
      } else {
        this.cartDiscount = 0;
        this.cartDiscountReason = '';
      }
      this.renderCart();
    });

    // POS Submit Order
    document.getElementById('pos-btn-submit-order').addEventListener('click', () => this.submitPOSOrder());

    // Orders Filter & Search
    document.getElementById('orders-search')?.addEventListener('input', () => this.renderOrdersTable());
    document.getElementById('orders-status-filter')?.addEventListener('change', () => this.renderOrdersTable());

    // Product Modal
    document.getElementById('btn-add-product').addEventListener('click', () => {
      document.getElementById('modal-product-title').textContent = 'Add New Product';
      document.getElementById('prod-id').value = '';
      document.getElementById('prod-name').value = '';
      document.getElementById('prod-unit').value = '';
      document.getElementById('prod-price').value = '';
      document.getElementById('prod-min-stock').value = '10';
      document.getElementById('prod-tracks-stock').value = '1';
      document.getElementById('prod-active').value = '1';
      this.openModal('modal-product');
    });
    document.getElementById('btn-save-product').addEventListener('click', () => this.saveProduct());

    // Customer Modal
    document.getElementById('btn-add-customer').addEventListener('click', () => {
      document.getElementById('modal-customer-title').textContent = 'Register Customer Profile';
      document.getElementById('cust-id').value = '';
      document.getElementById('cust-name').value = '';
      document.getElementById('cust-phone').value = '';
      document.getElementById('cust-address').value = '';
      document.getElementById('cust-landmark').value = '';
      document.getElementById('cust-credit-limit').value = '0.00';
      document.getElementById('cust-active').value = '1';
      this.openModal('modal-customer');
    });
    document.getElementById('btn-save-customer').addEventListener('click', () => this.saveCustomer());
    document.getElementById('pos-btn-add-customer')?.addEventListener('click', () => {
      document.getElementById('btn-add-customer').click();
    });

    // Manual Customer Ledger Entry Modal
    document.getElementById('btn-save-manual-ledger')?.addEventListener('click', () => this.saveManualLedgerEntry());

    // Delivery Riders Modal & Quick Add
    document.getElementById('btn-add-rider')?.addEventListener('click', () => this.openRiderModal());
    document.getElementById('btn-quick-add-rider')?.addEventListener('click', () => this.openRiderModal(true));
    document.getElementById('btn-save-rider')?.addEventListener('click', () => this.saveRider());

    // Collection Modal
    document.getElementById('btn-submit-collection').addEventListener('click', () => this.recordCashCollection());

    // Inventory: Refill, Stock Adjustment & Reset
    document.getElementById('btn-record-refill').addEventListener('click', () => this.openRefillModal());
    document.getElementById('btn-submit-refill').addEventListener('click', () => this.recordRefillProduction());
    document.getElementById('btn-manual-stock-adjust').addEventListener('click', () => this.openStockAdjustModal());
    document.getElementById('btn-submit-stock-adjust').addEventListener('click', () => this.submitStockAdjustment());
    document.getElementById('btn-reset-stock-movements')?.addEventListener('click', () => this.resetStockMovements());

    // Delivery: Create Trip & Reconcile
    document.getElementById('btn-create-trip').addEventListener('click', () => this.openCreateTripModal());
    document.getElementById('btn-submit-create-trip').addEventListener('click', () => this.submitCreateTrip());
    document.getElementById('btn-submit-reconcile-trip').addEventListener('click', () => this.submitReconcileTrip());

    // Expenses & Closing
    document.getElementById('btn-add-expense').addEventListener('click', () => this.openExpenseModal());
    document.getElementById('btn-submit-expense').addEventListener('click', () => this.saveExpense());
    document.getElementById('btn-perform-closing').addEventListener('click', () => this.openClosingModal());
    document.getElementById('btn-submit-daily-closing').addEventListener('click', () => this.finalizeDailyClosing());

    // Reports
    document.getElementById('btn-generate-report').addEventListener('click', () => this.generateReport());
    document.getElementById('btn-export-csv').addEventListener('click', () => this.exportCurrentReportCSV());
    document.getElementById('btn-print-report').addEventListener('click', () => window.print());

    // Audit Filter & Reset
    document.getElementById('audit-filter-action')?.addEventListener('change', () => this.renderAuditLogsTable());
    document.getElementById('btn-reset-audit-logs')?.addEventListener('click', () => this.resetAuditLogs());

    // Backup & Restore
    document.getElementById('btn-create-backup-now').addEventListener('click', () => this.createBackup());
    const fileInput = document.getElementById('backup-file-input');
    const restoreBtn = document.getElementById('btn-restore-backup-now');
    fileInput.addEventListener('change', () => {
      restoreBtn.disabled = !fileInput.files.length;
    });
    restoreBtn.addEventListener('click', () => this.restoreBackup());

    // Change Password Form
    document.getElementById('form-change-password').addEventListener('submit', async (e) => {
      e.preventDefault();
      const current = document.getElementById('pw-current').value;
      const newP = document.getElementById('pw-new').value;
      const confirmP = document.getElementById('pw-confirm').value;

      if (newP !== confirmP) {
        this.showToast('New passwords do not match.', 'danger');
        return;
      }

      try {
        await window.wrsmsAuth.changePassword(current, newP);
        this.showToast('Password changed successfully!', 'success');
        document.getElementById('form-change-password').reset();
      } catch (err) {
        this.showToast(err.message, 'danger');
      }
    });

    // Confirmation Modal Proceed Button
    document.getElementById('confirm-btn-proceed').addEventListener('click', () => {
      const reasonBox = document.getElementById('confirm-reason-box');
      const reasonInput = document.getElementById('confirm-reason-input');

      if (reasonBox.style.display !== 'none' && !reasonInput.value.trim()) {
        this.showToast('Please enter a mandatory reason for this action.', 'danger');
        return;
      }

      const reason = reasonInput.value.trim();
      this.closeModal('modal-confirmation');
      if (this.confirmCallback) {
        this.confirmCallback(reason);
        this.confirmCallback = null;
      }
    });
  }
}

// Boot application upon DOM ready
window.addEventListener('DOMContentLoaded', async () => {
  window.wrsmsApp = new WRSMSApp();
  await window.wrsmsDB.init();
  await window.wrsmsApp.init();
});
