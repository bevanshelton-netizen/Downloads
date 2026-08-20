# KORA Production Deployment

## Recommended production topology

- Web application: Vercel, deployed from `bevanshelton-netizen/Downloads` with Root Directory set to `kora-network`.
- Database, authentication and server data: Supabase.
- Video ingest, private playback and live HLS delivery: Cloudflare Stream or another compatible HLS origin.
- Payments: PayFast.
- Payout/KYC operations: approved external verification and payout process; KORA stores status/provider references, not banking passwords, PINs, CVVs or OTPs.
- Source of truth: GitHub `main` branch.

## 1. Supabase

Create a dedicated production Supabase project. In the SQL editor apply the KORA SQL files in this order:

1. `supabase/schema.sql`
2. `supabase/002_platform_core.sql`
3. `supabase/003_payment_hardening.sql`
4. `supabase/004_content_commerce.sql`
5. `supabase/005_payouts.sql`
6. `supabase/006_broadcast_rewards.sql`
7. `supabase/007_trust_rights.sql`
8. `supabase/008_creator_economy_family.sql`

Then configure the production application with:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to browser code or commit it to Git.

## 2. Vercel and operational checks

Import the GitHub repository and configure:

- Production Branch: `main`
- Root Directory: `kora-network`
- Framework Preset: Next.js
- Build Command: `npm run build`
- Install Command: `npm install --no-audit --no-fund`

Set `NEXT_PUBLIC_APP_URL` to the final HTTPS production origin, without a trailing slash.

KORA exposes two non-secret operational endpoints:

- `GET /api/health` is a liveness check. A running application returns HTTP 200 with `status: "ok"`.
- `GET /api/readiness` is the strict production go-live gate. It returns HTTP 200 with `status: "ready"` and `productionReady: true` only when production infrastructure, public legal identity/contact details, legal/regulatory approval, child-safety signoff and payout-operations signoff are configured. Sandbox PayFast, the mock video provider or incomplete approval gates intentionally return HTTP 503.

## 3. Public operator identity and approval gates

Complete these environment values with real approved details:

- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_EMAIL`
- `NEXT_PUBLIC_RIGHTS_EMAIL`

Keep these explicit gates false until the corresponding work is completed and signed off:

- `KORA_LEGAL_APPROVED=false`
- `KORA_REGULATORY_APPROVED=false`
- `KORA_CHILD_SAFETY_APPROVED=false`
- `KORA_PAYOUT_OPERATIONS_APPROVED=false`

The legal pages intentionally display a draft warning until legal approval is enabled. Do not set legal/regulatory flags merely to obtain a green readiness response. See `LEGAL_REVIEW.md`.

## 4. PayFast

Start in sandbox mode:

- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_SANDBOX=true`

The integration generates these URLs automatically from `NEXT_PUBLIC_APP_URL`:

- Return: `/account?payment=success`
- Cancel: `/account?payment=cancelled`
- ITN notify: `/api/payfast/notify`

Before switching live, complete an authenticated sandbox checkout and confirm that the ITN activates the subscription only when signature validation, merchant validation, amount validation and duplicate-payment controls succeed.

## 5. Cloudflare Stream and live television

For real creator uploads set:

- `VIDEO_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Cloudflare Stream direct uploads are created server-side and playback is private/signed. Use a token restricted to the minimum Stream permissions required by KORA.

Live channel playback URLs are controlled by authorised staff from `/admin/schedule`. Production feeds should use HTTPS HLS URLs. Master Control enters schedule times in CAT, KORA stores them in UTC and public schedules render in CAT.

## 6. Creator acquisition and contracts

Public recruitment begins at `/creators` and `/creators/apply`. Applicants must have a KORA account. Operations reviews applications at `/admin/creators`.

Accepting an application creates/activates the creator record and issues a versioned creator revenue-share offer. The percentage is stored in basis points and can be configured per offer. The creator sees the percentage and revenue basis in `/studio/earnings` and must actively accept it before any creator revenue can be allocated.

A creator must also accept the current versioned Creator Agreement before creating a production. Each production records rights declarations covering ownership/control, performers/contributors/locations, music and likeness permissions and content-policy compliance.

## 7. Creator revenue and payouts

`/admin/revenue` allocates an eligible amount from an already-cleared revenue event to a published production. The database then:

1. derives the production's creator;
2. reads the creator's accepted deal;
3. prevents cumulative allocation above the cleared revenue event;
4. calculates creator/platform shares;
5. writes the creator wallet credit and allocation record atomically.

The operations user cannot type a different creator percentage during allocation.

Creators manage deal acceptance and payout onboarding at `/studio/earnings`. Payout onboarding stores legal name, country and method preference; verification/provider references remain operations-controlled. A payout request requires both `profiles.kyc_status='verified'` and `payout_profiles.status='verified'`, plus at least R100 available balance.

`/admin/payouts` is the controlled verification/processing queue. A rejected pending payout automatically releases its wallet hold exactly once. Set `KORA_PAYOUT_OPERATIONS_APPROVED=true` only after the real KYC and payout process has been tested and assigned to accountable operations staff.

## 8. KORA Family and Kids Mode

Parents manage Kids profiles at `/family`. A child profile stores only a nickname and broad age band; no exact date of birth is required. Database constraints force child profiles to have:

- purchases disabled;
- cash rewards disabled;
- personalised advertising disabled;
- a maximum age rating derived from the age band.

A parent must set a 4–6 digit family PIN before launching Kids Mode. The PIN is bcrypt-hashed in the database. Launching a child profile sets an HttpOnly child-mode cookie and middleware confines that session to `/kids` routes until the correct family PIN is supplied.

KORA Kids does not inherit the ordinary catalogue automatically. A production must be published, A/PG rated and separately marked `kids_approved` by a moderator. Pay-per-view titles are excluded from Kids. Premium Kids titles may use the parent's existing subscription but Kids Mode never opens a purchase flow.

Set `KORA_CHILD_SAFETY_APPROVED=true` only after child-data, moderation, parental-control and device testing has passed.

## 9. Sponsored-viewing rewards

Generate a long random `KORA_INTERNAL_API_SECRET` and store it only in server environment secrets. Trusted ad-verification infrastructure calls `/api/internal/ads/verify` with this value in the `x-kora-internal-secret` header.

The client cannot choose the reward amount. A verified ad event cannot be paid twice. Cumulative cleared campaign funding cannot exceed the campaign budget and cumulative funded rewards cannot exceed the campaign's planned reward allocation. Child profiles have rewards disabled and KORA Kids does not expose the reward flow.

## 10. Production smoke test

Run this sequence after the first production deployment:

1. `GET /api/health` returns HTTP 200 and `status: "ok"`.
2. During sandbox/setup, `GET /api/readiness` returns HTTP 503 and identifies incomplete non-secret checks.
3. Create a viewer account and confirm Terms/Privacy acceptance metadata.
4. Submit a creator application, review it in `/admin/creators`, issue an offer and accept that offer in `/studio/earnings`.
5. Confirm an unapproved account cannot create a production.
6. Accept the Creator Agreement and create a production with all production rights declarations.
7. Upload an episode, submit moderation and approve publication.
8. Confirm an A/PG production does not appear in KORA Kids until the moderator separately enables Kids approval.
9. Set a family PIN, create a child profile and enter Kids Mode.
10. Confirm middleware keeps the child inside `/kids`, purchases/rewards/personalised ads are unavailable and the correct PIN is required to exit.
11. Confirm Kids playback rejects non-Kids-approved titles and ratings above the active child profile.
12. Confirm private normal and Kids playback work on supported devices.
13. Complete a PayFast sandbox subscription and confirm valid ITN activation/duplicate protection.
14. Confirm live HLS and EPG operation in CAT.
15. Confirm fake/unverified sponsored viewing cannot create a reward and verified rewards require a cleared funded pool.
16. Create a cleared revenue test event, allocate eligible revenue to a production and confirm the accepted deal percentage is used automatically.
17. Confirm creator allocation cannot exceed cleared revenue and cannot duplicate the same event/production allocation.
18. Submit payout onboarding and confirm payout requests fail before KYC and payout verification.
19. After controlled verification, request a payout; confirm a rejection releases the held balance exactly once and a paid request cannot be reprocessed.
20. Confirm pornography/explicit-sexual-content controls and human moderation remain enforced.
21. Confirm public legal pages show approved operator/contact details and no draft warning before launch.

## 11. Go-live gate

Do not market KORA as fully operational until all of the following are true:

- Production Supabase database is migrated and backed up.
- Row-level security policies and service-only money functions are tested.
- `/api/health` reports `ok`.
- Cloudflare Stream private upload/playback works.
- Live HLS and EPG pass device testing.
- PayFast sandbox checkout and ITN pass end-to-end.
- Creator application, deal acceptance, rights declaration and revenue allocation pass end-to-end.
- KYC/payout onboarding, payout hold, paid/rejected resolution and reconciliation pass end-to-end.
- Sponsored rewards pass abuse, concurrency and duplicate-claim tests.
- Family PIN, Kids-mode confinement, Kids moderation and child-data minimisation pass device/security review.
- Public operator identity and monitored support/privacy/rights contacts are real.
- `KORA_LEGAL_APPROVED=true` only after professional legal review.
- `KORA_REGULATORY_APPROVED=true` only after required regulatory/compliance work is confirmed and implemented.
- `KORA_CHILD_SAFETY_APPROVED=true` only after child-safety review.
- `KORA_PAYOUT_OPERATIONS_APPROVED=true` only after the real payout/KYC operating process is approved.
- Monitoring, error logging and database backup procedures are active.

After sandbox tests pass, switch PayFast live, confirm `VIDEO_PROVIDER=cloudflare`, set the final production HTTPS domain, redeploy and require `GET /api/readiness` to return HTTP 200 with `productionReady: true`. Repeat payment, playback, live-channel, creator-revenue, payout and Kids-mode smoke tests before public launch.
