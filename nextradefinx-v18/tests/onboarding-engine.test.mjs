import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateFirstLearner, firstSessionPlan } from '../src/onboarding/onboarding-engine.mjs';

const good = {
  inviteApproved: true,
  emailVerified: true,
  age18Confirmed: true,
  consents: {terms:true, privacy:true, risk:true},
  language: 'zu',
  experienceLevel: 'beginner',
  learningGoal: 'understand markets',
  paperOnlyAcknowledged: true,
  noProfitPromiseAcknowledged: true
};

test('complete onboarding may create learning passport', () => assert.equal(evaluateFirstLearner(good).readyForLearningPassport, true));
test('invite is mandatory', () => assert.ok(evaluateFirstLearner({...good, inviteApproved:false}).blockers.includes('invite_not_approved')));
test('verified email is mandatory', () => assert.ok(evaluateFirstLearner({...good, emailVerified:false}).blockers.includes('email_not_verified')));
test('risk consent is mandatory', () => assert.ok(evaluateFirstLearner({...good, consents:{...good.consents,risk:false}}).blockers.includes('risk_not_accepted')));
test('paper-only acknowledgement is mandatory', () => assert.ok(evaluateFirstLearner({...good,paperOnlyAcknowledged:false}).blockers.includes('paper_only_ack_required')));
test('invalid experience level is blocked', () => assert.ok(evaluateFirstLearner({...good,experienceLevel:'expert-guru'}).blockers.includes('experience_level_required')));
test('beginner session starts in plain language', () => assert.equal(firstSessionPlan(good).tone, 'plain_language'));
test('experienced path avoids beginner repetition', () => assert.equal(firstSessionPlan({...good,experienceLevel:'experienced'}).path[0], 'platform_boundaries'));
