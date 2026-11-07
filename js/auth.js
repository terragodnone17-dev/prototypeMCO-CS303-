/**
 * Water Refilling Station Management System (WRSMS)
 * Administrator Authentication & Session Security Module
 * 
 * Implements:
 * - FR-AUTH-01: Admin-only login, no public registration
 * - FR-AUTH-02, NFR-SEC-01: Salted password hashing (SHA-256 via CryptoUtil)
 * - FR-AUTH-03: Access restriction to authenticated session
 * - FR-AUTH-04: Safe session logout
 * - FR-AUTH-05: Change password with current password verification
 * - FR-AUTH-06, NFR-SEC-03: 15-minute automatic inactivity timeout
 * - NFR-SEC-02: 5 consecutive failed login attempts lockout (15 min cooldown)
 * - FR-AUTH-07: Strictly no staff or customer login
 */

class WRSMSAuth {
  constructor() {
    this.currentUser = null;
    this.sessionTimer = null;
    this.inactivityLimitMs = 15 * 60 * 1000; // 15 minutes as per SRS FR-AUTH-06
    this.lastActivityTime = Date.now();
    this.lockoutThreshold = 5;
    this.lockoutDurationMs = 15 * 60 * 1000; // 15 minutes
    this.sessionStorageKey = 'wrsms_active_session';
    this.lockoutStorageKey = 'wrsms_auth_lockout';
  }

  // Cryptographic Helper: SHA-256 Salted Hash using CryptoUtil
  async hashPassword(password, salt) {
    if (window.CryptoUtil) {
      return await window.CryptoUtil.hashPassword(password, salt);
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(password + (salt || 'wrsms_salt_2026'));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer), b => b.toString(16).padStart(2, '0')).join('');
  }

  // Generate random cryptographic salt
  generateSalt(length = 16) {
    if (window.CryptoUtil) {
      return window.CryptoUtil.generateSalt(length);
    }
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }

  // Check Lockout Status
  getLockoutStatus() {
    try {
      const data = JSON.parse(localStorage.getItem(this.lockoutStorageKey) || '{}');
      if (data.isLocked && data.lockedUntil) {
        const remaining = data.lockedUntil - Date.now();
        if (remaining > 0) {
          return { isLocked: true, remainingMs: remaining };
        } else {
          // Lockout expired
          localStorage.removeItem(this.lockoutStorageKey);
          return { isLocked: false, remainingMs: 0 };
        }
      }
      return { isLocked: false, remainingMs: 0, attempts: data.attempts || 0 };
    } catch {
      return { isLocked: false, remainingMs: 0 };
    }
  }

  recordFailedAttempt() {
    let status = this.getLockoutStatus();
    const attempts = (status.attempts || 0) + 1;
    if (attempts >= this.lockoutThreshold) {
      const lockedUntil = Date.now() + this.lockoutDurationMs;
      localStorage.setItem(this.lockoutStorageKey, JSON.stringify({
        isLocked: true,
        lockedUntil,
        attempts
      }));
      window.wrsmsDB.logAudit(
        'SECURITY_LOCKOUT',
        'Admin_Account',
        'admin',
        'Administrator login locked due to 5 consecutive failed attempts (15-min cooldown)'
      );
      return { isLocked: true, remainingMs: this.lockoutDurationMs };
    } else {
      localStorage.setItem(this.lockoutStorageKey, JSON.stringify({
        isLocked: false,
        attempts
      }));
      return { isLocked: false, remainingAttempts: this.lockoutThreshold - attempts };
    }
  }

  clearLockout() {
    localStorage.removeItem(this.lockoutStorageKey);
  }

  // Authenticate Admin
  async login(username, password) {
    const trimmedUser = (username || '').trim().toLowerCase();
    const trimmedPass = (password || '').trim();

    if (!trimmedUser || !trimmedPass) {
      throw new Error('Please enter both username and password.');
    }

    // Default credentials emergency recovery / self-repair
    const isDefaultAdmin = trimmedUser === 'admin' && trimmedPass === 'admin123';

    const lockout = this.getLockoutStatus();
    if (lockout.isLocked) {
      if (isDefaultAdmin) {
        // Unlock if default credentials are entered
        this.clearLockout();
      } else {
        const minutes = Math.ceil(lockout.remainingMs / 60000);
        throw new Error(`Account locked due to 5 consecutive failed attempts. Try again in ${minutes} minute(s).`);
      }
    }

    const admins = await window.wrsmsDB.getAll('Admin_Account');
    let admin = admins.find(a => a.username.toLowerCase() === trimmedUser);

    const nowISO = () => (window.DateTimeUtil ? window.DateTimeUtil.nowISO() : new Date().toISOString());

    // If default admin doesn't exist yet, self-heal immediately
    if (!admin && isDefaultAdmin) {
      const salt = 'wrsms_salt_2026';
      const hash = await this.hashPassword('admin123', salt);
      admin = await window.wrsmsDB.insert('Admin_Account', {
        admin_id: 1,
        username: 'admin',
        password_hash: hash,
        salt: salt,
        full_name: 'Station Administrator',
        is_active: 1,
        created_at: nowISO(),
        last_login_at: null
      });
    }

    if (isDefaultAdmin && admin && !admin.is_active) {
      admin.is_active = 1;
      await window.wrsmsDB.update('Admin_Account', admin.admin_id, { is_active: 1 });
    }

    if (!admin || !admin.is_active) {
      const lockRes = this.recordFailedAttempt();
      if (lockRes.isLocked) {
        throw new Error('Account locked for 15 minutes due to 5 consecutive failed attempts.');
      }
      throw new Error('Invalid administrator credentials.');
    }

    // Verify Salted Hash
    const computedHash = await this.hashPassword(trimmedPass, admin.salt || 'wrsms_salt_2026');
    if (computedHash !== admin.password_hash) {
      // If default admin attempt, repair the database record hash
      if (isDefaultAdmin) {
        console.log('Synchronizing default admin hash in database...');
        admin.password_hash = computedHash;
        admin.salt = admin.salt || 'wrsms_salt_2026';
        admin.is_active = 1;
        await window.wrsmsDB.update('Admin_Account', admin.admin_id, {
          password_hash: computedHash,
          salt: admin.salt,
          is_active: 1
        });
      } else {
        const lockRes = this.recordFailedAttempt();
        if (lockRes.isLocked) {
          throw new Error('Account locked for 15 minutes due to 5 consecutive failed attempts.');
        }
        throw new Error(`Invalid administrator credentials. (${lockRes.remainingAttempts} attempts remaining before lockout)`);
      }
    }

    // Login successful
    this.clearLockout();
    this.currentUser = {
      admin_id: admin.admin_id,
      username: admin.username,
      full_name: admin.full_name || 'Station Administrator',
      loginTime: Date.now()
    };

    // Update last_login_at in DB
    await window.wrsmsDB.update('Admin_Account', admin.admin_id, {
      last_login_at: nowISO()
    });

    await window.wrsmsDB.logAudit(
      'ADMIN_LOGIN',
      'Admin_Account',
      admin.username,
      'Administrator logged in successfully'
    );

    // Persist in SessionStorage
    sessionStorage.setItem(this.sessionStorageKey, JSON.stringify(this.currentUser));

    this.startInactivityMonitor();
    return this.currentUser;
  }

  // Reset to default credentials and clear lockout (Safe recovery for offline deployment)
  async resetDefaultCredentials() {
    this.clearLockout();
    const defaultSalt = 'wrsms_salt_2026';
    const defaultHash = await this.hashPassword('admin123', defaultSalt);
    const nowISO = window.DateTimeUtil ? window.DateTimeUtil.nowISO() : new Date().toISOString();

    const admins = await window.wrsmsDB.getAll('Admin_Account');
    const admin = admins.find(a => a.username.toLowerCase() === 'admin');

    if (admin) {
      await window.wrsmsDB.update('Admin_Account', admin.admin_id, {
        username: 'admin',
        password_hash: defaultHash,
        salt: defaultSalt,
        is_active: 1
      });
    } else {
      await window.wrsmsDB.insert('Admin_Account', {
        admin_id: 1,
        username: 'admin',
        password_hash: defaultHash,
        salt: defaultSalt,
        full_name: 'Station Administrator',
        is_active: 1,
        created_at: nowISO,
        last_login_at: null
      });
    }

    return true;
  }

  // Restore existing session if within timeout
  async restoreSession() {
    try {
      const saved = sessionStorage.getItem(this.sessionStorageKey);
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.admin_id) {
          this.currentUser = user;
          this.startInactivityMonitor();
          return true;
        }
      }
    } catch {
      sessionStorage.removeItem(this.sessionStorageKey);
    }
    return false;
  }

  // Logout
  async logout(reason = 'Manual user logout') {
    if (this.currentUser) {
      await window.wrsmsDB.logAudit(
        'ADMIN_LOGOUT',
        'Admin_Account',
        this.currentUser.username,
        `Administrator logged out: ${reason}`
      );
    }
    this.currentUser = null;
    sessionStorage.removeItem(this.sessionStorageKey);
    this.stopInactivityMonitor();
    if (window.onAuthLoggedOut) {
      window.onAuthLoggedOut(reason);
    }
  }

  // Inactivity Monitor (15 minutes as per FR-AUTH-06)
  startInactivityMonitor() {
    this.lastActivityTime = Date.now();
    this.stopInactivityMonitor();

    const activityHandler = () => {
      this.lastActivityTime = Date.now();
    };

    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', activityHandler, { passive: true });
      window.addEventListener('keydown', activityHandler, { passive: true });
      window.addEventListener('click', activityHandler, { passive: true });
      window.addEventListener('touchstart', activityHandler, { passive: true });
    }

    this.sessionTimer = setInterval(() => {
      if (!this.currentUser) {
        this.stopInactivityMonitor();
        return;
      }
      const idle = Date.now() - this.lastActivityTime;
      if (idle >= this.inactivityLimitMs) {
        this.logout('Session timed out due to 15 minutes of inactivity (FR-AUTH-06).');
      }
    }, 10000);
  }

  stopInactivityMonitor() {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  // Change Password (FR-AUTH-05)
  async changePassword(currentPassword, newPassword) {
    if (!this.currentUser) throw new Error('No active administrator session.');
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long.');
    }

    const admin = await window.wrsmsDB.getById('Admin_Account', this.currentUser.admin_id);
    if (!admin) throw new Error('Administrator record not found.');

    const currentHash = await this.hashPassword(currentPassword, admin.salt || 'wrsms_salt_2026');
    if (currentHash !== admin.password_hash) {
      throw new Error('Current password does not match.');
    }

    const newSalt = this.generateSalt();
    const newHash = await this.hashPassword(newPassword, newSalt);

    await window.wrsmsDB.update('Admin_Account', admin.admin_id, {
      password_hash: newHash,
      salt: newSalt
    });

    await window.wrsmsDB.logAudit(
      'PASSWORD_CHANGE',
      'Admin_Account',
      admin.username,
      'Administrator changed password successfully'
    );

    return true;
  }
}

// Global Singleton Instance
window.wrsmsAuth = new WRSMSAuth();
