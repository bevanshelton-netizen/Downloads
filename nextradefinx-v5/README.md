# NexTradeFinX V5 — Scored Shadow Track Record

V5 closes the next evidence gap: a market forecast can now be recorded before the outcome exists and scored automatically when the next market bar arrives.

## What V5 adds

- provider timestamp normalization
- append-only forecast + outcome records
- duplicate-forecast prevention for the same market bar
- directional hit/miss scoring
- Brier scoring for probability quality
- abstention-rate tracking
- hash-ledger integrity verification
- secret-safe provider health checks
- three-key activation for any non-fixture live shadow run

## Three-key live shadow gate

A real provider remains locked unless all of these are true server-side:

- `ALLOW_LIVE_SHADOW=true`
- `MARKET_DATA_LICENSE_APPROVED=true`
- `LIVE_SHADOW_APPROVED=true`

The relevant API credential is also required.

Even after activation, `execution_enabled=false` and `client_visible=false` remain hard boundaries.

## Current evidence

The included chronological replay uses synthetic fixture data only. It proves the scoring and governance plumbing, not market edge. The current transparent baseline does **not** pass a credible edge threshold, so the gate remains closed.

That is intentional product behaviour: NexAI should refuse to promote a weak model.
