import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(__dirname, 'dist');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const CHECKOUT_ENABLED = String(process.env.CHECKOUT_ENABLED || 'false').toLowerCase() === 'true';
const REGISTRATION_ENABLED = String(process.env.REGISTRATION_ENABLED || 'false').toLowerCase() === 'true';

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function send(res, status, body, type = 'text/plain; charset=utf-8', extraHeaders = {}) {
  res.writeHead(status, {
    'content-type': type,
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'SAMEORIGIN',
    ...extraHeaders,
  });
  res.end(body);
}

async function serveFile(res, filePath) {
  const info = await stat(filePath);
  if (!info.isFile()) throw new Error('not-file');
  const body = await readFile(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const cache = ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable';
  send(res, 200, body, contentTypes[ext] || 'application/octet-stream', { 'cache-control': cache });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (url.pathname === '/health') {
      return send(res, 200, JSON.stringify({
        ok: true,
        service: 'izakhono-creative-suite',
        version: '0.6.0',
        runtime: process.env.IZAKHONO_RUNTIME_MODE || 'portable',
        registration_enabled: REGISTRATION_ENABLED,
        checkout_enabled: CHECKOUT_ENABLED,
        pricing_reference_usd: { creative: 5, gamer: 15 },
        billing_mode: '30-day-renewable-until-recurring-verified',
        recurring_billing_verified: false,
      }), 'application/json; charset=utf-8', { 'cache-control': 'no-store' });
    }

    const decoded = decodeURIComponent(url.pathname);
    const relative = decoded.replace(/^\/+/, '');
    const candidate = path.resolve(DIST, relative || 'index.html');
    const root = path.resolve(DIST);

    if (!candidate.startsWith(root + path.sep) && candidate !== root) {
      return send(res, 400, 'Bad request');
    }

    try {
      await serveFile(res, candidate);
      return;
    } catch {
      await serveFile(res, path.join(DIST, 'index.html'));
    }
  } catch {
    send(res, 500, 'Internal server error');
  }
});

server.listen(PORT, HOST, () => {
  console.log(`IZAKHONO Creative Suite serving on http://${HOST}:${PORT}`);
});
