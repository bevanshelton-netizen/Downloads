# VIDEONOMY v1 owned-first launch runbook

## Launch rule

VIDEONOMY's primary production path is its independent IZAKHONO-owned engine. External infrastructure remains a reversible resilience route only.

## 1. Prepare NODE01 / Windows host

1. Obtain the release branch/package.
2. Copy `owned/.env.example` to `owned/.env`.
3. Create strong unique `ADMIN_SECRET` and `ABUSE_SALT` values locally.
4. Add the active iKhokha Payment API values as `IKHOKHA_APP_ID` and `IKHOKHA_APP_SECRET`.
5. Set `PUBLIC_BASE_URL` to the final HTTPS VIDEONOMY origin before testing payments.
6. Do not commit or send the populated `.env` file.

## 2. Start the independent engine

Run `owned\START-VIDEONOMY-OWNED.cmd`. The launcher builds the Docker image, keeps it under a restart policy and requires `http://127.0.0.1:18081/api/health` to return HTTP 200.

Persistent state lives under `owned/data/` on the host. Protect that directory with the IZAKHONO backup standard.

## 3. Connect EDGE/TLS/DNS

Route the selected VIDEONOMY public hostname through IZAKHONO EDGE/TLS to `127.0.0.1:18081`. Do not expose the container's database or filesystem media directory directly to the internet.

## 4. Public acceptance gate

Verify on the final HTTPS hostname:
- `/api/health` returns service `VIDEONOMY` and the expected release version.
- `/` loads the public experience.
- `/shorts.html` loads the vertical feed.
- creator invite redemption creates a working Creator Studio session.
- a controlled MP4 upload publishes and plays with range requests.
- like, follow and comment actions persist.
- a controlled real R10+ iKhokha tip reaches the signed callback and creates a pending creator ledger item.
- settlement release moves only the correct net creator amount to available.
- payout request cannot exceed available balance and requires a verified payout profile.
- administrator can progress a payout through approval/processing/paid.

## 5. External resilience path

The Cloudflare Worker/D1/R2 deployment may be maintained as a separate fallback. Test it independently; do not let it become a runtime dependency of the owned engine.

## Rollback

If the new public route fails acceptance, keep DNS/EDGE on the last verified route. Application data and media should be backed up before any rollback or migration.
