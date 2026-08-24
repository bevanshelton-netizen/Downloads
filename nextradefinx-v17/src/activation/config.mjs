const forbidden = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'DATABASE_URL',
  'DB_PASSWORD',
  'BROKER_API_SECRET',
  'LIVE_TRADING_KEY'
];

export function validateActivationEnv(env = process.env) {
  const errors = [];
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];
  for (const key of required) {
    if (!String(env[key] || '').trim()) errors.push(`Missing ${key}`);
  }

  const url = String(env.NEXT_PUBLIC_SUPABASE_URL || '');
  if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL must be an https://*.supabase.co project URL');
  }

  for (const key of forbidden) {
    if (String(env[key] || '').trim()) errors.push(`Forbidden privileged/public secret present: ${key}`);
  }

  const mustBeOff = [
    'LIVE_EXECUTION_ENABLED',
    'CLIENT_FUNDS_ENABLED',
    'LEVERAGE_ENABLED',
    'PERSONALIZED_ADVICE_ENABLED',
    'BROKER_CONNECTIVITY_ENABLED'
  ];
  for (const key of mustBeOff) {
    if (String(env[key] || 'false').toLowerCase() !== 'false') {
      errors.push(`${key} must remain false`);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    mode: 'education_paper_trading_beta_only'
  };
}

export function requiredIsolationSubjects(env = process.env) {
  const names = ['RLS_TEST_USER_A_TOKEN', 'RLS_TEST_USER_B_TOKEN'];
  return names.filter(k => !String(env[k] || '').trim());
}
