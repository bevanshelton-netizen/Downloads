# KORA Production Deployment

## Recommended production topology

- Web application: Vercel, deployed from `bevanshelton-netizen/Downloads` with Root Directory `kora-network`.
- Database, authentication and server data: Supabase.
- Video ingest, private playback and live HLS delivery: Cloudflare Stream or another compatible HLS origin.
- Payments and recurring billing: PayFast.
- Source of truth: GitHub `main`.

## 1. Supabase

Create a dedicated production Supabase project.

### Brand-new production project: easiest path

Open the Supabase SQL Editor, paste the complete contents of `supabase/000_fresh_install.sql`, and run it once. That installer applies the entire KORA schema through migration 009 inside one transaction. Do not run it after any individual KORA migration has already been applied.

### Existing/staged project: sequential path

Apply only migrations that have not already run, in this order:

1. `supabase/schema.sql`
2. `supabase/002_platform_core.sql`
3. `supabase/003_payment_hardening.sql`
4. `supabase/004_content_commerce.sql`
5. `supabase/005_payouts.sql`
6. `supabase/006_broadcast_rewards.sql`
7. `supabase/007_trust_rights.sql`
8. `supabase/008_launch_hardening.sql`
9. `supabase/009_subscription_lifecycle.sql`

Configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to browser code or commit it to Git.

### Supabase Auth URL configuration

In Supabase Authentication URL Configuration:

- Site URL: the final value of `NEXT_PUBLIC_APP_URL`.
- Add `${NEXT_PUBLIC_APP_URL}/auth/callback` to allowed Redirect URLs.
- Also allow `${NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password` for password recovery.

New-account confirmation uses the server callback at `/auth/callback`; password recovery uses the same callback and then sends the user to `/reset-password`.

## 2. Vercel and operational checks

Import the GitHub repository with:

- Production Branch: `main`
- Root Directory: `kora-network`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install --no-audit --no-fund`

Set `NEXT_PUBLIC_APP_URL` to the final HTTPS production origin without a trailing slash.

KORA exposes two non-secret operational endpoints:

- `GET /api/health`: liveness. A running app returns HTTP 200 and `status: "ok"`.
- `GET /api/readiness`: strict go-live gate. It verifies production configuration and confirms that required Supabase tables/columns from the final migrations are actually queryable. It returns HTTP 200 with `productionReady: true` only when all gates pass.

Sandbox PayFast, mock video, an incomplete database schema, missing operator contacts, missing reward-verifier secret, or unapproved legal/regulatory gates intentionally return HTTP 503 from readiness.

## 3. Public operator identity and legal approval

Configure real approved values:

- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_EMAIL`
- `NEXT_PUBLIC_RIGHTS_EMAIL`

The legal pages intentionally show draft status until `KORA_LEGAL_APPROVED=true`. Do not enable that flag until the published Terms, Privacy Notice, Creator Agreement, Advertiser Terms, copyright/rights process, content rules and refund/cancellation terms have been professionally reviewed for the operating entity.

Keep `KORA_REGULATORY_APPROVED=false` until KORA's South African regulatory position—including FPB online-distribution/classification requirements and POPIA operations—has been reviewed and required registrations, approvals and processes are in place. See `LEGAL_REVIEW.md`.

## 4. PayFast subscriptions and pay-per-view

Start with:

- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_SANDBOX=true`

KORA supports:

- monthly recurring Premium and Premium Plus membership checkouts;
- recurring PayFast token capture from verified ITNs;
- self-service cancellation of future renewals while preserving access through the already-paid period;
- one-time pay-per-view title unlocks;
- amount, merchant and ITN signature validation;
- idempotent revenue-event recording for successful provider payments.

Subscription callbacks generated from `NEXT_PUBLIC_APP_URL`:

- Return: `/account?payment=success`
- Cancel: `/account?payment=cancelled`
- ITN: `/api/payfast/notify`

Pay-per-view uses `/account?purchase=success` and `/account?purchase=cancelled`, with the same secure ITN endpoint.

Before live mode, run a real sandbox membership, recurring-token cancellation test and pay-per-view purchase. After acceptance, replace credentials with live merchant values and set `PAYFAST_SANDBOX=false`.

## 5. Cloudflare Stream and live television

For real creator uploads set:

- `VIDEO_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Use a token restricted to the minimum Stream permissions KORA needs. Direct uploads are created server-side and playback is private/signed. `VIDEO_PROVIDER=mock` is allowed only during development and fails the production readiness gate.

Authorised staff connect live HLS channel URLs and programme the guide from `/admin/schedule`. Schedule entry is in CAT, storage is UTC and the public guide renders in CAT.

## 6. Creator agreements, moderation and rights

A creator must accept the current versioned Creator Agreement before production creation. Each production records declarations covering ownership/control, contributors, music, likeness and content-policy compliance.

Creators cannot write privileged role, verification, KYC, publication, moderation or playback fields through the browser. Publication state changes are server-controlled. Viewers can report safety/content concerns from a watch page; moderators can resolve those reports. Admins have a rights-dispute register for copyright, performer, music and distribution-rights cases.

Changing the Creator Agreement version in `lib/legal.ts` automatically requires the new version before another production can be created.

## 7. Revenue, rewards, creator earnings and payouts

Generate a long random `KORA_INTERNAL_API_SECRET` and keep it server-only. Trusted ad-verification infrastructure calls `/api/internal/ads/verify` using the `x-kora-internal-secret` header.

The money controls deliberately separate:

1. cleared revenue;
2. funded viewer reward pools;
3. verified ad completions and one-time reward claims;
4. creator revenue-share allocations;
5. wallet balances and KYC-gated payout requests.

The client never chooses a reward amount. A verified event cannot be paid twice. Campaign funding is cumulative but cannot exceed budget/reward caps. Creator allocations and viewer reward funding are checked against the same cleared revenue event so combined allocations cannot exceed money actually cleared. Direct payout-request inserts are blocked; payouts must use the KYC/minimum/balance-enforcing database function.

## 8. Production smoke test

Run this sequence after the first production deployment:

1. `/api/health` returns HTTP 200 and `status: "ok"`.
2. During setup `/api/readiness` remains HTTP 503 and shows only non-secret incomplete checks.
3. Confirm `/api/readiness` reports `databaseSchema: true` after migrations 001-009 are present.
4. Create a viewer account, confirm the email through `/auth/callback`, sign in, sign out and complete password recovery.
5. Confirm a user cannot self-promote `profiles.role`, approve their own KYC, mark a creator verified, self-publish a production or directly write episode playback/publication state.
6. Confirm the current Creator Agreement must be accepted and production rights declarations must be complete before production creation.
7. Add an episode, upload its video, submit for review, approve as moderator and verify private playback.
8. Submit a viewer content report and resolve it in moderation.
9. Record and resolve a test rights dispute in `/admin/rights`.
10. Complete a PayFast sandbox monthly membership; confirm only a valid ITN activates it and each provider payment creates one revenue event.
11. Cancel future renewal from My KORA; confirm PayFast recurring billing is cancelled while access remains through `current_period_end`.
12. Complete a pay-per-view purchase; confirm the title remains locked until a valid ITN and unlocks afterward.
13. Create an advertiser campaign; confirm the advertiser cannot self-activate it or exceed budget/reward caps.
14. Connect a test HLS stream and verify live playback and overlapping-schedule rejection.
15. Confirm an unverified ad event cannot pay; confirm a verified completion pays only from cleared funded reward balance and cannot be claimed twice.
16. Confirm repeated campaign funding remains within cumulative caps.
17. Allocate a creator share from cleared revenue and confirm creator earnings plus viewer funding cannot exceed that cleared revenue.
18. Confirm direct payout inserts fail; confirm the payout RPC blocks unverified KYC, sub-R100 payouts and balances that are too low.
19. Confirm the pornography/explicit-sexual-content database and moderation controls remain enforced.
20. Confirm public legal pages use real approved operator/contact data and show no draft warning before launch.

## 9. Go-live gate

Do not market KORA as fully operational until all are true:

- production Supabase is migrated, backed up and `databaseSchema` passes readiness;
- RLS plus the launch column-privilege restrictions are tested;
- Cloudflare private upload/playback works;
- at least one live HLS channel and programme guide pass device testing;
- PayFast membership, recurring cancellation, ITN and pay-per-view pass sandbox end-to-end;
- admin/moderator access is assigned deliberately, not by public self-registration;
- KYC/payout operations have an accountable owner;
- rewards, creator allocations and payout controls pass duplicate/concurrency/over-allocation testing;
- legal acceptance, rights provenance, viewer reports and rights-dispute workflows pass end-to-end;
- public operator identity and monitored support/privacy/rights contacts are real;
- `KORA_LEGAL_APPROVED=true` only after professional legal review;
- `KORA_REGULATORY_APPROVED=true` only after the required regulatory position is confirmed and implemented;
- monitoring, error logging and database backup procedures are active.

After sandbox acceptance, switch PayFast live, set `VIDEO_PROVIDER=cloudflare`, set the final HTTPS domain in `NEXT_PUBLIC_APP_URL`, redeploy, and require `GET /api/readiness` to return HTTP 200 with `productionReady: true`. Repeat payment, playback, live-channel and reward smoke tests once more before public launch.
