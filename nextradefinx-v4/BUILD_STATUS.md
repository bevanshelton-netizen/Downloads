# NexTradeFinX V4 — Shadow Track Record

Status: development shadow infrastructure complete; live data remains intentionally locked.

## Built
- Server-side market-data provider abstraction
- Twelve Data adapter
- Massive adapter
- Development-only fixture provider
- Shadow forecast engine gated by model health
- `NO_FORECAST` outcome for weak or halted models
- SHA-256 hash-chained append-only forecast ledger
- Ledger verification script
- V4 Shadow Track Record dashboard
- Tests for shadow forecasting and ledger integrity

## Safety boundary
- No client funds
- No live orders
- No execution
- No client-visible shadow predictions
- No live-market performance claim
- Non-fixture providers require explicit `ALLOW_LIVE_SHADOW=true` after commercial data rights and credentials are approved

## Next gate
1. Contract an approved commercial market-data provider.
2. Store API keys server-side.
3. Validate timestamps, entitlements, gaps, stale-data behavior and symbol mappings.
4. Run live shadow forecasts for an evidence period.
5. Score outcomes and calibration before considering any client-facing prediction feature.
