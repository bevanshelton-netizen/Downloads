# KORA Production Automation

Phase 9 removes avoidable manual launch work while keeping destructive or billable external-service actions behind explicit credentials and confirmations.

## GitHub Environment

Create a GitHub Environment named `kora-production`. Put secrets in Environment Secrets and non-secret configuration in Environment Variables.

### Required secrets

- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — preferred public API key for new Supabase projects (`sb_publishable_...`)
- `SUPABASE_SECRET_KEY` — preferred server-only privileged API key for new Supabase projects (`sb_secret_...`)
- `SUPABASE_DB_URL` — direct Postgres connection string for the brand-new production database bootstrap only
- `CLOUDFLARE_STREAM_TOKEN`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `KORA_INTERNAL_API_SECRET` — long random server-only value, at least 32 characters
- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Legacy Supabase keys remain supported only as migration fallbacks: `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`. Do not configure them for a new KORA project unless a compatibility issue genuinely requires them.

### Required variables

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`
- `PAYFAST_SANDBOX` — `true` for private beta payment testing; `false` before public launch
- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_EMAIL`
- `NEXT_PUBLIC_RIGHTS_EMAIL`
- `KORA_LEGAL_APPROVED`
- `KORA_REGULATORY_APPROVED`
- `KORA_CHILD_SAFETY_APPROVED`
- `KORA_PAYOUT_OPERATIONS_APPROVED`
- `KORA_BACKUP_OPERATIONS_APPROVED`
- `KORA_INCIDENT_RESPONSE_APPROVED`

Do not store banking passwords, PINs, CVVs, OTPs or personal identity documents in GitHub variables or secrets.

## Workflows

### KORA Production DB Bootstrap

Use only for a brand-new Supabase production project. It requires the exact confirmation `BOOTSTRAP FRESH KORA DATABASE`, checks that `public.profiles` does not already exist, applies the fresh installer and migrations 006–014 in order, and verifies schema version 14.

It deliberately refuses an existing database rather than guessing whether older migrations have already run.

### KORA Bootstrap First Admin

After creating the owner email as a Supabase Auth user, run this workflow once. It refuses to proceed if any KORA administrator already exists.

### KORA Production Preflight

Runs migration inventory validation, TypeScript, production environment validation and the full Next.js build. This is a public-launch preflight: PayFast must be live and all legal, regulatory, child-safety, payout, backup and incident-response sign-offs must be true.

### KORA Deploy Private Beta

Requires the exact confirmation `DEPLOY KORA PRIVATE BETA`. It runs private-beta preflight, builds through Vercel, deploys production infrastructure, and smoke-tests `/api/health`, `/api/readiness`, `/api/version` and `/`.

Private beta may keep PayFast sandbox enabled and may keep public-launch approval gates false. It still requires the real Supabase database, current schema, first administrator, seeded live channel, PayFast credentials, Cloudflare Stream, reward-verification secret, operator identity and support contacts to be working. The database release state remains fail-closed, so anonymous public visitors stay on the coming-soon experience until an administrator deliberately enables public launch from `/admin/launch`.

### KORA Verify Public Launch

Runs against the configured public production URL and requires `/api/readiness` to return `productionReady=true`, `/api/version` to report schema 14 and the home page to be publicly accessible rather than redirected to `/coming-soon`.

## Public launch rule

Deployment is not the same as public launch. KORA can be deployed and privately tested while `public_launch_enabled=false`.

Before opening public access:

1. switch PayFast from sandbox to live and complete live verification;
2. complete the legal/regulatory/child-safety/payout/backup/incident-response sign-offs;
3. run **KORA Production Preflight** successfully;
4. open `/admin/launch` and enable public launch only after the server-side readiness gate is green;
5. run **KORA Verify Public Launch** and require it to pass.

The pornography and explicit-sexual-content prohibition remains unchanged throughout private beta and public operation.
