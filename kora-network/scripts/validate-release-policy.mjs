import fs from 'node:fs';
import path from 'node:path';

const appRoot = process.cwd();
const repoRoot = path.resolve(appRoot, '..');
const failures = [];
const passes = [];
function readFromApp(relative) { return fs.readFileSync(path.join(appRoot, relative), 'utf8'); }
function readFromRepo(relative) { return fs.readFileSync(path.join(repoRoot, relative), 'utf8'); }
function check(name, condition, detail) { if (condition) { passes.push(name); console.log(`PASS  ${name}`); } else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); } }

const vercel = JSON.parse(readFromApp('vercel.json'));
check('Vercel previews disabled by default', vercel?.git?.deploymentEnabled?.['*'] === false);
check('Vercel production deploys limited to main', vercel?.git?.deploymentEnabled?.main === true);
check('Vercel GitHub bot comments silenced', vercel?.github?.silent === true);
const deploy = readFromRepo('.github/workflows/kora-production-deploy.yml');
check('Production deploy uses kora-production environment', /environment:\s*kora-production/.test(deploy));
check('Production video provider is Cloudflare', /VIDEO_PROVIDER:\s*cloudflare/.test(deploy) && !/VIDEO_PROVIDER:\s*mock/.test(deploy));
check('Private-beta preflight mode is explicit', /KORA_PREFLIGHT_MODE:\s*private_beta/.test(deploy));
check('Private-beta deployment requires typed confirmation', deploy.includes('DEPLOY KORA PRIVATE BETA'));
check('Supabase privileged key comes from GitHub Secrets', /SUPABASE_SECRET_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SECRET_KEY\s*\}\}/.test(deploy));
check('Supabase publishable key comes from GitHub Secrets', /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:\s*\$\{\{\s*secrets\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*\}\}/.test(deploy));
check('PayFast mode comes from protected environment vars', /PAYFAST_SANDBOX:\s*\$\{\{\s*vars\.PAYFAST_SANDBOX\s*\}\}/.test(deploy));
const firstAdminWorkflow = readFromRepo('.github/workflows/kora-bootstrap-first-admin.yml');
check('First-admin workflow supplies modern Supabase secret key', /SUPABASE_SECRET_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SECRET_KEY\s*\}\}/.test(firstAdminWorkflow));
const firstAdminScript = readFromApp('scripts/bootstrap-admin.mjs');
check('First-admin script accepts modern key with legacy fallback', firstAdminScript.includes('process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY'));
const dbBootstrap = readFromApp('scripts/bootstrap-production-db.sh');
check('DB bootstrap reads the pinned production instance', dbBootstrap.includes('production-instance.json') && dbBootstrap.includes('supabaseProjectRef'));
check('DB bootstrap rejects a URL for the wrong project', dbBootstrap.includes('SUPABASE_DB_URL') && dbBootstrap.includes('EXPECTED_SUPABASE_REF') && dbBootstrap.includes('does not identify the pinned KORA production project'));
check('DB bootstrap retains fresh-database refusal', dbBootstrap.includes("to_regclass('public.profiles')") && dbBootstrap.includes('Refusing fresh bootstrap'));
const approvalFlags = ['KORA_LEGAL_APPROVED','KORA_REGULATORY_APPROVED','KORA_CHILD_SAFETY_APPROVED','KORA_PAYOUT_OPERATIONS_APPROVED','KORA_BACKUP_OPERATIONS_APPROVED','KORA_INCIDENT_RESPONSE_APPROVED'];
for (const flag of approvalFlags) {
  const protectedReference = new RegExp(`${flag}:\\s*\\$\\{\\{\\s*vars\\.${flag}\\s*\\}\\}`);
  const hardcodedTrue = new RegExp(`${flag}:\\s*['\"]?true['\"]?`, 'i');
  check(`${flag} is externally approved, not hard-coded`, protectedReference.test(deploy) && !hardcodedTrue.test(deploy));
}
const readiness = readFromApp('lib/launch-readiness.ts');
check('Readiness requires schema 17 or newer', readiness.includes('schemaCurrent: release.schema_version >= 17'));
check('Readiness requires database reachability', readiness.includes('databaseReachable,'));
check('Readiness requires a bootstrapped admin', readiness.includes('adminBootstrapped: adminCount > 0'));
check('Readiness requires at least one live channel', readiness.includes('channelSeeded: activeChannelCount >= 1'));
check('Readiness requires public launch database switch', readiness.includes('publicLaunchEnabled: publicAccessOpen(release)'));
check('Production readiness requires every gate', readiness.includes('Object.values(checks).every(Boolean)'));
for (const flag of approvalFlags) check(`${flag} runtime gate requires exact true`, readiness.includes(`process.env.${flag} === 'true'`));
const middleware = readFromApp('middleware.ts');
check('Anonymous production access fails closed before public launch', middleware.includes('if (!publicLaunchEnabled && !authenticated && !alwaysPublic)'));
check('Closed public access redirects to coming-soon', middleware.includes("return redirectTo(request, response, '/coming-soon');"));
check('Maintenance mode excludes non-staff users', middleware.includes('if (maintenanceMode && !staff && !alwaysPublic)'));
check('Child profiles are confined to Kids Mode', middleware.includes("return redirectTo(request, response, '/kids');"));
for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) check(`${name} is not present in KORA source`, !fs.existsSync(path.join(appRoot, name)));
function walk(dir, out = []) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === 'artifacts') continue; const full = path.join(dir, entry.name); if (entry.isDirectory()) walk(full, out); else if (/\.(?:ts|tsx|js|mjs|json|md|sql)$/.test(entry.name) || entry.name === '.env.example') out.push(full); } return out; }
const scanFiles = walk(appRoot).filter((file) => !file.endsWith('validate-release-policy.mjs'));
const longSupabaseSecret = /sb_secret_[A-Za-z0-9_-]{20,}/, supabasePersonalToken = /sbp_[A-Za-z0-9_-]{20,}/, publicPrivilegedName = /NEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|SERVICE_ROLE|PASSPHRASE|STREAM_TOKEN|INTERNAL_API_SECRET)/;
let leakedSecret = null, publicPrivileged = null;
for (const file of scanFiles) { const text = fs.readFileSync(file, 'utf8'); if (!leakedSecret && (longSupabaseSecret.test(text) || supabasePersonalToken.test(text))) leakedSecret = path.relative(repoRoot, file); if (!publicPrivileged && publicPrivilegedName.test(text)) publicPrivileged = path.relative(repoRoot, file); }
check('No Supabase secret/personal token is committed', !leakedSecret, leakedSecret || undefined);
check('No privileged credential is exposed through NEXT_PUBLIC_*', !publicPrivileged, publicPrivileged || undefined);
console.log(`\nKORA release-policy guard: ${passes.length} passed, ${failures.length} failed.`);
if (failures.length) { console.error('\nRelease-policy violations:'); failures.forEach((failure) => console.error(`- ${failure}`)); process.exit(1); }
