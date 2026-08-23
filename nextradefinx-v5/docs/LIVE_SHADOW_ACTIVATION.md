# NexTradeFinX V5 — Live Shadow Activation

Live shadow mode is designed to observe real markets without placing trades or exposing predictions to clients.

## Three-key activation gate

A non-fixture provider will not run unless all three server-side controls are explicitly set:

- `ALLOW_LIVE_SHADOW=true`
- `MARKET_DATA_LICENSE_APPROVED=true`
- `LIVE_SHADOW_APPROVED=true`

The provider API key is also required (`TWELVE_DATA_API_KEY` or `MASSIVE_API_KEY`).

## Before setting the three keys

1. Execute the commercial market-data agreement for the intended use.
2. Confirm whether display, redistribution, derived data, delayed data and historical storage are permitted.
3. Record the approved instruments and entitlements.
4. Keep credentials server-side only.
5. Run the provider health check and confirm expected symbols and timestamps.
6. Start shadow mode with no client visibility and no execution integration.
7. Accumulate outcomes and calibration evidence before any product claim.

## Non-negotiable boundary

V5 cannot place an order. `execution_enabled` and `client_visible` remain false in forecast and outcome records. Live shadow approval is not approval for investment advice or real-money trading.
