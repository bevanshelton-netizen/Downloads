# KORA Production Deployment

KORA is designed to launch only when the real production services, legal identity, safety controls and operating processes have passed acceptance testing. A successful code build alone is not a public go-live decision.

## Production topology

- Web application: Vercel, repository `bevanshelton-netizen/Downloads`, Root Directory `kora-network`.
- Database/auth/server data: Supabase.
- Creator upload, private playback and live HLS: Cloudflare Stream or an approved compatible origin.
- Payments: PayFast.
- Creator KYC/payouts: approved external verification and payout process. KORA must never collect banking passwords, card PINs, CVVs or OTPs.
- Source of truth: GitHub `main`.

## 1. Supabase — required migration order

For a new production database apply these files in this order:

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
13. `supabase/013_schema_readiness.sql`

Migration 013 is intentionally a final integrity check. It fails if critical earlier KORA tables/functions are absent and then records the required production schema version in `platform_schema_meta`.

The historical `000_fresh_install.sql` predates the latest commercial and PPV layers. Do not treat it by itself as a complete v13 production install unless it is regenerated to include every migration above.

Configure only through deployment secrets:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Never expose the service-role key to browser code or commit it to Git.

## 2. Vercel

Import the repository with:

- Production Branch: `main`
- Root Directory: `kora-network`
- Framework: Next.js
- Install: `npm install --no-audit --no-fund`
- Build: `npm run build`

Set `NEXT_PUBLIC_APP_URL` to the final HTTPS production origin without a trailing slash.

Operational endpoints:

- `GET /api/health` — liveness only; a running app returns HTTP 200 / `status: "ok"`.
- `GET /api/readiness` — strict go-live gate. It now checks real database reachability and schema version in addition to configuration/approval gates. It returns HTTP 200 only when every launch condition passes.
- `/admin/launch` — administrator launch-control screen showing the same non-secret checks.

## 3. Public identity and explicit approvals

Supply real approved values:

- `NEXT_PUBLIC_OPERATOR_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_PRIVACY_EMAIL`
- `NEXT_PUBLIC_RIGHTS_EMAIL`

Keep every acceptance flag `false` until the named work has actually been completed:

- `KORA_LEGAL_APPROVED=false`
- `KORA_REGULATORY_APPROVED=false`
- `KORA_CHILD_SAFETY_APPROVED=false`
- `KORA_PAYOUT_OPERATIONS_APPROVED=false`
- `KORA_PAYMENT_ACCEPTANCE_APPROVED=false`
- `KORA_STREAMING_ACCEPTANCE_APPROVED=false`
- `KORA_AD_OPERATIONS_APPROVED=false`
- `KORA_MONITORING_APPROVED=false`
- `KORA_BACKUP_APPROVED=false`

Never set flags merely to obtain a green readiness response.

## 4. PayFast

Start with sandbox credentials and `PAYFAST_SANDBOX=true`.

KORA supports:

- Premium membership checkout via `/api/payfast/checkout`.
- One-time pay-per-view checkout via `/api/payfast/purchase`.
- Server-to-server notification at `/api/payfast/notify`.

PPV prices are read from the production database, not from the browser. Browser return from PayFast never unlocks content; only a validated ITN can complete the entitlement. `012_ppv_entitlements.sql` atomically records the permanent purchase and cleared revenue.

Before live mode, test valid and invalid signatures, merchant mismatch, amount mismatch, duplicate ITNs, cancelled checkout, completed PPV unlock, My Library, subscription activation and revenue uniqueness. Then set `KORA_PAYMENT_ACCEPTANCE_APPROVED=true` only after the acceptance record is retained.

## 5. Streaming and broadcast

For Cloudflare Stream configure:

- `VIDEO_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Creator uploads are created server-side. Private playback uses signed URLs. Live channels use HTTPS HLS feeds controlled through `/admin/schedule`; the public EPG renders programme times in CAT.

Test upload, processing, signed playback, multiple devices, at least one live HLS channel and EPG rollover before setting `KORA_STREAMING_ACCEPTANCE_APPROVED=true`.

## 6. Creators, rights and moderation

Creator journey:

`application → operations review → creator deal offer → creator acceptance → Creator Agreement → production rights declarations → upload → moderation → publication → analytics/revenue → KYC → payout`

Creators retain their IP by default under the draft creator agreement structure, subject to the distribution licence they accept. Every production records declarations for ownership/control, performers/contributors/locations, music and likeness permissions.

Pornography and explicit sexual content are prohibited platform-wide. Publication remains human-moderation gated.

## 7. Revenue, advertising and viewer rewards

Campaign money is separated into controlled uses. Operations first records cleared advertiser funding. Advertising staff then approve the actual creative. `011_launch_analytics_ads.sql` provides contextual ad decisions and atomically reserves media spend at the configured CPM; delivery cannot consume the campaign's planned viewer-reward reserve or exceed the remaining media budget.

Free/ad-supported programmes can receive approved pre-roll. Advertisers receive aggregate campaign reporting only. Creators receive aggregate production analytics only. Raw household/viewer identifiers are not exposed in those reports.

Viewer rewards require authenticated eligibility, a verified sponsored-completion event and cleared funded reward balance. The browser cannot choose the reward amount. Child profiles cannot receive cash rewards. Keep `KORA_INTERNAL_API_SECRET` server-only.

Set `KORA_AD_OPERATIONS_APPROVED=true` only after budget exhaustion, duplicate event, child inventory, reward funding and reporting tests pass.

## 8. KORA Family / Kids

Child profiles store a nickname and broad age band rather than an exact birth date. Database rules disable child purchases, cash rewards and personalised ads. Family PIN state is privacy-protected; Kids Mode confines the session to Kids routes until the correct parent PIN is supplied.

KORA Kids uses a separately approved catalogue. A/PG rating alone is insufficient: moderators must explicitly mark a title Kids-approved. Pay-per-view titles are excluded from Kids.

Set `KORA_CHILD_SAFETY_APPROVED=true` only after child-data, moderation, parental-control, cookie/session and multi-device tests pass.

## 9. Creator revenue and payouts

Creator revenue allocation uses the accepted deal percentage automatically and cannot consume money reserved for viewer rewards. Payout requests require the required KYC/payout verification and create a wallet hold so the same balance cannot be requested repeatedly.

`/admin/payouts` is the controlled processing queue. A rejected payout releases its hold once; a paid request cannot be reprocessed.

Set `KORA_PAYOUT_OPERATIONS_APPROVED=true` only after the real verification/provider process and reconciliation ownership are established.

## 10. Production acceptance test

Before public launch, complete at minimum:

1. `/api/health` returns `ok`; `/api/readiness` stays blocked until all gates are intentionally satisfied.
2. Schema migration 013 applies successfully and `/admin/launch` reports the required schema version.
3. Viewer registration records current Terms/Privacy acceptance.
4. Creator application, deal acceptance, Creator Agreement and production rights workflow pass.
5. Upload, moderation, signed on-demand playback, live HLS and CAT EPG pass on target devices.
6. Kids PIN, confinement, Kids-only catalogue, no purchase/reward flow and child-safe advertising restrictions pass.
7. PayFast sandbox membership and PPV transactions pass valid/invalid ITN tests; PPV only unlocks after verified ITN and appears in My Library.
8. Advertiser campaign funding, creative review, CPM delivery, budget exhaustion, aggregate reports and viewer-reward reserve protection pass.
9. Verified rewards cannot exceed cleared funded pools and cannot be claimed twice.
10. Creator revenue uses the accepted deal and respects all reserved funds.
11. KYC, payout hold, rejection release, paid resolution and reconciliation pass.
12. Pornography/explicit-sexual-content controls, human moderation and rights complaint workflow pass.
13. Monitoring/error alerts are exercised and the database backup is restored successfully in a test environment.
14. Public operator identity, support/privacy/rights contacts and approved legal documents are live.

After those tests, switch PayFast live, keep Cloudflare production credentials active, set the final HTTPS domain, record each explicit acceptance flag, redeploy and require `/api/readiness` to return HTTP 200 with `productionReady: true` before public launch.
