export function checkBars({ bars, now = new Date(), maxStalenessSeconds = 1800, minBars = 120 }) {
  const issues = [];
  if (!Array.isArray(bars)) return { ok: false, issues: ['bars_not_array'] };
  if (bars.length < minBars) issues.push(`insufficient_bars:${bars.length}`);

  let previous = null;
  const seen = new Set();
  for (const bar of bars) {
    const ts = Date.parse(bar.timestamp);
    if (!Number.isFinite(ts)) { issues.push('invalid_timestamp'); continue; }
    if (seen.has(ts)) issues.push(`duplicate_timestamp:${bar.timestamp}`);
    seen.add(ts);
    if (previous !== null && ts <= previous) issues.push(`non_monotonic_timestamp:${bar.timestamp}`);
    previous = ts;
    for (const field of ['open','high','low','close']) {
      if (!Number.isFinite(Number(bar[field]))) issues.push(`invalid_${field}:${bar.timestamp}`);
    }
    if (Number(bar.high) < Number(bar.low)) issues.push(`high_below_low:${bar.timestamp}`);
  }

  const lastTs = bars.length ? Date.parse(bars.at(-1).timestamp) : NaN;
  const stalenessSeconds = Number.isFinite(lastTs) ? Math.max(0, (now.getTime() - lastTs) / 1000) : null;
  if (stalenessSeconds === null) issues.push('missing_last_timestamp');
  else if (stalenessSeconds > maxStalenessSeconds) issues.push(`stale_data:${Math.round(stalenessSeconds)}s`);

  return {
    ok: issues.length === 0,
    bars: bars.length,
    first_timestamp: bars[0]?.timestamp || null,
    last_timestamp: bars.at(-1)?.timestamp || null,
    staleness_seconds: stalenessSeconds,
    issues: [...new Set(issues)]
  };
}
