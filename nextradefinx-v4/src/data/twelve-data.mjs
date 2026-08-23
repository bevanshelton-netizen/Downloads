import { MarketDataProvider, normalizeBars, requireSecret } from './provider.mjs';

const SYMBOLS = {
  XAUUSD: 'XAU/USD', USDZAR: 'USD/ZAR', EURUSD: 'EUR/USD', BTCUSD: 'BTC/USD',
  SPX: 'SPX', US100: 'NDX'
};

export class TwelveDataProvider extends MarketDataProvider {
  constructor() { super({ name: 'twelve-data' }); }

  async fetchBars({ symbol, interval = '1day', outputsize = 500 }) {
    const apiKey = requireSecret('TWELVE_DATA_API_KEY');
    const mapped = SYMBOLS[symbol] || symbol;
    const url = new URL('https://api.twelvedata.com/time_series');
    url.searchParams.set('symbol', mapped);
    url.searchParams.set('interval', interval);
    url.searchParams.set('outputsize', String(outputsize));
    url.searchParams.set('order', 'ASC');
    url.searchParams.set('apikey', apiKey);
    const response = await fetch(url, { headers: { 'User-Agent': 'NexTradeFinX-Shadow/0.4' } });
    if (!response.ok) throw new Error(`twelve_data_http_${response.status}`);
    const json = await response.json();
    if (json.status === 'error') throw new Error(`twelve_data:${json.code || 'error'}:${json.message || 'unknown'}`);
    return normalizeBars(json.values || [], symbol);
  }
}
