# KORA Architecture

## Experiences
1. Viewer app: home, search, player, live guide, profiles, favourites, subscriptions, wallet.
2. Creator Studio: ingest, metadata, rights, seasons/episodes, subtitles, analytics, revenue, payouts.
3. Advertiser Console: campaigns, targeting, budgets, creatives, sponsorships, reporting.
4. Operations Console: moderation, rights disputes, fraud, payouts, catalogue, schedules and finance controls.

## Services
- Identity: Supabase Auth.
- Data: Postgres with row-level security.
- Video: provider abstraction for ingest, transcoding, signed playback and analytics.
- Live: scheduled HLS channels assembled from approved assets plus live-event inputs.
- Money: double-entry-style wallet ledger. Rewards are created only after eligible verified revenue events.
- Payments: PayFast adapter for subscriptions/purchases; payout adapters remain separate from payment collection.
- Ads: campaign allocation, impression/click/conversion events and brand-safety rules.
- Moderation: upload scanning, rules engine, human review queue, reports and audit log.

## Revenue paths
- Subscription plans.
- Premium episode/season unlocks.
- Advertising and rewarded ads.
- Sponsored productions and channel sponsorship.
- Shoppable product placement and affiliate commerce.
- Live-event tickets and tips.

## Reward guardrails
- No guaranteed income claims.
- Reward budget cannot exceed cleared advertiser/platform revenue assigned to that pool.
- Minimum withdrawal, cooling period and identity verification before cash-out.
- Bot/device-farm detection, velocity rules, duplicate-device checks and referral anti-abuse.
- All ledger changes immutable; corrections are compensating entries, never edits.

## Initial channels
KORA One, KORA Drama, KORA Family, KORA Faith, KORA Music, KORA Kids and KORA Creators.
