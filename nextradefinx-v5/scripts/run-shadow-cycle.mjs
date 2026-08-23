import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FixtureProvider } from '../src/data/fixture.mjs';
import { TwelveDataProvider } from '../src/data/twelve-data.mjs';
import { MassiveProvider } from '../src/data/massive.mjs';
import { assertLiveShadowPolicy } from '../src/data/provider-policy.mjs';
import { createShadowForecast } from '../src/shadow/shadow-engine.mjs';
import { appendLedger, readLedger, verifyLedger } from '../src/shadow/audit-ledger.mjs';
import { scoreLedgerSnapshot, summarizeTrackRecord } from '../src/shadow/outcome-scorer.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const providerName = process.env.MARKET_DATA_PROVIDER || 'fixture';
const providers = { fixture: FixtureProvider, twelve: TwelveDataProvider, massive: MassiveProvider };
const Provider = providers[providerName];
if (!Provider) throw new Error(`unknown_provider:${providerName}`);
assertLiveShadowPolicy(providerName);

const report = JSON.parse(await readFile(resolve(ROOT, 'data/research-report.json'), 'utf8'));
const instruments = (process.env.SHADOW_INSTRUMENTS || 'XAUUSD,USDZAR,US100,SPX,BTCUSD,WTI,J200,EURUSD')
  .split(',').map(s => s.trim()).filter(Boolean);
const ledgerPath = process.env.SHADOW_LEDGER_PATH || resolve(ROOT, 'data/shadow-ledger-v5.jsonl');
const summaryPath = process.env.SHADOW_SUMMARY_PATH || resolve(ROOT, 'data/shadow-summary-v5.json');
const provider = new Provider();

const before = await verifyLedger(ledgerPath);
if (!before.valid) throw new Error(`ledger_integrity_failed_at:${before.index}`);

const barsBySymbol = {};
const providerErrors = [];
for (const symbol of instruments) {
  try {
    barsBySymbol[symbol] = await provider.fetchBars({ symbol, interval: process.env.SHADOW_INTERVAL || '1day', outputsize: 700 });
  } catch (error) {
    providerErrors.push({ symbol, error: error.message });
  }
}

let records = await readLedger(ledgerPath);
const outcomes = scoreLedgerSnapshot({ records, barsBySymbol, now: new Date() });
for (const outcome of outcomes) await appendLedger(ledgerPath, outcome);
records = await readLedger(ledgerPath);

const newForecasts = [];
const skipped = [];
for (const symbol of instruments) {
  const bars = barsBySymbol[symbol];
  if (!bars) continue;
  const latestMarketTimestamp = bars.at(-1)?.timestamp;
  const lastForecast = [...records].reverse().find(r => r.record_type !== 'OUTCOME' && r.symbol === symbol && r.forecast_id);
  if (lastForecast?.last_market_timestamp === latestMarketTimestamp) {
    skipped.push({ symbol, reason: 'already_forecast_latest_bar', market_timestamp: latestMarketTimestamp });
    continue;
  }
  const researchMetrics = report.instruments?.[symbol]?.metrics;
  try {
    const forecast = createShadowForecast({ symbol, bars, researchMetrics, providerName: provider.name });
    forecast.record_type = 'FORECAST';
    newForecasts.push(await appendLedger(ledgerPath, forecast));
  } catch (error) {
    providerErrors.push({ symbol, error: error.message });
  }
}

records = await readLedger(ledgerPath);
const verification = await verifyLedger(ledgerPath);
const trackRecord = summarizeTrackRecord(records);
const summary = {
  version: '0.5.0',
  mode: providerName === 'fixture' ? 'development_fixture_cycle' : 'licensed_live_shadow_cycle',
  generated_at: new Date().toISOString(),
  provider: provider.name,
  provider_errors: providerErrors,
  newly_scored_outcomes: outcomes.length,
  newly_recorded_forecasts: newForecasts.length,
  skipped,
  ledger: verification,
  track_record: trackRecord,
  execution_enabled: false,
  client_visible: false,
  claim_boundary: providerName === 'fixture'
    ? 'Development fixture cycle only; no live-market performance claim.'
    : 'Live shadow research only; not a client signal and not evidence of future returns.'
};
await writeFile(summaryPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
