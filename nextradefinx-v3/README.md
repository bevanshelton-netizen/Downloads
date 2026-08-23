# NexTradeFinX V3 — Model Proof Research Lab

**Understand. Predict. Trade.**

This branch checkpoint advances NexTradeFinX from a simulated trading UX into a governed research architecture for the future NexAI prediction engine.

## What V3 adds

- deterministic synthetic OHLCV generator for pipeline validation
- transparent baseline ensemble using trend, momentum, mean-reversion and participation signals
- time-ordered walk-forward backtesting
- directional accuracy and high-confidence accuracy
- Brier probability score
- confidence calibration bins
- forecast coverage and research drawdown
- per-instrument model-health gates: `normal`, `watch`, `halted`
- explicit real-money gate: **closed**
- Model Proof dashboard that shows failed instruments instead of hiding them

## Current research result

The V3 test suite deliberately uses synthetic data. It validates the evaluation machinery; it does **not** claim a real-world trading edge.

The current overall model gate is **HALTED** because multiple instrument baselines fail the synthetic guardrails. This is the intended safety behaviour: NexAI should say “I don't know” or stop issuing directional forecasts when model health is weak.

## Non-negotiable boundary

No client funds, live execution or guaranteed-return claims are enabled. Production promotion requires licensed historical/live market data, leakage-resistant evaluation, independent research review, compliance sign-off, model monitoring and a regulated execution/custody architecture.

## Next engineering gate

Replace synthetic validation data with licensed historical datasets in a research-only environment, add data provenance and transaction-cost assumptions, run multi-regime walk-forward evaluation, then promote only models that survive the documented model-health thresholds into **live shadow mode**. Shadow mode means live predictions are recorded and scored, but no client trade depends on them.
