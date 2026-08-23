import { MarketDataProvider, normalizeBars, requireSecret } from './provider.mjs';

const TICKERS = {
  EURUSD: 'C:EURUSD', USDZAR: 'C:USDZAR', BTCUSD: 'X:BTCUSD', SPX: 'I:SPX'
};

function dateOnly(d) { return d.toISOString().slice(0, 10); }

export class MassiveProvider extends MarketDataProvider {
  constructor() { super({ name: 'massive' }); }

  async fetchBars({ symbol, days = 700 }) {
    const apiKey = requireSecret('MASSIVE_API_KEY');
    const ticker = TICKERS[symbol];
    if (!ticker) throw new Error(`massive_symbol_not_mapped:${symbol}`);
    const to = new Date();
    const from = new Date(to.getTime() - days * 86400000);
    const url = new URL(`https://api.massive.com/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${dateOnly(from)}/${dateOnly(to)}`);
    url.searchParams.set('adjusted', 'true');
    url.searchParams.set('sort', 'asc');
    url.searchParams.set('limit', '50000');
    url.searchParams.set('apiKey', apiKey);
    const response = await fetch(url, { headers: { 'User-Agent': 'NexTradeFinX-Shadow/0.4' } });
    if (!response.ok) throw new Error(`massive_http_${response.status}`);
    const json = await response.json();
    if (json.status === 'ERROR') throw new Error(`massive:${json.error || 'unknown'}`);
    const rows = (json.results || []).map(r => ({
      timestamp: new Date(r.t).toISOString(), open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v ?? 1
    }));
    return normalizeBars(rows, symbol);
  }
}
