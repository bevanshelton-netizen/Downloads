# VIDEONOMY — Cloudflare Zero-Cost Commercial Launch

Branch: `videonomy-cloudflare-zero`

This branch contains the validated IZAKHONO CLOUD ZERO v0.3 launch bundle for VIDEONOMY.

## Deployment source
- `videonomy-cloudflare-zero-v0.3.tgz.b64` — complete validated release bundle
- `deploy-videonomy-zero.sh` — self-extracting deployment command

## Cloudflare build/deploy command

```bash
bash deploy-videonomy-zero.sh
```

The embedded package contains:
- Cloudflare Worker API and static assets
- D1 migrations
- R2 media binding
- creator/advertiser lead funnels
- creator invite portal
- admin dashboard
- qualified-view accounting
- PayFast-ready payment intents and ITN validation
- POPIA data-request routes
- content reporting/moderation records

## Required live secrets
Do not commit these values to GitHub:
- `ADMIN_SECRET`
- `ABUSE_SALT`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE`
- `PUBLIC_BASE_URL`

Checkout remains disabled until valid PayFast credentials are installed.

## Launch rule
Keep usage inside the bootstrap free-tier guardrails. Upgrade media delivery, email and database infrastructure only once revenue or sustained usage justifies the cost.
