# KORA Launch Operations — Phase 6

This layer turns funded campaigns into controlled ad delivery and privacy-safe reporting.

## Database

Apply `supabase/011_launch_analytics_ads.sql` after migration 010. A fresh production installer must include migration 011 before this phase is considered activated.

The migration adds approved campaign creatives, atomic media-spend reservation, contextual ad deliveries, delivery-attributed ad events, creator performance summaries and advertiser campaign summaries.

## Commercial activation sequence

1. Create an advertiser campaign and allocate any planned viewer reward reserve.
2. In `/admin/campaigns`, record only money that has actually cleared.
3. Set the campaign media CPM in `/admin/campaigns`. The delivery engine will not serve a campaign with CPM 0.
4. The advertiser creates a creative in `/advertiser/creatives` and submits it for review.
5. Staff review the media and destination in `/admin/ads`. Only `approved` creatives are eligible for delivery.
6. Free on-demand playback calls `/api/ads/decision` for a contextual pre-roll.
7. The database locks the campaign row, calculates cost per delivery as CPM / 1000 and refuses delivery if media spend would exceed `campaign budget - planned reward reserve`.
8. The viewer records impression/click/completion against the issued delivery. A delivery cannot record the same event type twice.
9. Trusted verification infrastructure may verify eligible ad events through `/api/internal/ads/verify`. The internal secret must never be exposed to the browser.
10. Advertisers see aggregate campaign reporting at `/advertiser/reports`. Raw viewer/profile identifiers are not returned to advertisers.
11. Creators see aggregate performance at `/studio/analytics`. Viewer identities are not returned to creators.

## Child and family safety

Advertising remains contextual. The decision endpoint does not use watch history or a child's profile attributes for behavioural targeting. A child profile can receive only creatives marked family-safe and cannot be marked reward-eligible. KORA Kids remains separately confined by the existing Kids Mode and child-safety controls.

The platform-wide prohibition on pornography and explicit sexual content remains unchanged. Advertising approval is a separate human gate from campaign funding.

## Phase 6 smoke test

- Create an active funded test campaign with a non-zero CPM.
- Confirm no creative can be served while it is draft, submitted or rejected.
- Approve a creative and confirm a free episode can receive one pre-roll decision.
- Confirm an issued delivery increments media spend by CPM / 1000.
- Drive the campaign to its media ceiling and confirm the next decision returns no ad rather than overspending.
- Confirm the planned viewer reward reserve is not consumed by media delivery.
- Confirm duplicate impression/click/completion events for one delivery are rejected.
- Confirm an anonymous delivery cannot become reward eligible.
- Confirm child-profile delivery rejects non-family-safe creatives and cash-reward eligibility.
- Confirm creator analytics show only the creator's own aggregate production metrics.
- Confirm advertiser reports expose campaign aggregates only and never viewer identities or household profile data.
- Confirm ad telemetry failure does not block the underlying programme.
- Confirm an ad media error skips to the programme without falsely recording a completed ad.

Do not treat Phase 6 as production activated until migration 011 is applied to production and this smoke test passes against the real production services.
