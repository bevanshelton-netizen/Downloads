# KORA Video Advertising & Growth Engine
**Product requirement and implementation brief**  
Status: approved product direction; implementation and production activation remain subject to engineering verification.

## 1. Product objective

KORA must operate as an African video-first media and advertising network. It must sell and distribute video advertising for companies while continuously marketing KORA, its channels, creators, audience opportunities and advertiser services.

Advertising is a core revenue product, not a decorative feature.

## 2. Advertising formats

### A. Video creative formats
- 6–15 second short-form video spots.
- 15–30 second standard commercials.
- 30–60 second extended commercials.
- Vertical, square and landscape creative variants.
- Click-through video cards, sponsored posts and branded business profiles.
- Static image and text fallback creatives where video is unavailable.

### B. On-demand video placements
- Pre-roll before eligible on-demand programmes.
- Mid-roll at approved programme break points.
- Post-roll after eligible content.
- Sponsored content shelves and contextual discovery placements.
- Clearly labelled sponsored placements; never disguise paid advertising as editorial content.

### C. Live video and live-channel advertising
KORA must support both **video adverts inside live programming** and **live-streamed commercial broadcasts**:
- Advertiser video spots scheduled into live-channel commercial breaks.
- Operator-triggered and schedule-triggered ad breaks.
- Campaign selection and rotation from approved, funded campaigns.
- A fallback house advert or channel slate if no eligible paid advert is available.
- Live sponsored segments, product demonstrations, launches and company events, subject to presenter and rights controls.
- Live event sponsorship overlays/lower-thirds, clearly labelled and controlled by the broadcast operator.

The first reliable implementation may use player-side ad-break orchestration with explicit break cues and approved creative playback. Do not claim broadcast-grade server-side ad insertion (SSAI), frame-accurate switching or uninterrupted live ad replacement until separately implemented and tested. Preserve the programme if an advert fails.

## 3. KORA self-marketing engine

KORA must market itself across every suitable owned surface:
- Home page hero and rotating house campaigns.
- Live channel break inventory and on-demand pre/mid/post-roll house spots.
- Feed cards, category pages, search/discovery, creator pages and business directory.
- KORA Kids only with separately approved family-safe house messaging; no behavioural targeting.
- Email, push and in-product announcements only with consent and frequency controls.
- Shareable campaign landing pages and referral links.
- Business acquisition pages explaining advertising formats, audience, packages and enquiry/booking steps.

House campaigns should promote:
1. Advertise your business on KORA.
2. Watch KORA live channels and African programming.
3. Join as a creator / broadcaster.
4. Sponsor a channel, programme or event.
5. List a business and publish a promotion.
6. KORA platform launches, campaigns and community initiatives.

House ads fill unsold inventory. Paid campaigns take priority only when approved, eligible, funded and within pacing/frequency rules. KORA house campaigns must never consume advertiser funds or viewer reward reserves.

## 4. Company advertising marketplace

A company must be able to:
1. Discover KORA advertising and sponsorship packages.
2. Register a business/advertiser account and submit company/contact details.
3. Select campaign objective, target context, dates, placements, budget and frequency cap.
4. Upload video/image creative and destination URL, or request creative production from KORA.
5. Preview the advert and submit it for human review.
6. Pay or fund the campaign through the configured payment provider.
7. See campaign approval, start/end dates, delivery, spend and performance.
8. Request changes, renew, pause or download a report.

Sales-assisted onboarding must also be available: enquiry form → KORA sales contact → quotation/proposal → approved insertion order → cleared funds → creative approval → campaign activation.

Do not activate a paid campaign on a payment return page alone. Only trusted payment confirmation and reconciled cleared funds can fund delivery.

## 5. Commercial packages (initial proposal; pricing to be validated)

- **Starter Video:** one short video creative, limited run, selected placements.
- **Business Boost:** multi-placement campaign across relevant KORA surfaces.
- **Prime Video:** premium video inventory, frequency controls and priority placement.
- **Live Channel Sponsor:** scheduled sponsorship and approved live-break spots on selected channels.
- **Event / Launch Broadcast:** sponsored live broadcast, branded overlays and post-event replay promotion.
- **Managed Campaign:** KORA assists with advert concept, production/editing, campaign setup and reporting.
- **Enterprise / Agency:** multiple brands, campaigns, approval roles and consolidated reporting.

Pricing can be sold as fixed packages, campaign budgets, CPM, completed-view or sponsorship fees. The pricing model must be explicit per placement; do not mix incompatible billing metrics.

## 6. Campaign delivery and measurement

Retain the existing funded-campaign and contextual-advertising safeguards. Extend them to video and live inventory.

Track, where technically measurable:
- eligible opportunities and served impressions;
- video starts, quartiles and completed views;
- watch time and completion rate;
- clicks and landing-page visits;
- enquiries/leads where the advertiser has a valid consented conversion integration;
- spend, remaining budget, pacing and delivery by placement;
- live-break scheduled, triggered, filled, missed and fallback counts.

Define each metric in the advertiser dashboard. Filter bots and duplicate events; use trusted server-side verification for billable events. Advertisers receive aggregate campaign reports, not viewer identities or household/child profile data.

## 7. Ad decision and safety rules

- Human approval is required for creative and destination before delivery.
- Campaign must be funded, active, in schedule, within budget and eligible for the placement.
- Contextual targeting only; do not use child profile attributes or watch history for behavioural advertising.
- Kids inventory is separately gated and family-safe only; no cash-reward advertising or child-directed behavioural targeting.
- Respect frequency caps, category exclusions, consent, rights, takedown and complaint processes.
- Label paid and sponsored content clearly.
- Never allow an advert failure to block the underlying programme.
- Prevent overspend atomically and preserve the planned viewer-reward reserve.
- Retain audit trails for creative approval, campaign funding, delivery and changes.

## 8. Engineering workstreams

1. **Video creative pipeline:** upload, validation, transcoding/provider integration, thumbnails, aspect-ratio variants, moderation, rights declaration and signed playback.
2. **Ad inventory model:** placements, break schedules, eligible content/channel rules, campaign pacing, frequency caps and house-ad fallback.
3. **Live ad-break controller:** operator console, cue points, break triggers, countdown/state handling, creative rotation, fallback and telemetry.
4. **Advertiser portal:** onboarding, business profile, campaign builder, creative submission, payment/funding status, reporting and renewals.
5. **KORA growth console:** house campaigns, self-promotion calendar, owned-surface inventory, landing pages and acquisition funnel.
6. **Sales operations:** package catalogue, quote/enquiry pipeline, insertion orders, sales attribution and campaign handover.
7. **Measurement and billing:** verified event pipeline, transparent metric definitions, reconciliation and exportable reports.

## 9. Release acceptance tests

- A video creative can be uploaded, reviewed, approved, scheduled and played on supported mobile and desktop clients.
- A funded approved VOD campaign serves in its selected pre-roll placement and respects the campaign ceiling.
- Mid-roll is triggered only at configured break points; playback resumes if an advert fails.
- A live-channel operator can trigger a scheduled ad break, play the eligible creative, return to the programme and see a verified delivery record.
- A live ad break falls back safely when no eligible campaign exists.
- House campaigns populate unsold inventory and promote KORA's advertiser offering.
- A company can submit an enquiry and complete advertiser onboarding without staff manually editing database records.
- Advertiser reporting reconciles to verified delivery and cleared spend.
- Duplicate, fraudulent, unapproved, unfunded, expired or over-budget delivery is rejected.
- Child-safety, privacy, rights, moderation, incident and audit controls pass.
- Mobile data usage, buffering, accessibility, mute/autoplay behaviour and low-bandwidth fallback are tested.

## 10. Current baseline and release rule

The existing KORA operations brief documents funded contextual campaigns, human-approved creatives, on-demand pre-roll decisions and aggregate advertiser reporting. The production deployment runbook specifies Cloudflare Stream for video/live feeds. This brief extends that baseline to explicit video creative formats, live-channel ad breaks, company self-service sales and continuous KORA house marketing.

A code change, deployment record or successful homepage response is not proof that live advertising is operational. Mark each capability as built, integrated, tested, production-configured and commercially active separately. Do not enable public advertiser campaigns until the database, payment, video, moderation, privacy, reporting and operating gates pass.
