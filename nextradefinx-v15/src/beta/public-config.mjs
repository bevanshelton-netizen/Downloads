const PUBLIC_KEYS = new Set([
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_BETA_MODE',
  'NEXT_PUBLIC_TERMS_VERSION',
  'NEXT_PUBLIC_PRIVACY_VERSION',
  'NEXT_PUBLIC_RISK_VERSION'
]);

const FORBIDDEN_PUBLIC_PATTERNS = [/service[_-]?role/i,/secret/i,/password/i,/private[_-]?key/i,/broker[_-]?token/i];

export function validatePublicEnv(env) {
  const errors = [];
  for (const [key, value] of Object.entries(env || {})) {
    if (key.startsWith('NEXT_PUBLIC_') && !PUBLIC_KEYS.has(key) && FORBIDDEN_PUBLIC_PATTERNS.some((pattern) => pattern.test(key))) {
      errors.push(`Forbidden privileged value exposed publicly: ${key}`);
    }
    if (key.startsWith('NEXT_PUBLIC_') && typeof value === 'string' && value.trim() === '') {
      errors.push(`Public environment value is empty: ${key}`);
    }
  }
  for (const key of PUBLIC_KEYS) if (!env?.[key]) errors.push(`Missing required public environment value: ${key}`);
  if (env?.NEXT_PUBLIC_BETA_MODE && env.NEXT_PUBLIC_BETA_MODE !== 'invite_only') errors.push('Beta mode must remain invite_only.');
  return { ok: errors.length === 0, errors };
}
