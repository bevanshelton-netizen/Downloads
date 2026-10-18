#!/usr/bin/env node
/**
 * KORA TV owned-runtime E2E contract.
 *
 * This script is deliberately environment-driven. It can run against the
 * IZAKHONO Runtime/Edge stack when KORA_OWNED_RUNTIME_TARGET is supplied, and
 * it never fabricates deployment receipts or public-live status.
 */
import { request } from 'node:http';

const target = process.env.KORA_OWNED_RUNTIME_TARGET;
const hostname = process.env.KORA_OWNED_RUNTIME_HOSTNAME || 'kora.izakhonoafrica.co.za';
const expectedService = process.env.KORA_EXPECTED_SERVICE || 'KORA';

if (!target) {
  console.log('KORA OWNED RUNTIME E2E: SKIPPED');
  console.log('Set KORA_OWNED_RUNTIME_TARGET to the authorized IZAKHONO runtime/edge endpoint.');
  process.exit(0);
}

const base = new URL(target);
if (base.protocol !== 'https:') {
  console.error('KORA OWNED RUNTIME E2E: target must use HTTPS.');
  process.exit(1);
}

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, base);
    const req = request(url, {
      method: 'GET',
      headers: { host: hostname, accept: 'application/json,text/html;q=0.9,*/*;q=0.8' },
      timeout: 10000,
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString('utf8'), headers: res.headers }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

const checks = [
  ['/', 200],
  ['/live', 200],
  ['/watch', 200],
  ['/api/health', 200],
  ['/api/version', 200],
];

for (const [path, expected] of checks) {
  const result = await get(path);
  if (result.status !== expected) {
    console.error(`FAIL ${path}: expected ${expected}, got ${result.status}`);
    process.exit(1);
  }
  if (path === '/api/health') {
    let health;
    try { health = JSON.parse(result.body); } catch { console.error('FAIL /api/health: invalid JSON'); process.exit(1); }
    if (health.status !== 'ok' || health.service !== expectedService) {
      console.error(`FAIL /api/health: expected service=${expectedService}, status=ok`);
      process.exit(1);
    }
  }
}

const home = await get('/');
if (!/KORA/i.test(home.body)) {
  console.error('FAIL /: KORA branding not found');
  process.exit(1);
}

console.log('KORA OWNED RUNTIME E2E: PASS');
console.log('HTTPS: PASS');
console.log('Homepage: PASS');
console.log('Live TV route: PASS');
console.log('VOD route: PASS');
console.log('Health: PASS');
console.log('Version: PASS');
console.log('Public-live declaration remains a separate release decision requiring playback, authentication, payments and rights verification.');
