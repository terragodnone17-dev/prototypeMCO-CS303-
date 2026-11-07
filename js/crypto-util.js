/**
 * Water Refilling Station Management System (WRSMS)
 * Standalone Cryptographic & SHA-256 Utilities
 * 
 * Works 100% offline in all desktop browsers and local file:// contexts.
 * Uses Web Crypto API when available, with a standard pure-JS FIPS 180-4 SHA-256 fallback.
 */

const CryptoUtil = {
  // Pure JavaScript FIPS 180-4 SHA-256 implementation
  pureSha256(message) {
    function rightRotate(x, n) {
      return (x >>> n) | (x << (32 - n));
    }

    const K = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
      0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
      0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
      0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
      0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
      0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
      0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
      0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
      0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];

    // UTF-8 encode
    const utf8Bytes = [];
    for (let i = 0; i < message.length; i++) {
      let code = message.charCodeAt(i);
      if (code < 0x80) {
        utf8Bytes.push(code);
      } else if (code < 0x800) {
        utf8Bytes.push(0xc0 | (code >> 6));
        utf8Bytes.push(0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        utf8Bytes.push(0xe0 | (code >> 12));
        utf8Bytes.push(0x80 | ((code >> 6) & 0x3f));
        utf8Bytes.push(0x80 | (code & 0x3f));
      } else {
        // surrogate pair
        i++;
        code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(i) & 0x3ff));
        utf8Bytes.push(0xf0 | (code >> 18));
        utf8Bytes.push(0x80 | ((code >> 12) & 0x3f));
        utf8Bytes.push(0x80 | ((code >> 6) & 0x3f));
        utf8Bytes.push(0x80 | (code & 0x3f));
      }
    }

    const bitLength = utf8Bytes.length * 8;

    // Initial hash values (FIPS 180-4)
    let H0 = 0x6a09e667;
    let H1 = 0xbb67ae85;
    let H2 = 0x3c6ef372;
    let H3 = 0xa54ff53a;
    let H4 = 0x510e527f;
    let H5 = 0x9b05688c;
    let H6 = 0x1f83d9ab;
    let H7 = 0x5be0cd19;

    // Padding
    utf8Bytes.push(0x80);
    while ((utf8Bytes.length % 64) !== 56) {
      utf8Bytes.push(0x00);
    }

    // Convert bytes to 32-bit big-endian words
    const words = [];
    for (let i = 0; i < utf8Bytes.length; i += 4) {
      words.push(
        ((utf8Bytes[i] << 24) |
         (utf8Bytes[i + 1] << 16) |
         (utf8Bytes[i + 2] << 8) |
         utf8Bytes[i + 3]) >>> 0
      );
    }

    // Append 64-bit length
    words.push(Math.floor(bitLength / 0x100000000) >>> 0);
    words.push((bitLength & 0xffffffff) >>> 0);

    // Process blocks of 16 words (512 bits)
    const W = new Array(64);
    for (let i = 0; i < words.length; i += 16) {
      for (let t = 0; t < 16; t++) {
        W[t] = words[i + t];
      }
      for (let t = 16; t < 64; t++) {
        const s0 = (rightRotate(W[t - 15], 7) ^ rightRotate(W[t - 15], 18) ^ (W[t - 15] >>> 3)) >>> 0;
        const s1 = (rightRotate(W[t - 2], 17) ^ rightRotate(W[t - 2], 19) ^ (W[t - 2] >>> 10)) >>> 0;
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) >>> 0;
      }

      let a = H0;
      let b = H1;
      let c = H2;
      let d = H3;
      let e = H4;
      let f = H5;
      let g = H6;
      let h = H7;

      for (let t = 0; t < 64; t++) {
        const S1 = (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) >>> 0;
        const ch = ((e & f) ^ ((~e) & g)) >>> 0;
        const temp1 = (h + S1 + ch + K[t] + W[t]) >>> 0;
        const S0 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) >>> 0;
        const maj = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
        const temp2 = (S0 + maj) >>> 0;

        h = g;
        g = f;
        f = e;
        e = (d + temp1) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (temp1 + temp2) >>> 0;
      }

      H0 = (H0 + a) >>> 0;
      H1 = (H1 + b) >>> 0;
      H2 = (H2 + c) >>> 0;
      H3 = (H3 + d) >>> 0;
      H4 = (H4 + e) >>> 0;
      H5 = (H5 + f) >>> 0;
      H6 = (H6 + g) >>> 0;
      H7 = (H7 + h) >>> 0;
    }

    const hexParts = [H0, H1, H2, H3, H4, H5, H6, H7].map(h => h.toString(16).padStart(8, '0'));
    return hexParts.join('');
  },

  // Asynchronous SHA-256 with Web Crypto fallback
  async sha256(message) {
    try {
      if (window.crypto && window.crypto.subtle && typeof window.crypto.subtle.digest === 'function') {
        const encoder = new TextEncoder();
        const data = encoder.encode(message);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // fallback to pure JS below
    }
    return this.pureSha256(message);
  },

  // Hash password with salt
  async hashPassword(password, salt) {
    const raw = String(password) + String(salt || 'wrsms_salt_2026');
    return await this.sha256(raw);
  },

  // Synchronous hash for immediate use
  hashPasswordSync(password, salt) {
    const raw = String(password) + String(salt || 'wrsms_salt_2026');
    return this.pureSha256(raw);
  },

  // Generate random salt
  generateSalt(length = 16) {
    try {
      if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(length);
        window.crypto.getRandomValues(array);
        return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch {
      // fallback
    }
    let res = '';
    const chars = '0123456789abcdef';
    for (let i = 0; i < length * 2; i++) {
      res += chars[Math.floor(Math.random() * chars.length)];
    }
    return res;
  }
};

window.CryptoUtil = CryptoUtil;
