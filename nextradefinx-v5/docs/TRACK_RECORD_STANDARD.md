# NexTradeFinX Shadow Track Record Standard

The shadow ledger is append-only and hash chained. Forecasts are written before outcomes are known. Outcomes are appended as separate records; historical forecasts are never edited to make results look better.

For every eligible forecast the system records:

- timestamp and market timestamp
- provider
- model family
- decision or abstention
- probability up/down
- confidence and model-health status
- last observed market price
- feature snapshot

When the next market bar becomes available, a separate outcome record adds:

- observed direction
- realized return
- directional hit/miss for directional calls
- Brier score for the probability forecast
- outcome market timestamp

The public-facing product must distinguish between backtests, shadow performance and any future live performance. No synthetic or fixture result may be represented as live-market evidence.
