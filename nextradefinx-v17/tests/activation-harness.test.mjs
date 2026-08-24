import test from 'node:test';
import assert from 'node:assert/strict';
import { validateActivationEnv, requiredIsolationSubjects } from '../src/activation/config.mjs';

const safe = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://abc123.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'public-anon-key',
  LIVE_EXECUTION_ENABLED: 'false',
  CLIENT_FUNDS_ENABLED: 'false',
  LEVERAGE_ENABLED: 'false',
  PERSONALIZED_ADVICE_ENABLED: 'false',
  BROKER_CONNECTIVITY_ENABLED: 'false'
};

test('safe environment passes', () => assert.equal(validateActivationEnv(safe).ok, true));
test('missing project url fails', () => assert.equal(validateActivationEnv({...safe, NEXT_PUBLIC_SUPABASE_URL:''}).ok, false));
test('invalid project url fails', () => assert.equal(validateActivationEnv({...safe, NEXT_PUBLIC_SUPABASE_URL:'http://localhost:54321'}).ok, false));
test('service role key is forbidden', () => assert.equal(validateActivationEnv({...safe, SUPABASE_SERVICE_ROLE_KEY:'secret'}).ok, false));
test('live execution must stay off', () => assert.equal(validateActivationEnv({...safe, LIVE_EXECUTION_ENABLED:'true'}).ok, false));
test('client funds must stay off', () => assert.equal(validateActivationEnv({...safe, CLIENT_FUNDS_ENABLED:'true'}).ok, false));
test('broker connectivity must stay off', () => assert.equal(validateActivationEnv({...safe, BROKER_CONNECTIVITY_ENABLED:'true'}).ok, false));
test('two isolation tokens are required', () => assert.deepEqual(requiredIsolationSubjects({}), ['RLS_TEST_USER_A_TOKEN','RLS_TEST_USER_B_TOKEN']));
test('no isolation tokens missing when both supplied', () => assert.deepEqual(requiredIsolationSubjects({RLS_TEST_USER_A_TOKEN:'a', RLS_TEST_USER_B_TOKEN:'b'}), []));
