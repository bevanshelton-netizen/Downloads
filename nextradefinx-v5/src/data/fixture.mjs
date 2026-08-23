import { MarketDataProvider, normalizeBars } from './provider.mjs';
import { generateSyntheticOHLCV } from '../research/dataset.mjs';

export class FixtureProvider extends MarketDataProvider {
  constructor() { super({ name: 'fixture-synthetic', mode: 'development-only' }); }
  async fetchBars({ symbol, outputsize = 500 }) {
    const rows = generateSyntheticOHLCV(symbol, Math.max(120, outputsize), 20260824);
    // The research generator uses `ts`; normalize it to the provider contract's `timestamp`.
    return normalizeBars(rows.map(row => ({ ...row, timestamp: row.ts })), symbol);
  }
}
