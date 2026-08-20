const checks = [];
const mode = String(process.env.KORA_PREFLIGHT_MODE || 'public_launch').trim();
const publicLaunch = mode === 'public_launch';

function add(name, ok, note, required = true) {
  checks.push({ name, ok: Boolean(ok), note, required });
}

function value(name) {
  return String(process.env[name] || '').trim();
}

function nonPlaceholder(name, min = 1) {
  const v = value(name);
  return v.length >= min && !/(placeholder|example|changeme|pending|localhost|127\.0\.0\.1)/i.test(v);
}

function httpsUrl(name) {
  const v = value(name);
  try {
    const url = new URL(v);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname);
  } catch {
    return false;
  }
}

function email(name) {
  const v = value(name);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && !v.endsWith('.invalid');
}

add('NEXT_PUBLIC_APP_URL', httpsUrl('NEXT_PUBLIC_APP_URL'), 'final HTTPS origin');
add('NEXT_PUBLIC_SUPABASE_URL', httpsUrl('NEXT_PUBLIC_SUPABASE_URL'), 'production Supabase HTTPS URL');
add('NEXT_PUBLIC_SUPABASE_ANON_KEY', nonPlaceholder('NEXT_PUBLIC_SUPABASE_ANON_KEY', 20), 'configured');
add('SUPABASE_SERVICE_ROLE_KEY', nonPlaceholder('SUPABASE_SERVICE_ROLE_KEY', 20), 'configured');
add('VIDEO_PROVIDER', value('VIDEO_PROVIDER') === 'cloudflare', 'must be cloudflare');
add('CLOUDFLARE_ACCOUNT_ID', nonPlaceholder('CLOUDFLARE_ACCOUNT_ID', 8), 'configured');
add('CLOUDFLARE_STREAM_TOKEN', nonPlaceholder('CLOUDFLARE_STREAM_TOKEN', 20), 'configured');
add('CLOUDFLARE_STREAM_CUSTOMER_CODE', nonPlaceholder('CLOUDFLARE_STREAM_CUSTOMER_CODE', 8), 'configured');
add('PAYFAST_MERCHANT_ID', nonPlaceholder('PAYFAST_MERCHANT_ID', 4), 'configured');
add('PAYFAST_MERCHANT_KEY', nonPlaceholder('PAYFAST_MERCHANT_KEY', 8), 'configured');
add('PAYFAST_PASSPHRASE', nonPlaceholder('PAYFAST_PASSPHRASE', 8), 'configured');
add('PAYFAST_SANDBOX', value('PAYFAST_SANDBOX') === 'false', 'must be false for public launch; sandbox is allowed in private beta', publicLaunch);
add('KORA_INTERNAL_API_SECRET', nonPlaceholder('KORA_INTERNAL_API_SECRET', 32), '32+ character server secret');
add('NEXT_PUBLIC_OPERATOR_NAME', nonPlaceholder('NEXT_PUBLIC_OPERATOR_NAME', 3), 'real operating entity');
add('NEXT_PUBLIC_SUPPORT_EMAIL', email('NEXT_PUBLIC_SUPPORT_EMAIL'), 'monitored email');
add('NEXT_PUBLIC_PRIVACY_EMAIL', email('NEXT_PUBLIC_PRIVACY_EMAIL'), 'monitored email');
add('NEXT_PUBLIC_RIGHTS_EMAIL', email('NEXT_PUBLIC_RIGHTS_EMAIL'), 'monitored email');

add('KORA_LEGAL_APPROVED', value('KORA_LEGAL_APPROVED') === 'true', 'explicit sign-off', publicLaunch);
add('KORA_REGULATORY_APPROVED', value('KORA_REGULATORY_APPROVED') === 'true', 'explicit sign-off', publicLaunch);
add('KORA_CHILD_SAFETY_APPROVED', value('KORA_CHILD_SAFETY_APPROVED') === 'true', 'explicit sign-off', publicLaunch);
add('KORA_PAYOUT_OPERATIONS_APPROVED', value('KORA_PAYOUT_OPERATIONS_APPROVED') === 'true', 'explicit sign-off', publicLaunch);
add('KORA_BACKUP_OPERATIONS_APPROVED', value('KORA_BACKUP_OPERATIONS_APPROVED') === 'true', 'backup/restore procedure signed off', publicLaunch);
add('KORA_INCIDENT_RESPONSE_APPROVED', value('KORA_INCIDENT_RESPONSE_APPROVED') === 'true', 'incident process signed off', publicLaunch);

console.log(`KORA preflight mode: ${mode}`);
for (const check of checks) {
  const label = check.ok ? 'PASS' : check.required ? 'FAIL' : 'WARN';
  console.log(`${label}  ${check.name} — ${check.note}`);
}

const failed = checks.filter((c) => c.required && !c.ok);
const passed = checks.filter((c) => c.ok).length;
console.log(`\nKORA production preflight: ${passed}/${checks.length} checks passed; ${failed.length} required checks failed.`);
if (failed.length) {
  console.error(`Missing or invalid required production requirements: ${failed.map((c) => c.name).join(', ')}`);
  process.exit(1);
}
