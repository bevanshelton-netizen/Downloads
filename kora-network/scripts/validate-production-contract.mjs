const checks = [
  ['VIDEO_PROVIDER', (v) => Boolean(v && v !== 'mock'), 'real production media provider'],
  ['KORA_STREAMING_READY', (v) => v === 'true', 'production streaming readiness'],
  ['NEXT_PUBLIC_SUPABASE_URL', Boolean, 'Supabase URL'],
  ['KORA_PAYMENT_PRODUCTION_VERIFIED', (v) => v === 'true', 'production payment verification'],
  ['KORA_CONTENT_RIGHTS_VERIFIED', (v) => v === 'true', 'content-rights verification'],
  ['KORA_PUBLIC_DEPLOYMENT_VERIFIED', (v) => v === 'true', 'external public deployment verification'],
];

let failed = 0;
for (const [name, predicate, label] of checks) {
  const ok = predicate(process.env[name]);
  console.log(`${ok ? 'PASS' : 'BLOCK'} ${label}: ${name}`);
  if (!ok) failed += 1;
}

console.log(`Production contract: ${checks.length - failed}/${checks.length} checks satisfied.`);
if (process.env.REQUIRE_PRODUCTION_CONTRACT === 'true' && failed) process.exit(1);
