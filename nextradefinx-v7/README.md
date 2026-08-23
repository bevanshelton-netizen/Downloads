# NexTradeFinX V7 — Trust & Operations Gate

V7 strengthens the internal live-shadow system before any real market forecast can be exposed to clients.

## Added
- provider entitlement manifest and readiness checker
- OHLC/timestamp/freshness data-quality validation
- circuit breaker for provider, data-quality and ledger-integrity failures
- statistical evidence gate using sample size, Brier improvement, calibration and a Wilson confidence bound
- public-safe operations status command
- hard boundaries keeping execution, client visibility and personalized advice disabled

## Principle
A model is not promoted because it looks impressive. It must accumulate enough real shadow evidence, beat a naive benchmark on probability quality, remain calibrated and show statistically supported directional performance. Even then, the result is only eligible for internal human review.
