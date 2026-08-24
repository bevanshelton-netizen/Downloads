import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBetaLaunch } from '../src/beta-launch-gate.mjs';

const good = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-public-key',
  NEXTRADEFINX_BETA_MODE: 'invite_only',
  NEXTRADEFINX_TERMS_VERSION: '2026-08-beta1',
  NEXTRADEFINX_PRIVACY_VERSION: '2026-08-beta1',
  NEXTRADEFINX_RISK_VERSION: '2026-08-beta1',
  NEXTRADEFINX_LIVE_EXECUTION: 'false',
  NEXTRADEFINX_CLIENT_FUNDS: 'false',
  NEXTRADEFINX_LEVERAGE: 'false',
  NEXTRADEFINX_PERSONALIZED_ADVICE: 'false',
  NEXTRADEFINX_BROKER_CONNECTIVITY: 'false'
};

test('passes only the controlled education beta configuration', () => {
  const result = evaluateBetaLaunch(good);
  assert.equal(result.ready, true);
  assert.deepEqual(result.blockers, []);
});

test('blocks missing Supabase public configuration', () => {
  const env = { ...good, NEXT_PUBLIC_SUPABASE_URL: '' };
  assert.equal(evaluateBetaLaunch(env).ready, false);
});

test('blocks any attempt to switch live execution on', () => {
  const env = { ...good, NEXTRADEFINX_LIVE_EXECUTION: 'true' };
  assert.match(evaluateBetaLaunch(env).blockers.join(','), /LIVE_EXECUTION/);
});

test('blocks privileged secrets from the public beta environment', () => {
  const env = { ...good, SUPABASE_SERVICE_ROLE_KEY: 'must-not-be-here' };
  assert.match(evaluateBetaLaunch(env).blockers.join(','), /privileged_secret/);
});
