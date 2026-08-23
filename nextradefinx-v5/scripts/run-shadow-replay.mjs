import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { generateSyntheticOHLCV } from '../src/research/dataset.mjs';
import { normalizeBars } from '../src/data/provider.mjs';
import { createShadowForecast } from '../src/shadow/shadow-engine.mjs';
import { resolveForecastOutcome, summarizeTrackRecord } from '../src/shadow/outcome-scorer.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const report = JSON.parse(await readFile(resolve(ROOT, 'data/research-report.json'), 'utf8'));
const symbols = Object.keys(report.instruments || {});
const perInstrument = {};
const allRecords = [];

for (const symbol of symbols) {
  const raw = generateSyntheticOHLCV(symbol, 760, 20260825);
  const bars = normalizeBars(raw.map(r => ({ ...r, timestamp: r.ts })), symbol);
  const records = [];
  for (let i = 620; i < bars.length - 1; i++) {
    const history = bars.slice(0, i + 1);
    const now = new Date(history.at(-1).timestamp);
    const forecast = createShadowForecast({
      symbol,
      bars: history,
      researchMetrics: report.instruments[symbol].metrics,
      providerName: 'fixture-synthetic',
      now
    });
    forecast.record_type = 'FORECAST';
    const outcome = resolveForecastOutcome({ forecast, bars: bars.slice(0, i + 2), now: new Date(bars[i + 1].timestamp) });
    records.push(forecast);
    if (outcome) records.push(outcome);
  }
  perInstrument[symbol] = summarizeTrackRecord(records);
  allRecords.push(...records);
}

const output = {
  version: '0.5.0',
  mode: 'synthetic_chronological_shadow_replay',
  generated_at: new Date().toISOString(),
  per_instrument: perInstrument,
  overall: summarizeTrackRecord(allRecords),
  execution_enabled: false,
  client_visible: false,
  claim_boundary: 'Synthetic chronological replay only. This validates scoring plumbing and is not live-market evidence.'
};
await writeFile(resolve(ROOT, 'data/shadow-replay-summary.json'), JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
