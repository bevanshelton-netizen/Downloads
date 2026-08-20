# KORA Production Deployment

KORA is designed to fail closed. A successful Next.js deployment is **not** the same as a public launch. Public launch is allowed only after infrastructure, database, money, legal, safety and operating-process gates pass and an administrator deliberately enables the release switch in `/admin/launch`.

## Production topology

- Web: Vercel, repository `bevanshelton-netizen/Downloads`, Root Directory `kora-network`, production branch `main`.
- Database/auth: Supabase.
- Video: Cloudflare Stream plus HTTPS HLS live feeds.
- Payments: PayFast recurring subscriptions plus one-time pay-per-view.
- Payout/KYC: approved external operating process/provider. KORA never stores banking passwords, PINs, CVVs or OTPs.

## 1. Database migrations

On a production Supabase project apply, in order:

1. `supabase/schema.sql`
2. `supabase/002_platform_core.sql`
3. `supabase/003_payment_hardening.sql`
4. `supabase/004_content_commerce.sql`
5. `supabase/005_payouts.sql`
6. `supabase/006_broadcast_rewards.sql`
7. `supabase/007_trust_rights.sql`
8. `supabase/008_creator_economy_family.sql`
9. `supabase/009_family_pin_privacy.sql`
10. `supabase/010_creator_revenue_reserve_hardening.sql`
11. `supabase/011_launch_analytics_ads.sql`
12. `supabase/012_ppv_entitlements.sql`
13. `supabase/013_production_activation.sql`
14. `supabase/014_launch_security_and_recurring.sql`

`npm run validate:migrations` checks that the numbered source migrations are contiguous through 014. Migration 013 creates the fail-safe release state; migration 014 locks privileged database fields behind trusted server/staff workflows and adds the recurring-subscription lifecycle fields. Missing either keeps production readiness closed.

Never commit `SUPABASE_SERVICE_ROLE_KEY` or expose it to browser code.

## 2. Web environment and Supabase Auth

Required infrastructure values:

- `NEXT_PUBLIC_APP_URL` — final HTTPS origin, no trailing slash.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VIDEO_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_SANDBOX=false` only after sandbox acceptance.
- `KORA_INTERNAL_API_SECRET` — long random server-only secret, at least 32 characters in production.

In Supabase Auth set the production Site URL to `NEXT_PUBLIC_APP_URL` and allow `${NEXT_PUBLIC_APP_URL}/auth/callback` as a redirect. KORA uses this route for account email confirmation and password recovery. Test signup confirmation, ordinary sign-in, forgot-password and password reset on the production origin.

Public operator values:

- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_EMAIL`
- `NEXT_PUBLIC_RIGHTS_EMAIL`

Explicit operating approvals, all false until genuinely signed off:

- `KORA_LEGAL_APPROVED`
- `KORA_REGULATORY_APPROVED`
- `KORA_CHILD_SAFETY_APPROVED`
- `KORA_PAYOUT_OPERATIONS_APPROVED`
- `KORA_BACKUP_OPERATIONS_APPROVED`
- `KORA_INCIDENT_RESPONSE_APPROVED`

Do not flip an approval merely to obtain a green readiness response.

## 3. First administrator and controlled release

Create the owner's Auth account in the production Supabase project, then run the one-time privileged bootstrap from a trusted shell with production environment variables loaded:

```bash
KORA_BOOTSTRAP_CONFIRM=BOOTSTRAP_FIRST_ADMIN npm run bootstrap:admin -- owner@example.com
```

The script refuses to run after an administrator already exists. Remove `KORA_BOOTSTRAP_CONFIRM` immediately after use. Ongoing staff changes must use controlled administration rather than the bootstrap path.

For a controlled private beta only, `KORA_PRIVATE_SIGNUP_ENABLED=true` can temporarily permit account creation even while public signups are closed. Do not use this as the public-launch switch.

## 4. PayFast recurring subscriptions and PPV

Start PayFast in sandbox. KORA Premium and Premium Plus use PayFast recurring subscriptions, not repeated manual one-time checkouts. The stable PayFast subscription token is stored on the KORA subscription agreement while each `pf_payment_id` remains the identity of an individual charge.

For every successful recurring ITN KORA verifies the notification, verifies the expected amount, writes one cleared revenue event for that charge and extends paid access by one month. Replaying the same provider transaction does not extend access twice. Customers can cancel future renewal from My KORA; cancellation is sent to the PayFast subscription API and KORA records `cancelled_at` while preserving access through the already-paid period.

PPV stays separate. The browser never chooses the trusted amount, and the database grants the permanent entitlement only after a valid COMPLETE ITN. The browser return alone never activates a subscription or PPV entitlement.

Before switching live, test: initial recurring checkout, subscription token capture, a later recurring ITN, duplicate-ITN replay, cancellation, and PPV entitlement. Only after acceptance replace sandbox credentials with live merchant values and set `PAYFAST_SANDBOX=false`.

## 5. Video and live television

Set `VIDEO_PROVIDER=cloudflare` and use a least-privilege Cloudflare Stream token. Test private creator upload and signed playback. Connect at least one real HTTPS HLS feed in `/admin/schedule`, verify CAT programme times and test live playback on phone and desktop before launch.

## 6. Creator, advertiser, reward and payout operations

Before public activation, prove end to end:

- creator application → staff acceptance → deal offer → creator acceptance → rights declaration → upload → moderation → publication;
- an ordinary account cannot create a creator identity directly, elevate its role/KYC, publish content, mark Kids approval, inject playback state, self-activate campaigns or insert payout requests directly;
- contextual ad creative → human approval → funded delivery → impression/completion → trusted verification → funded reward claim;
- cleared revenue → creator allocation using the accepted contract share;
- KYC/payout onboarding → controlled payout request → paid/rejected processing and reconciliation;
- family PIN → child profile → locked Kids Mode → separately approved A/PG catalogue with no purchases, cash rewards or personalised ads.

The platform-wide pornography and explicit-sexual-content prohibition remains a creator declaration, database constraint and human moderation rule.

## 7. Backup and incident operations

Before setting `KORA_BACKUP_OPERATIONS_APPROVED=true`, confirm production database backup retention, restoration ownership and at least one restore drill. Before setting `KORA_INCIDENT_RESPONSE_APPROVED=true`, assign an incident owner, document payment/content/security escalation, and verify the team can place KORA into maintenance mode from `/admin/launch`.

## 8. Health and readiness

- `GET /api/health` is liveness only. HTTP 200 means the app process is running.
- `GET /api/readiness` is the strict launch gate. HTTP 200 requires production HTTPS, live Supabase connectivity, schema version 014, at least one admin, seeded channels, live PayFast, Cloudflare Stream, hardened reward secret, real operator contacts, all approval gates, backup/incident signoff **and** the database public-launch switch.

The endpoint returns booleans/counts and modes, never secret values.

## 9. Final launch sequence

1. Deploy `main` to the final HTTPS production domain.
2. Apply migrations through 014.
3. Configure Supabase Auth Site URL and `/auth/callback` redirect.
4. Bootstrap the first administrator.
5. Keep `/admin/launch` at Private Beta with public launch OFF.
6. Complete production smoke tests for account confirmation/recovery, creator publishing, privilege boundaries, moderation, playback, live HLS, recurring subscriptions, subscription cancellation, PPV, ads, rewards, creator revenue, payouts and Kids Mode.
7. Complete legal/regulatory/child-safety/payout/backup/incident signoffs and set only the corresponding approved environment flags.
8. Redeploy and inspect `/api/readiness`. The only remaining blocker should be `publicLaunchEnabled`.
9. In `/admin/launch`, choose Public Beta or General Availability, keep maintenance OFF and deliberately enable public launch. The action refuses to enable it while any other readiness check is failing.
10. Require `/api/readiness` to return HTTP 200 with `productionReady: true`.
11. Repeat payment, playback, auth recovery and reward smoke tests once more on the public origin.

If a material incident occurs, switch maintenance mode on and/or disable public launch in `/admin/launch` before investigating. Release-state changes are audit recorded.
