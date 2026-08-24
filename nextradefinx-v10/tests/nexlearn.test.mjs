import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { calculateReadiness, determineStage } from '../src/learning/readiness-engine.mjs';
import { gradeQuiz, masteryRecommendation } from '../src/learning/quiz-engine.mjs';
import { createLearnerProfile, applyLearningEvent } from '../src/learning/profile-engine.mjs';
import { assertPracticeOnlySession, nextLearningAction } from '../src/learning/simulation-gate.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'config/learning-path.json'), 'utf8'));

test('beginner profile starts safely', () => {
  const p = createLearnerProfile({ learner_id: 'demo', language: 'zu' });
  assert.equal(p.simulations_completed, 0);
  assert.equal(p.discipline_score, 100);
});

test('learning events update profile', () => {
  let p = createLearnerProfile({ learner_id: 'demo' });
  p = applyLearningEvent(p, { type: 'SIMULATION_COMPLETED' });
  p = applyLearningEvent(p, { type: 'QUIZ_AVERAGE', value: 82 });
  assert.equal(p.simulations_completed, 1);
  assert.equal(p.quiz_average_pct, 82);
});

test('quiz engine identifies missed concepts', () => {
  const r = gradeQuiz({ questions:[
    {id:1,correct_answer:'b',concept_key:'risk'},
    {id:2,correct_answer:'a',concept_key:'spread'}
  ], answers:['b','x'] });
  assert.equal(r.score_pct, 50);
  assert.deepEqual(r.missed_concepts, ['spread']);
  assert.equal(masteryRecommendation(r), 'RELEARN_AND_RETRY');
});

test('weak learner cannot become practice ready', () => {
  const r = calculateReadiness({lesson_completion_pct:90,quiz_average_pct:72,discipline_score:80,journal_completion_pct:80,simulations_completed:25,daily_loss_breaches:0,oversized_trade_attempts:0}, config.practice_ready_policy);
  assert.equal(r.practice_ready, false);
  assert.ok(r.blockers.includes('quiz_mastery_below_threshold'));
});

test('disciplined learner can become practice ready', () => {
  const r = calculateReadiness({lesson_completion_pct:92,quiz_average_pct:88,discipline_score:86,journal_completion_pct:82,simulations_completed:25,daily_loss_breaches:0,oversized_trade_attempts:0}, config.practice_ready_policy);
  assert.equal(r.practice_ready, true);
  assert.equal(r.execution_mode, 'paper_only');
});

test('stage progression reaches practice ready only with mastery', () => {
  const stage = determineStage({lesson_completion_pct:90,quiz_average_pct:85,simulations_completed:24}, config.stages);
  assert.equal(stage.key, 'practice_ready');
});

test('simulation gate rejects live execution', () => {
  const r = assertPracticeOnlySession({account_mode:'live',execution_enabled:true,client_funds_connected:true});
  assert.equal(r.allowed, false);
  assert.ok(r.blockers.includes('live_execution_forbidden'));
});

test('simulation gate permits paper-only learning', () => {
  const r = assertPracticeOnlySession({account_mode:'paper',execution_enabled:false,client_funds_connected:false,personalized_advice_enabled:false,leverage_enabled:false});
  assert.equal(r.allowed, true);
});

test('next action sends weak risk behavior to coach review', () => {
  const action = nextLearningAction({readiness:{practice_ready:false,blockers:['discipline_score_below_threshold']}});
  assert.equal(action, 'RISK_COACH_REVIEW');
});
