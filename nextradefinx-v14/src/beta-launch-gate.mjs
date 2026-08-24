const REQUIRED_PUBLIC = ['NEXT_PUBLIC_SUPABASE_URL','NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const REQUIRED_POLICY = ['NEXTRADEFINX_TERMS_VERSION','NEXTRADEFINX_PRIVACY_VERSION','NEXTRADEFINX_RISK_VERSION'];
const HARD_OFF = ['NEXTRADEFINX_LIVE_EXECUTION','NEXTRADEFINX_CLIENT_FUNDS','NEXTRADEFINX_LEVERAGE','NEXTRADEFINX_PERSONALIZED_ADVICE','NEXTRADEFINX_BROKER_CONNECTIVITY'];

export function evaluateBetaLaunch(env = process.env) {
  const blockers = [];
  for (const key of REQUIRED_PUBLIC) if (!String(env[key] || '').trim()) blockers.push(`missing:${key}`);
  for (const key of REQUIRED_POLICY) if (!String(env[key] || '').trim()) blockers.push(`missing:${key}`);
  if ((env.NEXTRADEFINX_BETA_MODE || '') !== 'invite_only') blockers.push('beta_mode_must_be_invite_only');
  for (const key of HARD_OFF) if (String(env[key] || '').toLowerCase() !== 'false') blockers.push(`must_remain_false:${key}`);
  if (Object.keys(env).some(k => /SERVICE_ROLE|SUPABASE_SECRET|BROKER_SECRET|API_SECRET/i.test(k) && String(env[k] || '').trim())) {
    blockers.push('privileged_secret_present_in_public_beta_environment');
  }
  return {
    ready: blockers.length === 0,
    mode: 'education_and_paper_trading_only',
    blockers,
    hardBoundaries: Object.fromEntries(HARD_OFF.map(k => [k, false]))
  };
}
