# KORA TV Production Readiness

## Release principle

KORA TV must not be described as public-live until an independent external smoke test confirms the public endpoint, core routes, authentication, playback, and health contract. CI success is a build signal, not a public-live signal.

## Operator plane

The protected `/admin` hub provides moderation, master control, tickets, live-event intake, creator acquisition, advertising review, launch control, campaigns, revenue and payouts. `/admin/control` aggregates live-channel, EPG, VOD, creator and campaign counts plus runtime and first-party infrastructure readiness.

## Broadcast and EPG

- Live channels are sourced from the `live_channels` data layer.
- Programme guide entries are sourced from `schedule_items`.
- Master Control remains the operator surface for channel feeds and scheduling.
- A channel is not considered production-ready merely because a URL exists; the stream must be rights-cleared, reachable, playable and externally verified.

## VOD and playback

Published productions are exposed through the watch catalogue. Playback supports episode selection and signed playback URLs. Access modes include free/ad-supported, premium membership and pay-per-view. Payment confirmation must be server-verified before a paid unlock is granted.

## Monetisation gates

Before release, verify:

1. Payment provider credentials are configured for the intended environment.
2. Product prices are stored and displayed in integer minor units without floating-point settlement logic.
3. Payment callbacks/webhooks are authenticated and idempotent.
4. A successful provider-side confirmation creates exactly one entitlement.
5. Failed, cancelled and duplicate callbacks do not grant access.
6. Refund/chargeback handling is documented before paid launch.
7. Creator payout controls remain separate from viewer payment confirmation.

## Provider independence

The first-party independence registry treats these as required for full KORA independence: edge, DNS, CDN, web runtime, API gateway, media, storage, data, identity, payments, analytics, observability, FORTRESS and backup. The provisioner engine is strategic but not a blocker for KORA runtime independence.

A configured endpoint is never treated as verified. Each required engine must have a real first-party deployment and an external verification receipt before `INDEPENDENCE_READY=true` is allowed in a production environment.

## Security

Production response headers are enforced by the application configuration. Continue to keep secrets server-side, require authenticated operator access, preserve role separation, and avoid exposing provider credentials in browser bundles.

## Analytics and observability

Release telemetry must cover at minimum: page/view events, playback start, playback failure, watch duration, entitlement outcome, stream/channel health, payment callback outcome, operator actions and deployment/health state. Analytics must be privacy-aware and must not become a prerequisite for basic playback when the analytics provider is unavailable.

## Responsive experience

Validate the public home, live catalogue, player, watch catalogue and watch player at mobile, tablet and desktop widths. Player controls and primary calls-to-action must remain usable without horizontal overflow.

## Owned-runtime launch sequence

1. Validate TypeScript and production build.
2. Run release policy, money integrity, public experience, activation and partner-gateway checks.
3. Run independence verification without treating missing infrastructure secrets as a source-code failure.
4. Submit the KORA desired state to the authorized IZAKHONO runtime executor.
5. Require an executor receipt identifying the deployed release and target runtime.
6. Verify the owned runtime externally over HTTPS.
7. Verify database read/write and authentication.
8. Verify a licensed live stream and EPG entry.
9. Verify one published VOD playback path.
10. Verify one payment success and one failed/duplicate payment path in a non-production-safe test environment.
11. Run public smoke tests for `/`, `/live`, `/watch`, `/api/health`, `/api/readiness` and `/api/version`.
12. Verify customer flows independently: signup/login, entitlement, playback and payment confirmation.
13. Only after all gates pass, perform DNS/public cutover.
14. Continue monitoring recovery, backups, security and playback stability after cutover.

## Current blocker

The remaining launch blocker is **physical activation and external verification of the IZAKHONO-owned runtime and its required first-party infrastructure engines**. Repository configuration, application release gates and deployment contracts do not constitute physical deployment evidence.

Vercel is **not** a KORA TV production dependency and must not be used to establish launch readiness. External providers may remain replaceable resilience paths, but KORA production must not depend on them for its primary runtime.

## Live declaration rule

KORA TV may be declared **LIVE AND VERIFIED** only when all of the following are independently evidenced:

- public HTTPS endpoint resolves to the owned runtime;
- homepage loads successfully;
- `/live` and `/watch` load successfully;
- `/api/health` reports healthy;
- readiness/version contracts pass;
- at least one authorized live stream is externally playable;
- EPG data is visible;
- at least one authorized VOD title is externally playable;
- authentication works;
- a paid entitlement is granted only after verified payment confirmation;
- failed/duplicate payment cannot grant entitlement;
- required first-party infrastructure engines have verification evidence;
- deployment and runtime recovery paths are documented and tested.

Until those conditions are met, status remains **NOT LIVE / IN VERIFICATION**.
