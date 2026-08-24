# NexTradeFinX V12 — Secure Learner Accounts

V12 turns the V11 Learning Passport schema into a production-oriented authentication and persistence boundary.

## Adds
- Supabase Auth session guard
- safe return-path handling
- secret-safe environment validation
- Learning Passport repository scoped by authenticated user ID
- RLS-protected PostgreSQL schema
- append-only learner events and readiness snapshots
- privacy payload guard
- controlled public-beta launch checklist

## Hard boundaries
This release does not create brokerage accounts, KYC profiles, suitability assessments, client-money handling, personalized advice, leverage, broker connectivity or live execution.

Actual production authentication still requires a dedicated Supabase project and its public project URL/anon key. No credentials are committed.
