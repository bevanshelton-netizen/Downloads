import fs from 'node:fs';
import path from 'node:path';
const appRoot = process.cwd(); const repoRoot = path.resolve(appRoot, '..'); const failures = []; let passed = 0;
const readApp = (relative) => fs.readFileSync(path.join(appRoot, relative), 'utf8');
const readRepo = (relative) => fs.readFileSync(path.join(repoRoot, relative), 'utf8');
function check(name, condition, detail = '') { if (condition) { passed += 1; console.log(`PASS  ${name}`); } else { failures.push(`${name}${detail ? ` — ${detail}` : ''}`); console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`); } }
const workflow = readRepo('.github/workflows/kora-production-activate.yml');
check('Activation uses protected kora-production environment', /environment:\s*kora-production/.test(workflow));
check('Activation requires exact typed confirmation', workflow.includes('ACTIVATE KORA PRIVATE BETA'));
check('Activation cannot overlap another activation', workflow.includes('group: kora-production-activation') && workflow.includes('cancel-in-progress: false'));
check('Database URL comes from GitHub Secrets', /SUPABASE_DB_URL:\s*\$\{\{\s*secrets\.SUPABASE_DB_URL\s*\}\}/.test(workflow));
check('Modern Supabase server key comes from GitHub Secrets', /SUPABASE_SECRET_KEY:\s*\$\{\{\s*secrets\.SUPABASE_SECRET_KEY\s*\}\}/.test(workflow));
check('Modern Supabase publishable key comes from GitHub Secrets', /NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:\s*\$\{\{\s*secrets\.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY\s*\}\}/.test(workflow));
check('Owner identity is external configuration, not hard-coded', /KORA_OWNER_EMAIL:\s*\$\{\{\s*inputs\.owner_email\s*\|\|\s*vars\.KORA_OWNER_EMAIL\s*\}\}/.test(workflow));
check('Private beta uses Cloudflare video', /VIDEO_PROVIDER:\s*cloudflare/.test(workflow) && !/VIDEO_PROVIDER:\s*mock/.test(workflow));
check('PayFast mode remains protected configuration', /PAYFAST_SANDBOX:\s*\$\{\{\s*vars\.PAYFAST_SANDBOX\s*\}\}/.test(workflow));
check('Private-beta preflight mode is explicit', /KORA_PREFLIGHT_MODE:\s*private_beta/.test(workflow));
for (const flag of ['KORA_LEGAL_APPROVED','KORA_REGULATORY_APPROVED','KORA_CHILD_SAFETY_APPROVED','KORA_PAYOUT_OPERATIONS_APPROVED','KORA_BACKUP_OPERATIONS_APPROVED','KORA_INCIDENT_RESPONSE_APPROVED']) {
  check(`${flag} remains externally controlled`, new RegExp(`${flag}:\\s*\\$\\{\\{\\s*vars\\.${flag}\\s*\\}\\}`).test(workflow));
  check(`${flag} is not hard-coded true`, !new RegExp(`${flag}:\\s*['\"]?true['\"]?`, 'i').test(workflow));
}
const preflightIndex = workflow.indexOf('npm run preflight:production'), dbIndex = workflow.indexOf('npm run ensure:production-db'), adminIndex = workflow.indexOf('npm run ensure:admin'), deployIndex = workflow.indexOf('vercel@latest deploy --prebuilt --prod'), smokeIndex = workflow.indexOf('npm run smoke:production');
check('Provider preflight runs before database changes', preflightIndex >= 0 && dbIndex > preflightIndex);
check('Database readiness runs before first-admin readiness', dbIndex >= 0 && adminIndex > dbIndex);
check('Admin readiness runs before deployment', adminIndex >= 0 && deployIndex > adminIndex);
check('Smoke verification runs after deployment', deployIndex >= 0 && smokeIndex > deployIndex);
const db = readApp('scripts/ensure-production-db.sh');
check('Database ensure script pins the KORA Supabase project', db.includes('production-instance.json') && db.includes('supabaseProjectRef') && db.includes('EXPECTED_SUPABASE_REF'));
check('Existing databases are upgraded rather than rebuilt', db.includes('profiles_exists') && db.includes('version') && db.includes('017_artist_discovery.sql'));
check('Fresh bootstrap retains the destructive-operation guard', db.includes('BOOTSTRAP FRESH KORA DATABASE') && db.includes('bootstrap-production-db.sh'));
check('Database ensure requires schema 17', db.includes('schema version 17') && db.includes('version\" != \"17\"'));
check('Private beta refuses an already-public database', db.includes('public-launch switch is already enabled'));
check('Database ensure requires at least one active channel', db.includes('active seeded channel') && db.includes('live_channels'));
const admin = readApp('scripts/ensure-first-admin.mjs');
check('Admin ensure accepts modern Supabase key with legacy fallback', admin.includes('process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY'));
check('Existing admin makes bootstrap idempotent', admin.includes('bootstrap is already satisfied') && admin.includes('process.exit(0)'));
check('New first admin requires externally supplied owner email', admin.includes('process.env.KORA_OWNER_EMAIL') && admin.includes('existing Supabase Auth user'));
check('First admin requires explicit privileged confirmation', admin.includes("KORA_BOOTSTRAP_CONFIRM !== 'BOOTSTRAP_FIRST_ADMIN'"));
check('First admin is verified after write', admin.includes('verifiedCount') && admin.includes('bootstrap could not be verified'));
const pkg = JSON.parse(readApp('package.json'));
check('Package exposes idempotent database activation', pkg.scripts?.['ensure:production-db'] === 'bash scripts/ensure-production-db.sh');
check('Package exposes idempotent admin activation', pkg.scripts?.['ensure:admin'] === 'node scripts/ensure-first-admin.mjs');
const ci = readRepo('.github/workflows/kora-ci.yml');
check('CI runs activation orchestration guard', ci.includes('npm run validate:activation'));
check('CI syntax-checks first-admin activation script', ci.includes('node --check scripts/ensure-first-admin.mjs'));
check('CI syntax-checks database activation script', ci.includes('bash -n scripts/ensure-production-db.sh'));
console.log(`\nKORA activation-orchestration guard: ${passed} passed, ${failures.length} failed.`);
if (failures.length) { console.error('\nActivation orchestration violations:'); failures.forEach((failure) => console.error(`- ${failure}`)); process.exit(1); }
