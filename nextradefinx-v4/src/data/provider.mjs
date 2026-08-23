export class MarketDataProvider {
  constructor({ name, mode = 'historical' }) {
    this.name = name;
    this.mode = mode;
  }
  async fetchBars() {
    throw new Error('fetchBars_not_implemented');
  }
}

export function normalizeBars(rows, symbol = 'UNKNOWN') {
  if (!Array.isArray(rows)) throw new Error(`bars_not_array:${symbol}`);
  const normalized = rows.map((r, i) => {
    const timestamp = r.timestamp ?? r.datetime ?? r.t ?? r.date;
    const open = Number(r.open ?? r.o);
    const high = Number(r.high ?? r.h);
    const low = Number(r.low ?? r.l);
    const close = Number(r.close ?? r.c);
    const volume = Number(r.volume ?? r.v ?? 1);
    if (!timestamp || ![open, high, low, close, volume].every(Number.isFinite)) {
      throw new Error(`invalid_bar:${symbol}:${i}`);
    }
    return { timestamp: String(timestamp), open, high, low, close, volume };
  });
  normalized.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  return normalized;
}

export function requireSecret(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}
