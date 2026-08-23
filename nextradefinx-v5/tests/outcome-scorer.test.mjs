import assert from 'node:assert/strict';
import { resolveForecastOutcome, scoreLedgerSnapshot, summarizeTrackRecord } from '../src/shadow/outcome-scorer.mjs';

const forecast = {
  forecast_id: 'f1', symbol: 'XAUUSD', created_at: '2026-08-20T00:00:00Z',
  last_market_timestamp: '2026-08-20T00:00:00Z', last_close: 100,
  decision: 'UP', probability_up: 0.7, provider: 'fixture-synthetic'
};
const bars = [
  { timestamp: '2026-08-20T00:00:00Z', close: 100 },
  { timestamp: '2026-08-21T00:00:00Z', close: 102 }
];
const outcome = resolveForecastOutcome({ forecast, bars, now: new Date('2026-08-22T00:00:00Z') });
assert.equal(outcome.observed_direction, 'UP');
assert.equal(outcome.directional_hit, true);
assert.equal(outcome.brier_score, 0.09);

const newOutcomes = scoreLedgerSnapshot({ records: [forecast], barsBySymbol: { XAUUSD: bars } });
assert.equal(newOutcomes.length, 1);
const duplicateProtected = scoreLedgerSnapshot({ records: [forecast, outcome], barsBySymbol: { XAUUSD: bars } });
assert.equal(duplicateProtected.length, 0);

const summary = summarizeTrackRecord([forecast, outcome]);
assert.equal(summary.forecasts, 1);
assert.equal(summary.outcomes, 1);
assert.equal(summary.directional_accuracy, 1);
assert.equal(summary.execution_enabled, false);
console.log('outcome-scorer.test: ok');
