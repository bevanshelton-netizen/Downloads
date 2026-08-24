# NexTradeFinX V14 — Beta Activation Kit

V14 turns the V12/V13 account and consent architecture into an explicit production activation gate.

It validates that the public Supabase configuration is present, policy versions are set, beta access remains invite-only, and all regulated/live-money capabilities remain hard-disabled.

A passing gate does not make NexTradeFinX a broker or adviser. It only means the education + paper-trading beta is technically eligible for controlled activation after the Supabase project, migrations, redirect URLs and RLS isolation tests are completed.

Run locally:

```bash
cd nextradefinx-v14
npm test
```
