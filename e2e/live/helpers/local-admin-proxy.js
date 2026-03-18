const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const root = path.resolve(__dirname, '../../..');
const remoteOrigin = 'https://forest-ambassador.vercel.app';
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

async function proxy(req, res) {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const target = remoteOrigin + url.pathname + url.search;
  const headers = { ...req.headers, host: 'forest-ambassador.vercel.app' };
  delete headers['content-length'];
  let body;
  if (!['GET', 'HEAD'].includes(req.method)) {
    body = await new Promise((resolve, reject) => {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => resolve(Buffer.concat(chunks)));
      req.on('error', reject);
    });
  }
  const remoteRes = await fetch(target, {
    method: req.method,
    headers,
    body,
    redirect: 'manual'
  });
  const arrayBuffer = await remoteRes.arrayBuffer();
  const responseHeaders = {};
  remoteRes.headers.forEach((value, key) => {
    if (!['content-encoding', 'transfer-encoding', 'connection'].includes(key.toLowerCase())) {
      responseHeaders[key] = value;
    }
  });
  send(res, remoteRes.status, Buffer.from(arrayBuffer), responseHeaders);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname.startsWith('/api')) {
      await proxy(req, res);
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/frontend/admin/admin-dashboard-real.html';
    const filePath = path.join(root, pathname);
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(root))) {
      send(res, 403, 'Forbidden');
      return;
    }

    let stat;
    try {
      stat = fs.statSync(resolved);
    } catch (_) {
      send(res, 404, 'Not Found');
      return;
    }

    let finalPath = resolved;
    if (stat.isDirectory()) {
      finalPath = path.join(resolved, 'index.html');
    }

    const ext = path.extname(finalPath).toLowerCase();
    const body = fs.readFileSync(finalPath);
    send(res, 200, body, {
      'Content-Type': mimeTypes[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
  } catch (error) {
    send(res, 500, `Proxy error: ${error.stack || error.message}`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`LOCAL_ADMIN_PROXY http://127.0.0.1:${port}`);
});
