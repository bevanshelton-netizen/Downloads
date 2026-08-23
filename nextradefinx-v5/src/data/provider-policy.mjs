export function assertLiveShadowPolicy(providerName) {
  if (providerName === 'fixture' || providerName === 'fixture-synthetic') return { live: false, approved: true };

  const checks = {
    allow_live_shadow: process.env.ALLOW_LIVE_SHADOW === 'true',
    license_approved: process.env.MARKET_DATA_LICENSE_APPROVED === 'true',
    shadow_approved: process.env.LIVE_SHADOW_APPROVED === 'true'
  };
  const failed = Object.entries(checks).filter(([, ok]) => !ok).map(([name]) => name);
  if (failed.length) throw new Error(`live_shadow_policy_locked:${failed.join(',')}`);
  return { live: true, approved: true };
}

export function publicProviderConfig(providerName) {
  return {
    provider: providerName,
    live_shadow_allowed: process.env.ALLOW_LIVE_SHADOW === 'true',
    data_license_approved: process.env.MARKET_DATA_LICENSE_APPROVED === 'true',
    shadow_governance_approved: process.env.LIVE_SHADOW_APPROVED === 'true',
    execution_enabled: false,
    client_visible: false
  };
}
