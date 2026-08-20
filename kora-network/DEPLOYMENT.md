# KORA Production Deployment

## Recommended production topology

- Web application: Vercel, deployed from `bevanshelton-netizen/Downloads` with Root Directory set to `kora-network`.
- Database, authentication and server data: Supabase.
- Video ingest, private playback and live HLS delivery: Cloudflare Stream or another compatible HLS origin.
- Payments: PayFast.
- Source of truth: GitHub `main` branch.

## 1. Supabase

Create a dedicated production Supabase project. In the SQL editor apply the KORA SQL files in this order:

1. `supabase/schema.sql`
2. `supabase/002_platform_core.sql`
3. `supabase/003_payment_hardening.sql`
4. `supabase/004_content_commerce.sql`
5. `supabase/005_payouts.sql`
6. `supabase/006_broadcast_rewards.sql`

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
- `GET /api/readiness` is the strict production go-live gate. It returns HTTP 200 with `status: "ready"` and `productionReady: true` only when the production HTTPS URL, Supabase, live PayFast configuration and Cloudflare Stream are all configured. Sandbox PayFast or the mock video provider intentionally returns HTTP 503.

## 3. PayFast

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

After sandbox acceptance, replace the values with the live PayFast merchant credentials and set `PAYFAST_SANDBOX=false`.

## 4. Cloudflare Stream and live television

For real creator uploads set:

- `VIDEO_PROVIDER=cloudflare`
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_STREAM_TOKEN`
- `CLOUDFLARE_STREAM_CUSTOMER_CODE`

Cloudflare Stream direct uploads are created server-side and playback is private/signed. Use a token restricted to the minimum Stream permissions required by KORA.

For non-production smoke testing the platform may use `VIDEO_PROVIDER=mock`, but `/api/readiness` will not mark KORA production-ready while the mock provider is active.

Live channel playback URLs are controlled by authorised staff from `/admin/schedule`. Production feeds should use HTTPS HLS URLs. The public `/live` page reads the live channel state and electronic programme guide from Supabase; `/live/[slug]` plays the channel through the HLS-capable player. Master Control enters schedule times in CAT, KORA stores them in UTC and public schedules render in CAT.

## 5. Sponsored-viewing rewards

Generate a long random `KORA_INTERNAL_API_SECRET` and store it only in server environment secrets. Trusted ad-verification infrastructure calls `/api/internal/ads/verify` with this value in the `x-kora-internal-secret` header. Never expose the value to viewers, creators or advertisers.

The reward path deliberately separates four events:

1. the viewer app records an ad impression, click or completion;
2. a trusted server verifies the event;
3. the viewer requests a reward claim;
4. the database atomically checks the campaign reward setting and a linked reward pool backed by cleared revenue before writing the wallet credit.

The client cannot choose the reward amount. A verified ad event cannot be paid twice. Cumulative cleared campaign funding cannot exceed the campaign budget and cumulative funded rewards cannot exceed the campaign's planned reward allocation.

## 6. Production smoke test

Run this sequence after the first production deployment:

1. `GET /api/health` returns HTTP 200 and `status: "ok"`.
2. During sandbox setup, `GET /api/readiness` may return HTTP 503; inspect its non-secret checks to see what remains outstanding.
3. Create a new viewer account and sign in.
4. Create a creator profile and a production.
5. Upload an episode and attach the video asset.
6. Submit the production for moderation.
7. Approve it from the moderation console and confirm it appears in the catalogue.
8. Confirm private playback works for the approved episode.
9. Complete a PayFast sandbox subscription.
10. Confirm the subscription becomes active only after a valid ITN.
11. Confirm the corresponding revenue event is recorded only once.
12. Confirm an advertiser can create a campaign and planned reward allocation cannot exceed the campaign budget.
13. Connect a test HLS stream to one channel in `/admin/schedule` and confirm it plays on `/live/[slug]`.
14. Add two scheduled programmes and confirm the public guide reflects the correct CAT times and blocks overlaps.
15. Confirm a fake or unverified ad completion cannot produce a wallet credit.
16. Confirm a verified completion can be paid only when a cleared campaign reward pool has enough balance, and cannot be claimed twice.
17. Confirm cumulative campaign funding and cumulative reward funding cannot exceed their configured caps.
18. Confirm a payout request is blocked until the platform's KYC and cleared-balance rules are satisfied.
19. Confirm prohibited pornography/explicit-sexual-content workflow controls remain enforced.

## 7. Go-live gate

Do not market KORA as fully operational until all of the following are true:

- Production Supabase database is migrated and backed up.
- Row-level security policies are enabled and tested.
- `/api/health` reports `ok`.
- Cloudflare Stream private upload/playback works.
- At least one live HLS channel and the electronic programme guide pass device testing.
- PayFast sandbox checkout and ITN pass end-to-end.
- Admin/moderator access is assigned deliberately, not by public self-registration.
- Creator payout/KYC process has an operational owner.
- Sponsored reward funding and verification pass abuse, concurrency and duplicate-claim testing.
- Privacy policy, terms, creator agreement, advertiser terms, refund/cancellation policy and content policy are published.
- Monitoring, error logging and database backup procedures are active.

After the sandbox tests pass, switch PayFast to live (`PAYFAST_SANDBOX=false`), confirm `VIDEO_PROVIDER=cloudflare`, set the final production HTTPS domain in `NEXT_PUBLIC_APP_URL`, redeploy and require `GET /api/readiness` to return HTTP 200 with `productionReady: true`. Then repeat payment, playback, live-channel and reward smoke tests once more before public launch.
