const crypto = require('crypto');

const IKHOKHA_API = 'https://api.ikhokha.com/public-api/v1/api/payment';
const IKHOKHA_STATUS_EXTERNAL = 'https://api.ikhokha.com/public-api/v1/api/getStatus/external';
const ORIGIN = 'https://mandatory-regulatory-exams.vercel.app';

const PRODUCTS = Object.freeze({
  pde4_launch: { id: 'pde4_launch', label: 'PDEReady PDE4 Launch Access', amount: 29900, days: 90, prefix: 'PDE4' },
  pde5_launch: { id: 'pde5_launch', label: 'PDEReady PDE5 Launch Access', amount: 34900, days: 90, prefix: 'PDE5' },
  pde_bundle: { id: 'pde_bundle', label: 'PDEReady PDE4 + PDE5 Bundle', amount: 49900, days: 120, prefix: 'PDEB' }
});

function credentials() {
  const appId = (process.env.IKHOKHA_APP_ID || '').trim();
  const appSecret = (process.env.IKHOKHA_APP_SECRET || '').trim();
  return { appId, appSecret, configured: Boolean(appId && appSecret) };
}

function jsStringEscape(str) {
  return String(str).replace(/[\\"']/g, '\\$&').replace(/\u0000/g, '\\0');
}

function pathWithQuery(urlValue) {
  const u = new URL(urlValue);
  return `${u.pathname}${u.search}`;
}

function signatureFor(urlValue, body, secret) {
  const payload = jsStringEscape(pathWithQuery(urlValue) + (body || ''));
  return crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

function productFromReference(ref) {
  if (!ref) return null;
  if (ref.startsWith('PDE4-')) return PRODUCTS.pde4_launch;
  if (ref.startsWith('PDE5-')) return PRODUCTS.pde5_launch;
  if (ref.startsWith('PDEB-')) return PRODUCTS.pde_bundle;
  return null;
}

function entitlementKey(secret) {
  return crypto.createHmac('sha256', secret).update('pdeready-entitlement-v1').digest();
}

function issueEntitlement(product, externalTransactionID, secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    product: product.id,
    tx: externalTransactionID,
    iat: now,
    exp: now + product.days * 86400
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', entitlementKey(secret)).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifyEntitlement(token, secret) {
  if (!token || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', entitlementKey(secret)).update(body).digest('base64url');
  const a = Buffer.from(sig || '');
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { return null; }
  if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  const product = PRODUCTS[payload.product];
  if (!product) return null;
  return { payload, product };
}

async function readRequestBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
}

module.exports = {
  IKHOKHA_API,
  IKHOKHA_STATUS_EXTERNAL,
  ORIGIN,
  PRODUCTS,
  credentials,
  signatureFor,
  productFromReference,
  issueEntitlement,
  verifyEntitlement,
  readRequestBody
};
