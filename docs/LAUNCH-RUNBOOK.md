# VIDEONOMY zero-cost commercial launch runbook

## Goal
Get the founding commercial beta online without adding a new monthly hosting bill. The first deployment is deliberately constrained; revenue funds the upgrade.

## Cloudflare resources
The Worker config uses automatic provisioning for one D1 database and one R2 bucket. Static assets, API, creator portal and admin dashboard are served by the same Worker.

## One-time account action
A Cloudflare account is required. R2 may require completing Cloudflare's R2 subscription/checkout setup even while usage remains inside the free included tier. No paid usage should be intentionally enabled for the bootstrap phase.

## Deployment
1. Extract package.
2. Run `./scripts/bootstrap.sh`.
3. Complete Cloudflare browser login if prompted.
4. The script deploys once to provision resources, applies D1 migrations, creates secure secrets, and deploys again.
5. Keep `.local-admin-secret` private. Open `/admin/` on the Worker URL and paste that secret when administering the beta.

## First revenue motion
- Founding creators apply free.
- Admin reviews creator leads and issues selected applicants an invite.
- Founding advertisers can request R1,500 / R5,000 / R12,500 launch proposals.
- Do not guarantee audience delivery until traffic exists.
- Confirm commercial scope and invoice/payment off-platform during the bootstrap phase until a payment gateway is connected.

## Upgrade trigger
Move video delivery/transcoding to a professional media stack when any of these occurs:
- R2 storage approaches 70% of free allowance,
- creators consistently need files larger than the bootstrap limit,
- playback quality/compatibility becomes a growth constraint,
- revenue can sustainably cover professional video infrastructure.
