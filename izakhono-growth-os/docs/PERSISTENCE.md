# Growth OS Persistence Package

Growth OS deliberately keeps live event ingestion disabled until it has its own dedicated persistence project.

## Database boundary

Use a **dedicated** Supabase/Postgres project for Growth OS. Do not mix the marketing attribution store into FAISReady or another product database.

The migration in `database/001_growth_os_core.sql` creates a private `growth_os` schema containing:

- canonical growth events;
- encrypted provider connection metadata;
- approval records;
- activity ledger;
- conversion mappings.

The schema revokes access from `public`, `anon`, and `authenticated`, and enables/forces RLS as defense in depth. No browser should write these tables directly.

## Vercel runtime connection

For serverless traffic, configure `MEASUREMENT_DATABASE_URL` with the Supabase **transaction pooler** connection (port 6543), not a direct IPv6-only connection.

Runtime connections must disable prepared statements when using transaction pooling.

## Secrets

Server-only:
- `MEASUREMENT_DATABASE_URL`
- `MEASUREMENT_INGEST_KEY`
- `OAUTH_TOKEN_ENCRYPTION_KEY`

Never prefix these with `NEXT_PUBLIC_`.

## Activation sequence

1. Create the dedicated Growth OS project.
2. Apply and verify the migration.
3. Run Supabase security/performance advisors.
4. Configure the transaction-pooler database URL in Vercel.
5. Configure ingestion and token-vault secrets.
6. Enable the runtime persistence adapter.
7. Submit a synthetic test event.
8. Verify that duplicate `event_id` values cannot create duplicate business events.
9. Keep automatic budget optimization OFF until real lead/revenue data has accumulated and reconciled.
