# NexTradeFinX V6 — Live Shadow Readiness

V6 prepares the evidence engine for real licensed market data without enabling client signals or trading.

## What V6 adds

- provider-entitlement manifest
- secret-safe environment contract
- market-data quality gate
- freshness, duplicate, gap and timestamp checks
- activation readiness report
- hard separation between internal shadow research and client-facing product

## Safety boundary

These remain hard-disabled in V6:

- `execution_enabled=false`
- `client_visible=false`
- `personalized_advice_enabled=false`

A live provider may run only when all of the following are true server-side:

1. `ALLOW_LIVE_SHADOW=true`
2. `MARKET_DATA_LICENSE_APPROVED=true`
3. `LIVE_SHADOW_APPROVED=true`
4. provider credential exists
5. entitlement manifest approves the requested instruments/use
6. data-quality checks pass

## Goal

The next real milestone is not 'go live'. It is to start an auditable, internal, real-market shadow record under explicit data rights. Only after enough evidence exists should any client-facing prediction feature be considered.
