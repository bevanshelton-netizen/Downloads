import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
let passed = 0;

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

function exists(relative) {
  return fs.existsSync(path.join(root, relative));
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`PASS  ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

for (const file of ['app/not-found.tsx', 'app/error.tsx', 'app/robots.ts', 'app/sitemap.ts', 'app/manifest.ts']) {
  check(`Public platform surface exists: ${file}`, exists(file));
}

const home = read('app/page.tsx');
for (const href of ['/watch', '/live', '/creators', '/advertise', '/account']) {
  check(`Home has a real ${href} route`, home.includes(`href=\"${href}\"`));
}
check('Home presents the creator economy', /creator/i.test(home) && /revenue/i.test(home));
check('Home explains cleared-revenue reward funding', /cleared/i.test(home) && /reward/i.test(home));

const advertise = read('app/advertise/page.tsx');
check('Advertiser overview obeys database launch state', advertise.includes('getPlatformReleaseState') && advertise.includes('advertiser_campaigns_enabled'));
check('Advertiser workspace is only directly opened when campaigns are enabled', advertise.includes("campaignsOpen ? '/advertiser' : '/login?next=/advertiser'"));
check('Advertiser terms are linked', advertise.includes('href=\"/legal/advertiser-terms\"'));
check('Brand page explains cleared funding', /cleared/i.test(advertise) && /reward/i.test(advertise));

const comingSoon = read('app/coming-soon/page.tsx');
check('Controlled launch serves invited members', comingSoon.includes('href=\"/login\"'));
check('Controlled launch serves creators', comingSoon.includes('href=\"/creators\"'));
check('Controlled launch serves brand partners', comingSoon.includes('href=\"/advertise\"'));

const middleware = read('middleware.ts');
check('Creator overview stays public during controlled launch', middleware.includes("pathname === '/creators'"));
check('Brand overview stays public during controlled launch', middleware.includes("pathname === '/advertise'"));
check('Creator application is not broadly whitelisted', !middleware.includes("pathname.startsWith('/creators')"));
check('Advertiser operations are not publicly whitelisted', !middleware.includes("pathname.startsWith('/advertiser')"));
check('Production remains fail-closed', middleware.includes('if (!publicLaunchEnabled && !authenticated && !alwaysPublic)'));

const layout = read('app/layout.tsx');
check('Keyboard skip link exists', layout.includes('href=\"#page-content\"') && layout.includes('id=\"page-content\"'));
for (const href of ['/legal/terms', '/legal/privacy', '/legal/content-policy', '/legal/copyright', '/legal/refunds']) {
  check(`Footer retains ${href}`, layout.includes(`href=\"${href}\"`));
}

const robots = read('app/robots.ts');
for (const route of ['/admin/', '/account/', '/studio/', '/advertiser/', '/api/']) {
  check(`Robots blocks private surface ${route}`, robots.includes(`'${route}'`));
}

const sitemap = read('app/sitemap.ts');
for (const route of ['/admin', '/account', '/studio', '/advertiser']) {
  check(`Sitemap excludes private surface ${route}`, !sitemap.includes(`'${route}'`));
}
check('Sitemap includes creators and brands', sitemap.includes("'/creators'") && sitemap.includes("'/advertise'"));

const manifest = read('app/manifest.ts');
check('Installable manifest names KORA', manifest.includes("name: 'KORA Network'") && manifest.includes("display: 'standalone'"));

const vercel = JSON.parse(read('vercel.json'));
const headers = (vercel.headers ?? []).flatMap((entry) => entry.headers ?? []);
const headerMap = new Map(headers.map((header) => [String(header.key).toLowerCase(), String(header.value)]));
for (const key of ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'permissions-policy', 'strict-transport-security']) {
  check(`Production browser header present: ${key}`, headerMap.has(key));
}

const contentPolicy = read('CONTENT_POLICY.md');
check('Pornography remains prohibited', /pornograph/i.test(contentPolicy) && /prohibit|not allowed|ban/i.test(contentPolicy));
check('Explicit sexual content remains prohibited', /explicit sexual/i.test(contentPolicy));

function walk(dir, output = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, output);
    else if (/\.(?:tsx|ts)$/.test(entry.name)) output.push(full);
  }
  return output;
}

let deadLink = null;
let unfinishedCopy = null;
for (const file of walk(path.join(root, 'app'))) {
  const text = fs.readFileSync(file, 'utf8');
  if (!deadLink && /href\s*=\s*["'](?:#|javascript:|)["']/.test(text)) deadLink = path.relative(root, file);
  if (!unfinishedCopy && /\b(?:lorem ipsum|fixme|todo:)\b/i.test(text)) unfinishedCopy = path.relative(root, file);
}
check('No obvious dead public links remain', !deadLink, deadLink || '');
check('No unfinished placeholder copy remains in app routes', !unfinishedCopy, unfinishedCopy || '');

console.log(`\nKORA public-experience guard: ${passed} passed, ${failures.length} failed.`);
if (failures.length) {
  console.error('\nPublic-experience violations:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
