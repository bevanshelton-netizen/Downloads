const checks = [];

function add(name, ok, note) {
  checks.push({ name, ok: Boolean(ok), note });
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
add('PAYFAST_SANDBOX', value('PAYFAST_SANDBOX') === 'false', 'must be false for production');
add('KORA_INTERNAL_API_SECRET', nonPlaceholder('KORA_INTERNAL_API_SECRET', 32), '32+ character server secret');
add('NEXT_PUBLIC_OPERATOR_NAME', nonPlaceholder('NEXT_PUBLIC_OPERATOR_NAME', 3), 'real operating entity');
add('NEXT_PUBLIC_SUPPORT_EMAIL', email('NEXT_PUBLIC_SUPPORT_EMAIL'), 'monitored email');
add('NEXT_PUBLIC_PRIVACY_EMAIL', email('NEXT_PUBLIC_PRIVACY_EMAIL'), 'monitored email');
add('NEXT_PUBLIC_RIGHTS_EMAIL', email('NEXT_PUBLIC_RIGHTS_EMAIL'), 'monitored email');
add('KORA_LEGAL_APPROVED', value('KORA_LEGAL_APPROVED') === 'true', 'explicit sign-off');
add('KORA_REGULATORY_APPROVED', value('KORA_REGULATORY_APPROVED') === 'true', 'explicit sign-off');
add('KORA_CHILD_SAFETY_APPROVED', value('KORA_CHILD_SAFETY_APPROVED') === 'true', 'explicit sign-off');
add('KORA_PAYOUT_OPERATIONS_APPROVED', value('KORA_PAYOUT_OPERATIONS_APPROVED') === 'true', 'explicit sign-off');
add('KORA_BACKUP_OPERATIONS_APPROVED', value('KORA_BACKUP_OPERATIONS_APPROVED') === 'true', 'backup/restore procedure signed off');
add('KORA_INCIDENT_RESPONSE_APPROVED', value('KORA_INCIDENT_RESPONSE_APPROVED') === 'true', 'incident process signed off');

for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'}  ${check.name} — ${check.note}`);
}

const failed = checks.filter((c) => !c.ok);
console.log(`\nKORA production preflight: ${checks.length - failed.length}/${checks.length} checks passed.`);
if (failed.length) {
  console.error(`Missing or invalid production requirements: ${failed.map((c) => c.name).join(', ')}`);
  process.exit(1);
}
