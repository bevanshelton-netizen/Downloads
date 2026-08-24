import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_POLICY, evaluateBetaEligibility } from '../src/beta/eligibility.mjs';
import { buildConsentReceipt } from '../src/beta/consent-receipt.mjs';
import { buildDeletionRequest, deletionExecutionBoundary } from '../src/beta/deletion-plan.mjs';

const eligibleInput = {
  authenticated:true,email_verified:true,invite_approved:true,age_over_18:true,
  terms_version:CURRENT_POLICY.terms_version,
  privacy_version:CURRENT_POLICY.privacy_version,
  risk_version:CURRENT_POLICY.risk_version
};

test('eligible learner passes controlled beta gate',()=>{
  const r=evaluateBetaEligibility(eligibleInput);
  assert.equal(r.eligible,true); assert.deepEqual(r.blockers,[]);
});

test('missing invite blocks beta access',()=>{
  const r=evaluateBetaEligibility({...eligibleInput,invite_approved:false});
  assert.equal(r.eligible,false); assert.ok(r.blockers.includes('beta_invite_required'));
});

test('unverified email blocks beta access',()=>{
  const r=evaluateBetaEligibility({...eligibleInput,email_verified:false});
  assert.ok(r.blockers.includes('verified_email_required'));
});

test('stale document versions block beta access',()=>{
  const r=evaluateBetaEligibility({...eligibleInput,terms_version:'old'});
  assert.ok(r.blockers.includes('current_terms_required'));
});

test('age confirmation is required for conservative beta',()=>{
  const r=evaluateBetaEligibility({...eligibleInput,age_over_18:false});
  assert.ok(r.blockers.includes('age_confirmation_required'));
});

test('consent receipt is versioned and educational only',()=>{
  const r=buildConsentReceipt({userId:'u1',locale:'zu-ZA',termsVersion:'t1',privacyVersion:'p1',riskVersion:'r1',ageOver18:true,acceptedAt:'2026-08-24T02:00:00Z'});
  assert.equal(r.user_id,'u1'); assert.equal(r.educational_only_acknowledged,true); assert.equal(r.live_execution_off_acknowledged,true);
});

test('consent receipt rejects missing age confirmation',()=>{
  assert.throws(()=>buildConsentReceipt({userId:'u1',termsVersion:'t',privacyVersion:'p',riskVersion:'r',ageOver18:false}),/age_confirmation_required/);
});

test('deletion request cannot delete auth user from client',()=>{
  const r=buildDeletionRequest({userId:'u1',reason:'privacy'});
  assert.equal(r.client_can_delete_auth_user_directly,false);
  assert.equal(deletionExecutionBoundary().auth_user_deletion,'server_admin_only');
});
