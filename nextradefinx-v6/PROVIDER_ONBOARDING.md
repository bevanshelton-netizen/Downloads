# NexTradeFinX — Market Data Provider Onboarding

Use this checklist before any real-provider shadow run.

- [ ] Commercial agreement identifies NexTradeFinX legal/customer entity.
- [ ] Internal model research/backtesting is permitted.
- [ ] Historical storage/retention rights are documented.
- [ ] Derived probabilities, model scores and AI explanations are permitted.
- [ ] Exact display/redistribution rights are documented separately from internal research rights.
- [ ] JSE/global instrument entitlements and delays are documented.
- [ ] Attribution requirements are documented.
- [ ] API rate limits and production support path are documented.
- [ ] Provider API key is stored only as a hosting secret; never in GitHub.
- [ ] `market-data-entitlements.json` is completed from the executed agreement.
- [ ] Provider health check passes expected symbols/timestamps.
- [ ] Data-quality gate passes freshness, monotonicity, duplicates and OHLC validation.
- [ ] Internal shadow ledger is verified before each run.
- [ ] `EXECUTION_ENABLED=false` remains enforced.
- [ ] `CLIENT_VISIBLE=false` remains enforced.
- [ ] `PERSONALIZED_ADVICE_ENABLED=false` remains enforced.

## Activation rule

Do not set `MARKET_DATA_LICENSE_APPROVED=true` from marketing copy, pricing pages or an assumption. Set it only after the executed contract/entitlement terms have been reviewed for the intended use.
