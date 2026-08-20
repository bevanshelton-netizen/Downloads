const raw = String(process.env.KORA_TARGET_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
if (!raw) {
  console.error('KORA_TARGET_URL or NEXT_PUBLIC_APP_URL is required.');
  process.exit(1);
}

let base;
try {
  base = new URL(raw);
} catch {
  console.error('Target URL is invalid.');
  process.exit(1);
}
if (base.protocol !== 'https:') {
  console.error('Production smoke tests require HTTPS.');
  process.exit(1);
}

const expectReady = String(process.env.KORA_EXPECT_READY || 'false') === 'true';

async function json(path) {
  const response = await fetch(new URL(path, base), { redirect: 'follow', headers: { 'user-agent': 'kora-production-smoke/1.0' } });
  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch {}
  return { response, body, text };
}

async function page(path) {
  const response = await fetch(new URL(path, base), { redirect: 'manual', headers: { 'user-agent': 'kora-production-smoke/1.0' } });
  return response;
}

let failed = false;

const health = await json('/api/health');
const healthOk = health.response.status === 200 && health.body?.status === 'ok';
console.log(`${healthOk ? 'PASS' : 'FAIL'}  /api/health — HTTP ${health.response.status}`);
failed ||= !healthOk;

const readiness = await json('/api/readiness');
const ready = readiness.response.status === 200 && readiness.body?.productionReady === true;
if (expectReady) {
  console.log(`${ready ? 'PASS' : 'FAIL'}  /api/readiness — expected production ready`);
  failed ||= !ready;
} else {
  const sensible = readiness.response.status === 200 || readiness.response.status === 503;
  console.log(`${sensible ? 'PASS' : 'FAIL'}  /api/readiness — HTTP ${readiness.response.status}; productionReady=${Boolean(readiness.body?.productionReady)}`);
  failed ||= !sensible;
}

if (!ready && readiness.body?.checks) {
  const failedNames = Object.entries(readiness.body.checks)
    .filter(([, v]) => v === false)
    .map(([k]) => k);
  if (failedNames.length) console.log(`Readiness still blocked by: ${failedNames.join(', ')}`);
}

const version = await json('/api/version');
const versionOk = version.response.status === 200 && version.body?.service === 'KORA';
console.log(`${versionOk ? 'PASS' : 'FAIL'}  /api/version — HTTP ${version.response.status}`);
failed ||= !versionOk;

const home = await page('/');
const homeOk = [200, 302, 303, 307, 308].includes(home.status);
console.log(`${homeOk ? 'PASS' : 'FAIL'}  / — HTTP ${home.status}`);
failed ||= !homeOk;

if (failed) process.exit(1);
console.log('\nKORA post-deploy smoke test passed.');
