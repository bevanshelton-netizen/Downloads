# NexTradeFinX Research Standard v0.3

## Objective

NexAI may expose directional market probabilities only when the underlying model family has passed documented research and model-health gates for the relevant instrument and horizon.

## Current stage

V3 validates the research infrastructure with deterministic synthetic OHLCV data. No live-market performance claim is permitted from this report.

## Required metrics

Every evaluation must publish sample size, directional accuracy, high-confidence directional accuracy, Brier score, calibration by confidence band, forecast coverage, research drawdown, model version, dataset provenance, evaluation period, and transaction-cost assumptions once execution research begins.

## Walk-forward requirement

Production research must use time-ordered walk-forward or equivalent leakage-resistant evaluation. Random train/test shuffling is not acceptable for time-series performance claims.

## No-trade gate

The system must be able to return no-trade for inadequate confidence, failed model-health thresholds, stale/incomplete data, unsupported market regimes, event-risk overrides, or unresolved data-quality incidents.

## Promotion to live shadow mode

A candidate model may move from research to live shadow mode only after licensed historical data is integrated, dataset provenance is recorded, leakage tests pass, performance survives multiple regimes, calibration is acceptable, model-health thresholds are approved, independent review signs off the methodology, and no client funds or live execution depend on the candidate model.

## Promotion to client-facing intelligence

This is a separate approval stage requiring financial-services legal/compliance review, disclosure wording, suitability boundaries, jurisdiction controls, monitoring, rollback procedures and incident response.
