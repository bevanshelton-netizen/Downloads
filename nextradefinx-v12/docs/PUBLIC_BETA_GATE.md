# NexTradeFinX V12 — Controlled Public Beta Gate

A controlled education/paper-trading beta may open only when:

1. A dedicated Supabase project is provisioned for NexTradeFinX.
2. Email/password or passwordless authentication is configured with verified redirect URLs.
3. `db/001_secure_learning_accounts.sql` is applied and RLS is confirmed enabled.
4. A test user cannot read or mutate another test user's Learning Passport/events/snapshots.
5. Service-role credentials are server-only and are never exposed to the browser or GitHub.
6. Privacy notice and terms clearly state that the Learning Passport is educational, not a brokerage/KYC/advice account.
7. Account deletion removes learner records through `auth.users` cascade or a documented deletion workflow.
8. Rate limiting, abuse controls and email-confirmation policy are configured.
9. Live execution, client funds, personalized advice and broker adapters remain disabled.
10. Production monitoring and backup/recovery are configured before inviting external learners.

The public beta should begin as learning + paper trading only.
