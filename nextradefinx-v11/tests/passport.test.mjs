import test from 'node:test';
import assert from 'node:assert/strict';
import { createPassport, advancePassport } from '../src/passport.mjs';
import { appendProgressEvent, summarizeProgress, redactPublicPassport } from '../src/progress-store.mjs';

test('passport starts as education-only', () => {
  const p = createPassport({ user_id: 'u1', language_code: 'xh' });
  assert.equal(p.brokerage_account, false);
  assert.equal(p.kyc_profile, false);
  assert.equal(p.personalized_advice_profile, false);
});

test('invalid experience level is rejected', () => {
  assert.throws(() => createPassport({ user_id:'u1', experience_level:'guru' }), /invalid_experience_level/);
});

test('stage can advance but does not regress', () => {
  let p = createPassport({ user_id:'u1' });
  p = advancePassport(p, 3);
  p = advancePassport(p, 2);
  assert.equal(p.current_stage, 3);
});

test('progress store is append-only', () => {
  const first = appendProgressEvent([], { type:'LESSON_COMPLETED' });
  const second = appendProgressEvent(first, { type:'QUIZ_ATTEMPT' });
  assert.equal(first.length, 1);
  assert.equal(second.length, 2);
});

test('progress summary rewards no-trade learning events', () => {
  let events = [];
  events = appendProgressEvent(events, { type:'NO_TRADE_DECISION' });
  events = appendProgressEvent(events, { type:'JOURNAL_ENTRY' });
  const s = summarizeProgress(events);
  assert.equal(s.no_trade_decisions, 1);
  assert.equal(s.journal_entries, 1);
});

test('public passport is redacted', () => {
  const p = createPassport({ user_id:'sensitive-id', language_code:'zu' });
  const pub = redactPublicPassport(p);
  assert.equal('user_id' in pub, false);
  assert.equal(pub.brokerage_account, false);
});
