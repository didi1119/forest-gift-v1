const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

process.env.DATA_BACKEND = process.env.DATA_BACKEND || 'supabase';
const root = path.resolve(__dirname, '../../..');
const port = Number(process.env.PORT || 4174);
const { route, handleRedirect } = require(path.join(root, 'api/_lib/backend.js'));

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

function parseBody(req, rawBody) {
  const contentType = req.headers['content-type'] || '';
  if (!rawBody || !rawBody.length) return {};
  const text = rawBody.toString('utf8');
  if (contentType.includes('application/json')) return JSON.parse(text || '{}');
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const data = {};
    for (const [key, value] of new URLSearchParams(text).entries()) {
      data[key] = value;
    }
    return data;
  }
  return {};
}

async function handleApi(req, res, url) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    send(res, 200, '');
    return;
  }

  const rawBody = await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

  const body = parseBody(req, rawBody);
  const query = Object.fromEntries(url.searchParams.entries());
  const action = query.action || body.action;

  try {
    if (req.method === 'GET' && (query.ref || query.pid || query.subid) && !query.action) {
      await handleRedirect({ method: req.method, query }, {
        writeHead(status, headers) { res.writeHead(status, headers); },
        end(payload) { res.end(payload); },
        setHeader(key, value) { res.setHeader(key, value); },
        redirect(statusOrUrl, maybeUrl) {
          const statusCode = typeof statusOrUrl === 'number' ? statusOrUrl : 302;
          const location = typeof statusOrUrl === 'number' ? maybeUrl : statusOrUrl;
          send(res, statusCode, '', { Location: location });
        },
        status(code) {
          return {
            json(payload) { send(res, code, JSON.stringify(payload), { 'Content-Type': 'application/json; charset=utf-8' }); },
            end(payload) { send(res, code, payload || ''); }
          };
        }
      });
      return;
    }

    if (!action) {
      if (req.method === 'GET' && query.test) {
        send(res, 200, JSON.stringify({ success: true, message: 'API is running' }), { 'Content-Type': 'application/json; charset=utf-8' });
        return;
      }
      send(res, 400, JSON.stringify({ success: false, error: 'Action is required' }), { 'Content-Type': 'application/json; charset=utf-8' });
      return;
    }

    const data = { ...query, ...body };
    delete data.action;
    const result = await route(action, data);
    const status = result && result.success === false ? 400 : 200;
    send(res, status, JSON.stringify(result), { 'Content-Type': 'application/json; charset=utf-8' });
  } catch (error) {
    send(res, 500, JSON.stringify({ success: false, error: error.message || 'Internal server error' }), { 'Content-Type': 'application/json; charset=utf-8' });
  }
}

async function handler(req, res) {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/api') {
      await handleApi(req, res, url);
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/frontend/admin/admin-dashboard-real.html';
    const resolved = path.resolve(path.join(root, pathname));
    if (!resolved.startsWith(path.resolve(root))) return send(res, 403, 'Forbidden');
    if (!fs.existsSync(resolved)) return send(res, 404, 'Not Found');

    const stat = fs.statSync(resolved);
    const finalPath = stat.isDirectory() ? path.join(resolved, 'index.html') : resolved;
    const body = fs.readFileSync(finalPath);
    send(res, 200, body, {
      'Content-Type': mimeTypes[path.extname(finalPath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
  } catch (error) {
    send(res, 500, `Proxy error: ${error.stack || error.message}`, { 'Content-Type': 'text/plain; charset=utf-8' });
  }
}

const server = http.createServer((req, res) => {
  handler(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`LOCAL_FULLSTACK_PROXY http://127.0.0.1:${port}`);
});
