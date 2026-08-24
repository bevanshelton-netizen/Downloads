# NexTradeFinX V15 — Supabase Setup

This runbook activates learner authentication and persistence only. It does not enable brokerage, client funds, leverage, personalised advice or live execution.

1. Create a dedicated Supabase project named for NexTradeFinX.
2. In Authentication, require verified email for the controlled beta.
3. Configure only approved production and preview redirect URLs.
4. Run `db/001_learning_accounts.sql`.
5. Run `db/002_beta_consents.sql`.
6. Put only the project URL and public anon key in the public application environment.
7. Never place the service-role key in browser code, public hosting environment variables, GitHub, screenshots or chat.
8. Create two test users and prove RLS isolation: user A cannot read/update user B's passport, events, invites or consent receipts.
9. Test deletion-request creation as a learner; actual auth-user deletion must remain a server/admin operation.
10. Run the V15 activation test before inviting anyone.

Required public values:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_BETA_MODE=invite_only`
- `NEXT_PUBLIC_TERMS_VERSION`
- `NEXT_PUBLIC_PRIVACY_VERSION`
- `NEXT_PUBLIC_RISK_VERSION`

Required internal launch assertions:
- `RLS_ISOLATION_TEST_PASSED=true`
- `CONSENT_FLOW_TEST_PASSED=true`
- `ACCOUNT_DELETION_TEST_PASSED=true`

Hard-off product flags:
- `LIVE_EXECUTION_ENABLED=false`
- `CLIENT_FUNDS_ENABLED=false`
- `LEVERAGE_ENABLED=false`
- `PERSONALIZED_ADVICE_ENABLED=false`
- `BROKER_CONNECTIVITY_ENABLED=false`
