# IZAKHONO CLOUD ZERO v0.3 — VIDEONOMY founding commercial beta

A zero-new-monthly-cost bootstrap backend and website package designed to get VIDEONOMY off the ground before revenue funds premium infrastructure.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/bevanshelton-netizen/Downloads/tree/videonomy-production)

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
- Qualified-view accounting at 30 seconds with heartbeat timing checks
- PayFast-ready ZAR checkout and payment-intent ledger
- ITN signature, source, amount and server-validation checks before paid status
- POPIA data-request records and content-reporting workflow
- Receipt/transactional email job queue
- Provisional privacy, platform, creator and community policies
- Founding advertiser packages

## Security design
- No administrator or PayFast secret is embedded in site assets or committed to GitHub.
- Creator and viewer session tokens use Secure, HttpOnly, SameSite cookies.
- D1 stores hashes of session tokens, not plaintext tokens.
- Anti-abuse keys use hashed identifiers instead of storing raw IP addresses.
- API CORS reflects only same-origin or explicitly configured allowed origins; no wildcard CORS.
- Public upload is disabled: only invited creator sessions can upload videos.
- Financial records are not publicly writable.
- Checkout remains unavailable until valid PayFast server-side credentials are configured.

## Deploy
The preferred first deployment is the **Deploy to Cloudflare** button above. Cloudflare reads `wrangler.jsonc`, automatically provisions the D1 database and R2 bucket, and uses the `deploy` script in `package.json` to apply D1 migrations as part of deployment.

For an already authenticated Wrangler environment, run:

```bash
npm install
npm run deploy
```

## Bootstrap limits
This is intentionally not the final global video architecture. Free-tier limits and direct MP4 playback are suitable for controlled founding beta validation, not YouTube-scale distribution. Professional transcoding/CDN, payment rails, transactional email and stronger identity/recovery will be upgraded from validated demand and revenue.

See `docs/LAUNCH-RUNBOOK.md`.
