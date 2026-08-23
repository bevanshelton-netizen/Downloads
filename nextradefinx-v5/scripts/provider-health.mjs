import { FixtureProvider } from '../src/data/fixture.mjs';
import { TwelveDataProvider } from '../src/data/twelve-data.mjs';
import { MassiveProvider } from '../src/data/massive.mjs';
import { assertLiveShadowPolicy, publicProviderConfig } from '../src/data/provider-policy.mjs';

const providerName = process.env.MARKET_DATA_PROVIDER || 'fixture';
const providers = { fixture: FixtureProvider, twelve: TwelveDataProvider, massive: MassiveProvider };
const Provider = providers[providerName];
if (!Provider) throw new Error(`unknown_provider:${providerName}`);
assertLiveShadowPolicy(providerName);

const instruments = (process.env.SHADOW_INSTRUMENTS || 'XAUUSD,USDZAR,US100,SPX,BTCUSD,WTI,J200,EURUSD')
  .split(',').map(s => s.trim()).filter(Boolean);
const provider = new Provider();
const checks = [];

for (const symbol of instruments) {
  try {
    const bars = await provider.fetchBars({ symbol, interval: process.env.SHADOW_INTERVAL || '1day', outputsize: 120 });
    const last = bars.at(-1);
    checks.push({ symbol, ok: bars.length >= 80, bars: bars.length, last_market_timestamp: last?.timestamp || null });
  } catch (error) {
    checks.push({ symbol, ok: false, error: error.message });
  }
}

console.log(JSON.stringify({
  ...publicProviderConfig(providerName),
  provider_runtime_name: provider.name,
  checked_at: new Date().toISOString(),
  checks,
  secrets_echoed: false
}, null, 2));
