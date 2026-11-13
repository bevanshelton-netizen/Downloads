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

**Production deployment on the IZAKHONO Linux owner host**

The supported managed production path uses IZAKHONO RUNTIME NODE. From the root of a complete checkout of the `videonomy-production` branch, after the primary RUNTIME NODE is installed and healthy, run:

```bash
sudo bash owned/deploy-to-izakhono-runtime.sh
```

The deployment script validates the protected runtime configuration, installs an immutable release, preserves application secrets and requests a health-gated deployment. It expects `/etc/izakhono/runtime-node.env` and a healthy local runtime API at `127.0.0.1:8790`. It does not configure registrar DNS, public firewall/NAT, TLS certificates or EDGE reachability; those must be verified separately.

The app's internal health route is `/api/health`. Do not declare the public hostname live until public HTTPS, health, video playback, creator login/upload and a controlled real payment round trip have all been verified.

**Local Windows owner-host option**

For a standalone local run on the Windows/NODE01 host, open PowerShell and create the local configuration with cryptographically random application secrets:

```powershell
cd path\to\Downloads
.\owned\prepare-windows-env.ps1 -PublicBaseUrl https://videonomy.izakhonoafrica.co.za
.\owned\START-VIDEONOMY-OWNED.cmd
```

The bootstrap refuses to overwrite an existing `.env` unless `-Force` is explicitly supplied. It writes secrets only to the local ignored `.env` file and leaves both payment integrations in sandbox mode. Add merchant credentials locally and deliberately configure live mode only after payment verification. Docker Desktop must be installed and running. The launcher builds the container, starts it and polls `/api/health` before reporting PASS.

The local health route is `http://127.0.0.1:18081/api/health`. This Windows standalone engine is distinct from the managed Linux RUNTIME NODE deployment; it does not by itself configure public EDGE/TLS/DNS routing.

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
