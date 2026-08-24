import { validateActivationEnv, requiredIsolationSubjects } from '../src/activation/config.mjs';

const env = process.env;
const base = validateActivationEnv(env);
if (!base.ok) {
  console.error(JSON.stringify(base, null, 2));
  process.exit(2);
}

const missing = requiredIsolationSubjects(env);
if (missing.length) {
  console.error(`Missing short-lived test access tokens: ${missing.join(', ')}`);
  process.exit(3);
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const tokenA = env.RLS_TEST_USER_A_TOKEN;
const tokenB = env.RLS_TEST_USER_B_TOKEN;

async function request(path, token, init = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: anon,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {})
    }
  });
  const text = await res.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  if (!res.ok) throw new Error(`${res.status} ${JSON.stringify(body)}`);
  return body;
}

async function userId(token) {
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anon, Authorization: `Bearer ${token}` }
  });
  const body = await res.json();
  if (!res.ok || !body?.id) throw new Error('Could not resolve auth user');
  return body.id;
}

const idA = await userId(tokenA);
const idB = await userId(tokenB);
if (idA === idB) throw new Error('Isolation test requires two distinct users');

const markerA = `rls-a-${Date.now()}`;
const markerB = `rls-b-${Date.now()}`;

await request('learner_passports?on_conflict=user_id', tokenA, {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ user_id: idA, learning_goal: markerA })
});
await request('learner_passports?on_conflict=user_id', tokenB, {
  method: 'POST',
  headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
  body: JSON.stringify({ user_id: idB, learning_goal: markerB })
});

const ownA = await request(`learner_passports?select=user_id,learning_goal&user_id=eq.${idA}`, tokenA);
const crossA = await request(`learner_passports?select=user_id,learning_goal&user_id=eq.${idB}`, tokenA);
const ownB = await request(`learner_passports?select=user_id,learning_goal&user_id=eq.${idB}`, tokenB);
const crossB = await request(`learner_passports?select=user_id,learning_goal&user_id=eq.${idA}`, tokenB);

const passed = ownA?.length === 1 && ownB?.length === 1 && crossA?.length === 0 && crossB?.length === 0;
console.log(JSON.stringify({
  passed,
  checks: {
    a_reads_own: ownA?.length === 1,
    a_cannot_read_b: crossA?.length === 0,
    b_reads_own: ownB?.length === 1,
    b_cannot_read_a: crossB?.length === 0
  }
}, null, 2));

process.exit(passed ? 0 : 4);
