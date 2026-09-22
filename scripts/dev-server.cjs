/**
 * APPU Local Development Server & API Proxy
 * 
 * Solves browser CORS restrictions when testing frontend on localhost:
 * 1. Serves static frontend assets from ./frontend with proper MIME types.
 * 2. Transparently proxies /api/* requests to https://api.appuai.online with valid origin headers.
 * 3. Transparently proxies /webhook/* to https://n8n.srv1871828.hstgr.cloud.
 * 
 * Usage: node scripts/dev-server.cjs [port] (default: 3001)
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = parseInt(process.argv[2], 10) || 3001;
const FRONTEND_DIR = path.resolve(__dirname, '../frontend');
const API_BACKEND = 'api.appuai.online';
const N8N_BACKEND = 'n8n.srv1871828.hstgr.cloud';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.cjs': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

function addCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key, X-Idempotency-Key, X-Guest-Session-Token, X-Guest-Token');
  res.setHeader('Access-Control-Expose-Headers', 'X-Guest-Session-Token, Idempotency-Key, Content-Type, X-Appu-Request-Id, X-Appu-Voice-Model');
}

function proxyRequest(req, res, targetHost) {
  addCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const reqHeaders = { ...req.headers };
  reqHeaders.host = targetHost;
  reqHeaders.origin = 'https://appuai.online';
  reqHeaders.referer = 'https://appuai.online/';
  delete reqHeaders['sec-fetch-mode'];
  delete reqHeaders['sec-fetch-site'];

  const proxyOptions = {
    hostname: targetHost,
    port: 443,
    path: req.url,
    method: req.method,
    headers: reqHeaders
  };

  const proxyReq = https.request(proxyOptions, (proxyRes) => {
    addCorsHeaders(res);
    for (const [key, val] of Object.entries(proxyRes.headers)) {
      if (!key.toLowerCase().startsWith('access-control-')) {
        res.setHeader(key, val);
      }
    }
    res.writeHead(proxyRes.statusCode);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error(`[DevServer Proxy Error] ${req.method} ${req.url} -> ${targetHost}:`, err.message);
    addCorsHeaders(res);
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'proxy_error',
      message: `Failed to proxy request to ${targetHost}: ${err.message}`
    }));
  });

  req.pipe(proxyReq);
}

function serveStatic(req, res) {
  addCorsHeaders(res);

  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);
  if (pathname === '/' || pathname === '') {
    pathname = '/index.html';
  }

  // Prevent directory traversal
  const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(FRONTEND_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback for HTML5 pushState or clean URLs
      const htmlFallback = filePath + '.html';
      if (fs.existsSync(htmlFallback) && fs.statSync(htmlFallback).isFile()) {
        filePath = htmlFallback;
      } else {
        filePath = path.join(FRONTEND_DIR, 'index.html');
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Server error reading file');
        return;
      }
      let finalContent = content;
      if (ext === '.html') {
        let htmlStr = content.toString('utf8');
        if (!htmlStr.includes('window.__APPU_API_BASE_URL__')) {
          htmlStr = htmlStr.replace(
            '<head>',
            '<head>\n  <script>window.__APPU_API_BASE_URL__ = "";</script>'
          );
          finalContent = Buffer.from(htmlStr, 'utf8');
        }
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(finalContent);
    });
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {
    proxyRequest(req, res, API_BACKEND);
  } else if (req.url.startsWith('/webhook/')) {
    proxyRequest(req, res, N8N_BACKEND);
  } else {
    serveStatic(req, res);
  }
});

server.listen(PORT, () => {
  console.log(`[Appu DevServer] Serving frontend from ${FRONTEND_DIR}`);
  console.log(`[Appu DevServer] Proxying /api/* -> https://${API_BACKEND}`);
  console.log(`[Appu DevServer] Proxying /webhook/* -> https://${N8N_BACKEND}`);
  console.log(`[Appu DevServer] Live on http://localhost:${PORT}`);
});
