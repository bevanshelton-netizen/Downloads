import assert from 'node:assert/strict';
import { validatePublicEnv } from '../src/beta/public-config.mjs';
import { evaluateInviteAccess } from '../src/beta/invite-gate.mjs';
import { activationStatus } from '../src/beta/activation-status.mjs';

const baseEnv={NEXT_PUBLIC_SUPABASE_URL:'https://project.supabase.co',NEXT_PUBLIC_SUPABASE_ANON_KEY:'public-anon-key',NEXT_PUBLIC_BETA_MODE:'invite_only',NEXT_PUBLIC_TERMS_VERSION:'beta-1',NEXT_PUBLIC_PRIVACY_VERSION:'beta-1',NEXT_PUBLIC_RISK_VERSION:'beta-1',LIVE_EXECUTION_ENABLED:'false',CLIENT_FUNDS_ENABLED:'false',LEVERAGE_ENABLED:'false',PERSONALIZED_ADVICE_ENABLED:'false',BROKER_CONNECTIVITY_ENABLED:'false',RLS_ISOLATION_TEST_PASSED:'true',CONSENT_FLOW_TEST_PASSED:'true',ACCOUNT_DELETION_TEST_PASSED:'true'};
assert.equal(validatePublicEnv(baseEnv).ok,true);
assert.equal(validatePublicEnv({...baseEnv,NEXT_PUBLIC_SERVICE_ROLE_KEY:'bad'}).ok,false);
assert.equal(validatePublicEnv({...baseEnv,NEXT_PUBLIC_BETA_MODE:'public'}).ok,false);
const args={authenticated:true,emailVerified:true,ageConfirmed18Plus:true,inviteStatus:'approved',consentVersions:{terms:'beta-1',privacy:'beta-1',risk:'beta-1'},requiredVersions:{terms:'beta-1',privacy:'beta-1',risk:'beta-1'}};
assert.equal(evaluateInviteAccess(args).allowed,true);
assert.equal(evaluateInviteAccess({...args,authenticated:false}).allowed,false);
assert.equal(activationStatus(baseEnv).eligible,true);
assert.equal(activationStatus({...baseEnv,LIVE_EXECUTION_ENABLED:'true'}).eligible,false);
assert.equal(activationStatus({...baseEnv,RLS_ISOLATION_TEST_PASSED:'false'}).eligible,false);
console.log('V15 tests passed: 8/8');
