import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveLanguage } from '../src/languages.mjs';
import { buildExplanation } from '../src/explainability.mjs';
import { assessBehavior } from '../src/behavior-coach.mjs';
import { createPreTradeJournal, disciplineScore } from '../src/journal.mjs';

const forecast={symbol:'XAUUSD',decision:'UP',confidence:'moderate',probability_up:.64,probability_down:.36,why:['momentum positive'],could_be_wrong:['macro surprise']};

test('unknown language falls back to English',()=> assert.equal(resolveLanguage('xx').code,'en'));
test('Arabic resolves RTL',()=> assert.equal(resolveLanguage('ar').dir,'rtl'));
test('explanation preserves validated probabilities',()=> assert.equal(buildExplanation({forecast}).probability_up,.64));
test('directional explanation refuses missing probabilities',()=> assert.throws(()=>buildExplanation({forecast:{...forecast,probability_up:null}})));
test('NO_FORECAST rewards abstention lesson',()=> assert.match(buildExplanation({forecast:{...forecast,decision:'NO_FORECAST',probability_up:null,probability_down:null}}).lesson,/not to trade/i));
test('behavior coach halts revenge-risk pattern',()=>{ const r=assessBehavior({trades:[{pnl:-10,risk_pct:.5},{pnl:-10,risk_pct:.5},{pnl:-10,risk_pct:.5},{pnl:-10,risk_pct:1}]}); assert.equal(r.halted,true); });
test('journal blocks practice risk above 1 percent',()=> assert.throws(()=>createPreTradeJournal({symbol:'X',thesis:'x',invalidation:'y',risk_pct:2})));
test('discipline score rewards plan-following and abstention',()=>{const pre={risk_pct:.5};const post={followed_plan:true,lesson:'I followed my risk plan.'};assert.equal(disciplineScore({pre,post,decision:'NO_TRADE'}),100)});
