# VIDEONOMY v1.0 Release Candidate

VIDEONOMY is an IZAKHONO-owned creator video platform with standard video, vertical Shorts, social discovery, direct fan payments, creator earnings and controlled payouts.

## Product surfaces

- Public creator-video feed with search, trending and following modes
- Full-screen vertical Shorts experience
- Likes, follows and comments backed by server-side records
- Invite-controlled Creator Studio
- MP4 publishing with standard-video or Short classification
- Qualified-view accounting with heartbeat timing controls
- Creator profiles, audience metrics and video metrics
- Direct fan tips through the signed iKhokha payment adapter
- Revenue ledger separating pending settlement from withdrawable earnings
- Creator payout requests against settled available balances only
- Admin settlement console, payout-profile verification and payout queue
- Advertiser/creator/partner lead CRM
- POPIA request and content-report records
- Existing PayFast adapter retained for the founding commercial-package flow

## Creator economics

Current product rules expose target creator shares of:
- 70% of eligible watch-ad net revenue
- 80% of eligible subscription-pool net revenue
- 90% of eligible direct-fan and brand-marketplace net revenue

These percentages are not a fixed payment per view. Direct-fan payments enter the ledger as **pending**. An authorised operator records actual external processing cost before settlement release; only then does the creator share become **available**. Payout requests cannot reserve more than the creator's available balance.

## Infrastructure

### Primary: IZAKHONO-owned engine

`owned/server.mjs` runs the same VIDEONOMY application independently on Node 22 with:
- local SQLite control database
- local filesystem media store with byte-range playback
- automatic ordered SQL migrations
- static-site serving
- the same API routes and payment adapters
- Docker restart and health-check contract

On the Windows/NODE01 host, copy `owned/.env.example` to `owned/.env`, insert secrets locally, then run:

```bat
owned\START-VIDEONOMY-OWNED.cmd
```

The local health route is `http://127.0.0.1:18081/api/health`. EDGE/TLS/DNS should route public HTTPS traffic to that loopback service after the local gate passes.

### External fallback

The Cloudflare Worker/D1/R2 package remains supported as a reversible external resilience route. It is not required for the owned engine to operate.

## Release gates

The production workflow must pass:
1. TypeScript typecheck
2. database/package/security tests
3. external-fallback dry-run build
4. independent owned-engine smoke test

Do not call the public production route live until HTTPS, health, video playback, creator login/upload, and a controlled real payment round trip have all been verified on the selected public route.

## Secrets

Never commit:
- `ADMIN_SECRET`
- `ABUSE_SALT`
- `IKHOKHA_APP_ID`
- `IKHOKHA_APP_SECRET`
- PayFast merchant secrets
- payout destination details

The owned runtime ignores `owned/.env` and persistent `owned/data/` by repository rule.
