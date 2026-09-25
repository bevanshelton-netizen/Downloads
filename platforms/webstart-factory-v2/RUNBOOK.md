# Production Runbook

## Standard website build
1. Sign in to WebStart.
2. Create a website.
3. Enter business name and brief.
4. Use **Build Fast** for the default direction or **3 Directions** to choose.
5. Generation must return a passing QA report.
6. Publish.
7. The publisher independently fetches the public URL.
8. Only HTTP 200 + real HTML + expected business name sets `verified_at`.

## Failure handling
- QA failure: site remains `draft/ready`; fix content and regenerate.
- Public verification failure: publisher rolls status back to `ready`.
- External renderer outage: switch delivery to the owned runtime; customer HTML does not change.
- Payment failure: order remains non-paid/manual-review. Publishing is payment-gated by default; only an explicit `PAYMENTS_ENFORCED=false` override disables that gate.

## Lead handling
Public visitors may INSERT leads for published sites. They cannot SELECT leads. Authenticated owners may read/update only leads belonging to their own sites.

## Package pricing
- Start: R999 setup + R99/month
- Business: R2,499 setup + R199/month
- Commerce: R4,999 setup + R349/month
The checkout engine charges setup + first month on initial checkout.

## Live production endpoints
- Builder: https://izakhono-webstart.vercel.app
- External renderer: https://izakhono-webstart-sites.vercel.app
- Core health: https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/webstart-health


## Source control
Canonical source lives on branch `webstart-factory-v2` and PR #462. Merge to main only after the unrelated repository-level Cloudflare integration is healthy; WebStart runtime does not depend on that merge.
