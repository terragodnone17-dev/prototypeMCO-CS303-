/**
 * Aqua Nhoy - Water Refilling Station Management System (WRSMS)
 * Standalone Local SQLite Server (Zero-Dependency Node.js HTTP Server)
 * 
 * Persists data directly to physical SQLite file: 'wrsms.sqlite' on disk.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DB_FILE = path.join(ROOT_DIR, 'wrsms.sqlite');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.sqlite': 'application/x-sqlite3',
  '.db': 'application/x-sqlite3',
  '.sql': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = decodeURIComponent(parsedUrl.pathname);

  // Enable CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. SQLite Database Load Endpoint
  if (pathname === '/api/db/load' && req.method === 'GET') {
    if (fs.existsSync(DB_FILE)) {
      try {
        const data = fs.readFileSync(DB_FILE);
        res.writeHead(200, {
          'Content-Type': 'application/x-sqlite3',
          'Content-Length': data.length
        });
        res.end(data);
        return;
      } catch (err) {
        console.error('[SQLite Server] Error reading wrsms.sqlite:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed reading SQLite database');
        return;
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No wrsms.sqlite file found on disk yet');
      return;
    }
  }

  // 2. SQLite Database Save Endpoint
  if (pathname === '/api/db/save' && req.method === 'POST') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const buffer = Buffer.concat(chunks);
        fs.writeFileSync(DB_FILE, buffer);
        console.log(`[SQLite Server] Saved ${buffer.length} bytes directly to wrsms.sqlite`);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, size: buffer.length, path: DB_FILE }));
      } catch (err) {
        console.error('[SQLite Server] Error writing wrsms.sqlite:', err);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Failed writing SQLite database to disk');
      }
    });
    return;
  }

  // 3. Static File Server
  let filePath = path.join(ROOT_DIR, pathname === '/' ? 'index.html' : pathname);

  // Security check to prevent directory traversal
  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log('================================================================');
  console.log(' Aqua Nhoy - Water Refilling Station Management System (WRSMS) ');
  console.log('================================================================');
  console.log(` Server running at: http://localhost:${PORT}`);
  console.log(` SQLite Database file: ${DB_FILE}`);
  console.log(' All database transactions are saved directly to wrsms.sqlite on disk.');
  console.log('================================================================');
});
