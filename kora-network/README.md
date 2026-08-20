# KORA Network

KORA is the working codename for an African creator-first digital television network: live channels, on-demand series, vertical drama, creator monetisation, contextual advertising, subscriptions, pay-per-view, commerce and revenue-funded viewer rewards.

> The brand name is isolated in `lib/brand.ts` so it can be renamed without rebuilding the product.

## Product promise

- Watch live channels and on-demand African programming.
- Create and publish through a rights-declared, human-moderated Creator Studio.
- Monetise through accepted creator deals, subscriptions, PPV, eligible ad revenue and later commerce.
- Advertise through funded, approved, contextual campaigns with aggregate reporting.
- Use parent-managed locked Kids Mode with separate Kids approval and no child purchases, cash rewards or personalised ads.
- Keep rewards inside cleared funded pools rather than unfunded cash promises.
- Prohibit pornography and explicit sexual content across the platform.

## Core stack

- Next.js App Router + TypeScript
- Supabase Auth/Postgres
- Cloudflare Stream/private signed playback + HLS live television
- PayFast subscriptions and permanent PPV entitlements
- Server-side wallets, revenue allocation, payout holds and reward anti-fraud controls

## Engineering checks

```bash
npm install
npm run validate:migrations
npm run typecheck
npm run build
```

`npm run validate:migrations` requires the ordered KORA production migrations to remain contiguous through the current schema version.

## Production activation

`DEPLOYMENT.md` is the authoritative production runbook. KORA exposes:

- `GET /api/health` — process liveness only.
- `GET /api/readiness` — strict production readiness.
- `/admin/launch` — administrator-only release control, maintenance switch and final go-live preflight.

Public account creation, creator applications and advertiser campaign creation are controlled independently by the production release state. The final public-launch switch cannot be enabled while another readiness check is failing.

## Operations references

- `DEPLOYMENT.md` — production infrastructure, migrations, first admin and final release sequence.
- `LAUNCH_OPERATIONS.md` — contextual ad delivery and reporting operations.
- `PPV_OPERATIONS.md` — PayFast one-time purchase and permanent entitlement operations.
- `LEGAL_REVIEW.md` — legal/regulatory review checklist.
- `CONTENT_POLICY.md` — content standards.

## Non-negotiable content rule

KORA does not permit pornography or explicit sexual content.
