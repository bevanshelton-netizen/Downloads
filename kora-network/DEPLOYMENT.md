# KORA Production Deployment

## Production topology

- Web: Vercel, repository `bevanshelton-netizen/Downloads`, Root Directory `kora-network`, Production Branch `main`.
- Database/auth: Supabase.
- Video/live delivery: Cloudflare Stream plus approved HTTPS HLS live feeds.
- Payments: PayFast recurring subscriptions and one-time PPV.
- Source of truth: GitHub `main`.

## 1. Supabase database

Create a dedicated production project and apply these files in order:

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
13. `supabase/013_launch_security_and_recurring.sql`

Migration 013 is a launch-critical privilege boundary: authenticated users cannot promote themselves to staff/KYC, self-verify creators, publish their own content, write playback/moderation state, self-activate campaigns or bypass the controlled payout RPC.

Configure only in the hosting environment:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to browser code or commit it to Git.

## 2. Supabase Auth

Set the production Site URL to `NEXT_PUBLIC_APP_URL` and allow the redirect URL:

- `${NEXT_PUBLIC_APP_URL}/auth/callback`

KORA uses that callback for account email confirmation and password recovery. Test signup confirmation, sign-in, forgot-password and password reset before launch.

## 3. Vercel

Configure:

- Production Branch: `main`
- Root Directory: `kora-network`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install --no-audit --no-fund`
- `NEXT_PUBLIC_APP_URL`: final HTTPS origin with no trailing slash.

`GET /api/health` is liveness. `GET /api/readiness` is the strict production gate and also checks that the latest production database migration is actually present.

## 4. PayFast

Required secrets:

- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_SANDBOX=true` during acceptance testing.

KORA Premium and Premium Plus are true PayFast subscriptions using `subscription_type=1`, monthly frequency and indefinite cycles. The PayFast subscription token from ITN is stored separately from individual `pf_payment_id` transaction IDs. Each successful recurring transaction extends the paid period once and creates one cleared revenue event; duplicate ITNs do not extend access twice.

The user can cancel future renewal from My KORA. KORA calls PayFast's authenticated subscription cancel API and records `cancelled_at` while preserving access through the already-paid period.

PPV is separate: the server creates the order from the stored production price and the database grants the permanent entitlement only after a valid COMPLETE ITN.

Generated URLs:

- subscription return: `/account?payment=success`
- subscription cancel return: `/account?payment=cancelled`
- PPV return: production watch page
- ITN: `/api/payfast/notify`

Do not set `PAYFAST_SANDBOX=false` until recurring subscription creation, recurring ITN token capture, duplicate ITN handling, cancellation and PPV all pass in sandbox.

## 5. Cloudflare Stream and Live TV

Set:

- `VIDEO_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Use a least-privilege Stream token. Test creator direct upload, processing, signed playback, normal catalogue playback and Kids playback. Master Control live feeds must use approved HTTPS HLS URLs and the CAT electronic programme guide must be device-tested.

## 6. Creator economy, advertising, rewards and payouts

Before public launch verify the full chain:

- creator application -> staff approval -> creator deal -> creator acceptance;
- Creator Agreement acceptance and production rights declarations;
- upload -> moderation -> publication, with separate Kids approval for eligible A/PG content;
- contextual ad creative review and funded campaign delivery;
- sponsored-view rewards only from verified completions backed by cleared funded reward pools;
- creator revenue allocation only from cleared eligible revenue using the accepted deal percentage;
- KYC + payout onboarding -> controlled payout request -> paid/rejected reconciliation;
- child profiles cannot purchase, receive cash rewards or receive personalised ads.

## 7. Legal and operating gates

Provide real monitored values for:

- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_EMAIL`
- `NEXT_PUBLIC_RIGHTS_EMAIL`

Keep these false until the corresponding work is genuinely approved:

- `KORA_LEGAL_APPROVED=false`
- `KORA_REGULATORY_APPROVED=false`
- `KORA_CHILD_SAFETY_APPROVED=false`
- `KORA_PAYOUT_OPERATIONS_APPROVED=false`

Do not flip approval flags merely to obtain a green readiness response.

## 8. Final smoke test

Before public launch confirm:

1. `/api/health` returns HTTP 200.
2. `/api/readiness` identifies only intentionally incomplete gates during setup and returns `productionReady: true` only after full activation.
3. Signup email confirmation and password reset work on the production domain.
4. A normal user cannot change their role or KYC state through the API.
5. An unapproved user cannot become a creator through a direct table insert.
6. A creator cannot directly publish, set Kids approval or inject playback/moderation state.
7. An advertiser cannot self-activate a campaign.
8. A payout cannot be inserted directly and succeeds only through the KYC/payout-gated RPC.
9. Creator upload -> moderation -> playback works.
10. KORA Kids PIN confinement, age limits and child restrictions pass device testing.
11. PayFast sandbox subscription creates a recurring agreement and captures its token.
12. A second valid recurring ITN extends access once; replaying the same ITN does not extend it again.
13. Cancel renewal stops future PayFast billing while paid access remains until `current_period_end`.
14. PPV purchase creates exactly one permanent entitlement.
15. Live HLS/EPG works in CAT.
16. Sponsored rewards cannot be forged, duplicated or paid without cleared funding.
17. Creator allocations cannot exceed cleared revenue after reward reserves.
18. Public legal pages and operator/contact details are approved and monitored.
19. Pornography and explicit sexual content remain prohibited and human moderation remains enforced.

Only after the above passes: switch PayFast live, keep Cloudflare Stream real, deploy the final HTTPS domain, require `/api/readiness` HTTP 200 and repeat payment/playback/live/reward/payout smoke tests once more before marketing KORA as live.
