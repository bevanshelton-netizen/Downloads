import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { handleCallback } from './izakhono-pay-callback.mjs';

const now = 1788364800000;
const timestamp = String(Math.floor(now / 1000));
const secret = 'ci-doxa-callback-secret-0123456789';
const payload = {
  event: 'payment.paid',
  event_id: `evt_${'a'.repeat(40)}`,
  merchant: 'doxa-sure',
  order: {
    id: 'ord_0123456789abcdef', product_code: 'rescue-readiness-pack', customer_reference: 'case-1',
    payment_reference: 'DOXASURE-A1B2C3D4', bank_reference: 'FNB-SETTLED-1', amount_minor: 19900,
    currency: 'ZAR', paid_at: '2026-09-02T16:00:00Z',
    entitlement: { kind: 'service', service: 'rescue-readiness-pack' }
  }
};

function request(value = payload, override = {}) {
  const body = JSON.stringify(value);
  const signature = crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return { httpMethod: 'POST', body, headers: { 'x-izakhono-timestamp': timestamp, 'x-izakhono-signature': signature }, ...override };
}

const env = {
  DOXA_PAYMENT_CALLBACK_ENABLED: 'true', DOXA_IZAKHONO_PAY_CALLBACK_SECRET: secret,
  DOXA_SUPABASE_URL: 'https://doxa.example.supabase.co', DOXA_SUPABASE_SERVICE_ROLE_KEY: 'server-only-test-key'
};

test('fails closed while callback is disabled', async () => {
  const result = await handleCallback(request(), { env: {} });
  assert.equal(result.statusCode, 503);
});

test('rejects a bad signature without writing', async () => {
  let called = false;
  const event = request(); event.headers['x-izakhono-signature'] = '0'.repeat(64);
  const result = await handleCallback(event, { env, now, fetchImpl: async () => { called = true; } });
  assert.equal(result.statusCode, 401); assert.equal(called, false);
});

test('rejects wrong amount without writing', async () => {
  let called = false;
  const bad = structuredClone(payload); bad.order.amount_minor = 9900;
  const result = await handleCallback(request(bad), { env, now, fetchImpl: async () => { called = true; } });
  assert.equal(result.statusCode, 400); assert.equal(called, false);
});

test('persists one exact signed entitlement through server-only RPC', async () => {
  let call;
  const result = await handleCallback(request(), { env, now, fetchImpl: async (...args) => {
    call = args; return { ok: true, status: 200, json: async () => ({ outcome: 'created' }) };
  }});
  assert.equal(result.statusCode, 200);
  assert.match(call[0], /\/rest\/v1\/rpc\/doxa_record_paid_service$/);
  assert.equal(call[1].headers.authorization, 'Bearer server-only-test-key');
  assert.deepEqual(JSON.parse(call[1].body), { p_event: payload });
});
