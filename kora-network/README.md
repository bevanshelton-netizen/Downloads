# KORA Network

KORA is the working codename for an African creator-first digital television network: live channels, on-demand series, short-form vertical drama, creator monetisation, advertising, subscriptions, commerce and transparent viewer rewards.

> The brand name is intentionally isolated in `lib/brand.ts` so it can be renamed without rebuilding the product.

## Product promise

- Watch: short drama, films, documentaries, music, faith, family and community programming.
- Go live: scheduled 24/7 digital channels and live events.
- Create: creators keep their IP by default and can publish, monetise and analyse content.
- Earn: creators receive revenue shares; viewer rewards are funded only by verified revenue.
- Advertise: brands buy measurable campaigns and sponsorships.
- Shop: product placement and shoppable entertainment can be layered into episodes.
- Safe by design: pornography and explicit sexual content are prohibited.

## Stack

- Next.js App Router + TypeScript
- Supabase Auth/Postgres/Storage
- Pluggable video provider (Mux, Cloudflare Stream, or signed HLS)
- PayFast-ready payment abstraction for South Africa
- Server-side reward ledger and anti-fraud controls

## Local setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

## Build phases

1. Viewer experience + catalogue + live-channel shell
2. Supabase auth/data + creator studio
3. Video ingest/transcoding/playback
4. Monetisation: subscriptions, ads, creator revenue shares, wallet ledger
5. Moderation, age ratings, reporting, anti-fraud
6. Advertiser portal + campaign measurement
7. Smart-TV/mobile packaging + production deployment

## Non-negotiable content rule

KORA does not permit pornography or explicit sexual content. See `CONTENT_POLICY.md`.
