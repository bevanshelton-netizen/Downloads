# IZAKHONO CLOUD ZERO v0.2 — VIDEONOMY founding commercial beta

A zero-new-monthly-cost bootstrap backend and website package designed to get VIDEONOMY off the ground before revenue funds premium infrastructure.

## Included
- Cloudflare Worker API + static site in one deployment
- D1 database with automatic resource provisioning
- R2 MP4 storage with automatic resource provisioning
- Founding creator and advertiser applications
- Privacy-consent versioning and bot honeypot
- Salted, daily anti-abuse rate limiting without storing raw IP addresses
- Admin dashboard: leads, statuses, notes, CSV export, creator invites, live stats
- Invite-only creator portal with HttpOnly session cookies
- MP4 uploads up to 90 MB
- Public video feed and R2 playback with byte-range support
- HttpOnly viewer sessions
- Real-time-qualified view accounting: 30 seconds, with heartbeat timing checks to limit manipulation
- Revenue ledger schema for future monetisation
- Provisional privacy, platform, creator and community policies
- Zero-cost-first advertiser acquisition packages

## Security design
- No administrator secret is embedded in site assets.
- Creator and viewer session tokens are sent in Secure, HttpOnly, SameSite cookies.
- D1 stores hashes of session tokens, not plaintext tokens.
- Anti-abuse keys use salted hashes instead of raw IP addresses.
- API CORS reflects only same-origin or explicitly configured allowed origins; no wildcard CORS.
- Public upload is not enabled: only invited creator sessions can create/upload videos.
- Financial ledger is not publicly writable.

## Deploy
Run:

```bash
./scripts/bootstrap.sh
```

The script relies on current Wrangler automatic provisioning to create D1 and R2 resources from draft bindings. It then applies migrations and creates deployment secrets.

## Bootstrap limits
This is intentionally not the final global video architecture. Free-tier limits and direct MP4 playback are suitable for controlled founding beta validation, not YouTube-scale distribution. Professional transcoding/CDN, payment rails, transactional email and stronger identity/recovery should be funded from validated demand/revenue.

See `docs/LAUNCH-RUNBOOK.md`.
