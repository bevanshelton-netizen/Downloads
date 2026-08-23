import assert from 'node:assert/strict';
import { assertLiveShadowPolicy } from '../src/data/provider-policy.mjs';

assert.equal(assertLiveShadowPolicy('fixture').live, false);
const old = { ...process.env };
try {
  delete process.env.ALLOW_LIVE_SHADOW;
  delete process.env.MARKET_DATA_LICENSE_APPROVED;
  delete process.env.LIVE_SHADOW_APPROVED;
  assert.throws(() => assertLiveShadowPolicy('twelve'), /live_shadow_policy_locked/);
  process.env.ALLOW_LIVE_SHADOW = 'true';
  process.env.MARKET_DATA_LICENSE_APPROVED = 'true';
  process.env.LIVE_SHADOW_APPROVED = 'true';
  assert.equal(assertLiveShadowPolicy('twelve').live, true);
} finally {
  process.env.ALLOW_LIVE_SHADOW = old.ALLOW_LIVE_SHADOW;
  process.env.MARKET_DATA_LICENSE_APPROVED = old.MARKET_DATA_LICENSE_APPROVED;
  process.env.LIVE_SHADOW_APPROVED = old.LIVE_SHADOW_APPROVED;
}
console.log('provider-policy.test: ok');
