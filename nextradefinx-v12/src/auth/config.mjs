export function readAuthConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || '';
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '';
  const serviceRolePresent = Boolean(env.SUPABASE_SERVICE_ROLE_KEY);
  return {
    configured: Boolean(url && anonKey),
    url_present: Boolean(url),
    anon_key_present: Boolean(anonKey),
    service_role_present: serviceRolePresent,
    secrets_echoed: false,
    live_execution_enabled: false,
    client_funds_enabled: false,
    personalized_advice_enabled: false
  };
}

export function assertNoServiceRoleInClient(env = process.env) {
  const clientLeaks = Object.keys(env).filter(k => k.startsWith('NEXT_PUBLIC_') && /SERVICE_ROLE|SECRET|PRIVATE/i.test(k));
  if (clientLeaks.length) throw new Error(`unsafe_public_secret_names:${clientLeaks.join(',')}`);
  return true;
}
