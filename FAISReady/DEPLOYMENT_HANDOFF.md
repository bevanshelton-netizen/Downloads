# FAISReady — revenue-first deployment handoff

FAISReady is the South African RE5/RE1 regulatory-exam preparation platform selected as the first IZAKHONO CLOUD revenue pilot.

## Commercial model
- RE5 Complete Prep — R299 / 90 days
- RE1 Complete Prep — R399 / 90 days
- RE5 + RE1 — R549 / 120 days
- Company licensing — R149 (10–49), R119 (50–199), from R89 (200+)

## Software launch build now completed
- Responsive financial-services storefront with a limited public sample
- Existing 540-question preparation engine retained behind paid access
- RE5 50-question and RE1 80-question preparation formats
- IZAKHONO native launch manifests for Windows and Linux
- Native runtime proof with no Docker and no public IPv4 requirement
- SQLite bootstrap order, payment-event and entitlement store
- Server-side signed PayFast hosted checkout
- Fail-closed PayFast ITN validation before entitlement creation
- 90-day / 120-day access-token enforcement
- Quick-Tunnel sandbox edge runner for temporary public testing
- Named-tunnel runner that keeps the tunnel token out of process arguments
- Public HTTPS health proof receipt
- Online SQLite backup + integrity + restore verification receipt
- CI contract tests for runtime, checkout, entitlements, edge secret boundary and backup/restore logic

## What is no longer a first-sale blocker
- Vercel
- Netlify
- Docker
- a public origin IPv4 address
- Supabase

Supabase and the broader multi-tenant architecture can still be used or replaced later when FAISReady expands beyond the bootstrap sales flow.

## Remaining real-world launch gates
1. Run the FAISReady manifest on a real owner-controlled machine and retain the launch receipt.
2. Install `cloudflared` on that machine.
3. Use a Quick Tunnel only for the first public PayFast sandbox rehearsal, not production.
4. Create/configure a remotely-managed named tunnel and map the chosen custom hostname to `http://127.0.0.1:18091`.
5. Add the real PayFast Merchant ID, Merchant Key and passphrase to the owner machine's protected environment; do not commit them.
6. Confirm the correct payout setup inside the authorised PayFast account.
7. Complete a real PayFast sandbox transaction through the public hostname and prove the correct entitlement is granted only after verified ITN confirmation.
8. Run `backup_revenue_data.py` and retain a successful restore-check receipt.
9. Switch PayFast out of sandbox only after all prior gates pass.
10. Complete one controlled live low-value purchase and verify payment, entitlement, audit record and backup before broader promotion.

## Truth boundary
The repository and CI prove the software path only. Until the owner-machine, public-hostname, sandbox payment, backup/restore and controlled live-payment proofs are completed, `commercial_ready=false` remains the correct status.

## Regulatory content policy
FAISReady does not claim to contain leaked or confidential exam papers. The question bank is original preparation content and should be maintained against the current FSCA RE1/RE5 preparation guide, tasks, qualifying criteria and underlying legislation.
