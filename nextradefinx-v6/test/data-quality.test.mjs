import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBars } from '../src/data-quality.mjs';

function bars(count, endMs) {
  return Array.from({ length: count }, (_, i) => {
    const ts = new Date(endMs - (count - 1 - i) * 60_000).toISOString();
    return { timestamp: ts, open: 100+i, high: 101+i, low: 99+i, close: 100.5+i };
  });
}

test('passes a fresh monotonic series', () => {
  const now = new Date('2026-08-23T19:30:00Z');
  const result = checkBars({ bars: bars(120, now.getTime() - 60_000), now, maxStalenessSeconds: 300, minBars: 120 });
  assert.equal(result.ok, true);
});

test('rejects stale data', () => {
  const now = new Date('2026-08-23T19:30:00Z');
  const result = checkBars({ bars: bars(120, now.getTime() - 3600_000), now, maxStalenessSeconds: 300, minBars: 120 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(x => x.startsWith('stale_data:')));
});

test('rejects duplicate timestamps', () => {
  const now = new Date('2026-08-23T19:30:00Z');
  const sample = bars(120, now.getTime() - 60_000);
  sample[60].timestamp = sample[59].timestamp;
  const result = checkBars({ bars: sample, now, maxStalenessSeconds: 300, minBars: 120 });
  assert.equal(result.ok, false);
  assert.ok(result.issues.some(x => x.startsWith('duplicate_timestamp:')));
});
