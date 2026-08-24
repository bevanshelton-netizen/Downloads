import test from 'node:test';
import assert from 'node:assert/strict';
import { safeReturnPath, requireAuthenticatedUser, publicSessionView } from '../src/auth/session-guard.mjs';
import { readAuthConfig, assertNoServiceRoleInClient } from '../src/auth/config.mjs';
import { assertEducationalPayload, productBoundary } from '../src/persistence/access-boundary.mjs';
import { LearningPassportRepository } from '../src/persistence/learning-passport-repository.mjs';

test('safe return path accepts local paths and rejects external/protocol-relative URLs', () => {
  assert.equal(safeReturnPath('/learn?stage=2'), '/learn?stage=2');
  assert.equal(safeReturnPath('//evil.example'), '/learn');
  assert.equal(safeReturnPath('https://evil.example'), '/learn');
});

test('authentication guard requires a user id', () => {
  assert.deepEqual(requireAuthenticatedUser({ user: { id: 'u1', email: 'a@b.test' } }), { id: 'u1', email: 'a@b.test' });
  assert.throws(() => requireAuthenticatedUser(null), /authentication_required/);
});

test('public session view does not expose tokens', () => {
  assert.deepEqual(publicSessionView({ user:{id:'u1'}, access_token:'secret' }), { authenticated:true, user_id:'u1' });
});

test('auth config reports presence without echoing values', () => {
  const result = readAuthConfig({ NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY:'abc', SUPABASE_SERVICE_ROLE_KEY:'server' });
  assert.equal(result.configured, true);
  assert.equal(result.secrets_echoed, false);
  assert.equal('url' in result, false);
});

test('client env validator rejects public service-role/secret variable names', () => {
  assert.equal(assertNoServiceRoleInClient({ NEXT_PUBLIC_SUPABASE_URL:'x' }), true);
  assert.throws(() => assertNoServiceRoleInClient({ NEXT_PUBLIC_SERVICE_ROLE_KEY:'x' }), /unsafe_public_secret_names/);
});

test('educational profile rejects prohibited financial-secret fields', () => {
  assert.equal(assertEducationalPayload({ language_code:'zu', learning_goal:'risk' }), true);
  assert.throws(() => assertEducationalPayload({ otp:'123456' }), /prohibited_educational_profile_fields/);
});

test('product boundary keeps regulated/live capabilities disabled', () => {
  const b = productBoundary();
  assert.equal(b.brokerage_account, false);
  assert.equal(b.client_funds, false);
  assert.equal(b.live_execution, false);
  assert.equal(b.personalized_advice, false);
});

test('repository sanitizes learner passport and requires user id', async () => {
  const client={from(table){return {
    upsert(row){return {select(){return {single:async()=>({data:row,error:null})}}}}
  }}};
  const repo=new LearningPassportRepository(client);
  const data=await repo.upsertPassport('u1',{language_code:'isiZulu-long-code',experience_level:'hacker',learning_goal:'x'.repeat(100),current_stage:99});
  assert.equal(data.user_id,'u1');
  assert.equal(data.experience_level,'beginner');
  assert.equal(data.current_stage,5);
  assert.equal(data.learning_goal.length,80);
  await assert.rejects(()=>repo.upsertPassport('',{}),/user_id_required/);
});
