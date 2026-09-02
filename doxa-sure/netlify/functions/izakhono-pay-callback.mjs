import crypto from 'node:crypto';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_SKEW_SECONDS = 300;

function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    },
    body: JSON.stringify(body)
  };
}

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`missing ${name}`);
  return value;
}

export function verifySignature(raw, timestamp, signature, secret, now = Date.now()) {
  if (!/^\d{10}$/.test(timestamp || '')) throw new Error('invalid timestamp');
  const sent = Number(timestamp);
  if (Math.abs(Math.floor(now / 1000) - sent) > MAX_SKEW_SECONDS) throw new Error('stale timestamp');
  if (secret.length < 32 || !/^[a-f0-9]{64}$/i.test(signature || '')) throw new Error('invalid signature');
  const expected = crypto.createHmac('sha256', secret).update(`${timestamp}.`).update(raw).digest('hex');
  const actualBuffer = Buffer.from(signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('invalid signature');
  }
}

export function validatePayload(value) {
  if (!value || value.event !== 'payment.paid' || value.merchant !== 'doxa-sure') throw new Error('invalid event');
  if (!/^evt_[a-f0-9]{40}$/.test(value.event_id || '')) throw new Error('invalid event id');
  const order = value.order;
  if (!order || !/^ord_[A-Za-z0-9_-]{12,}$/.test(order.id || '')) throw new Error('invalid order');
  if (order.product_code !== 'rescue-readiness-pack') throw new Error('invalid product');
  if (order.amount_minor !== 19900 || order.currency !== 'ZAR') throw new Error('invalid settlement');
  if (!/^DOXASURE-[0-9A-F]{8}$/.test(order.payment_reference || '')) throw new Error('invalid payment reference');
  if (!order.bank_reference || !order.paid_at || !order.customer_reference) throw new Error('incomplete order');
  if (order.entitlement?.kind !== 'service' || order.entitlement?.service !== 'rescue-readiness-pack') {
    throw new Error('invalid entitlement');
  }
  return value;
}

async function persist(payload, env, fetchImpl) {
  const base = required(env, 'DOXA_SUPABASE_URL').replace(/\/$/, '');
  const key = required(env, 'DOXA_SUPABASE_SERVICE_ROLE_KEY');
  const result = await fetchImpl(`${base}/rest/v1/rpc/doxa_record_paid_service`, {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ p_event: payload })
  });
  if (!result.ok) throw new Error(`storage rejected callback (${result.status})`);
  return result.json();
}

export async function handleCallback(event, { env = process.env, fetchImpl = fetch, now = Date.now() } = {}) {
  if (event.httpMethod !== 'POST') return response(405, { error: 'method not allowed' });
  if (env.DOXA_PAYMENT_CALLBACK_ENABLED !== 'true') return response(503, { error: 'payment callback disabled' });
  const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64') : Buffer.from(event.body || '', 'utf8');
  if (!raw.length || raw.length > MAX_BODY_BYTES) return response(400, { error: 'invalid body' });
  try {
    const secret = required(env, 'DOXA_IZAKHONO_PAY_CALLBACK_SECRET');
    const headers = Object.fromEntries(Object.entries(event.headers || {}).map(([key, value]) => [key.toLowerCase(), value]));
    verifySignature(raw, headers['x-izakhono-timestamp'], headers['x-izakhono-signature'], secret, now);
    const payload = validatePayload(JSON.parse(raw.toString('utf8')));
    const stored = await persist(payload, env, fetchImpl);
    return response(200, { ok: true, event_id: payload.event_id, result: stored });
  } catch (error) {
    const message = error instanceof SyntaxError ? 'invalid json' : error.message;
    const status = /signature|timestamp/.test(message) ? 401 : /storage|missing DOXA_SUPABASE/.test(message) ? 503 : 400;
    return response(status, { error: message });
  }
}

export const handler = handleCallback;
