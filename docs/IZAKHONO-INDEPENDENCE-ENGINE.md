# IZAKHONO Independence Engine

## Purpose

Build enough first-party infrastructure engines that KORA TV and future IZAKHONO products can operate without depending on a single external platform provider.

This is an **owned-first, externally reversible** architecture. External providers remain legitimate fallbacks until each first-party engine has been independently deployed, tested, monitored and verified.

## Engine stack

| Engine | Responsibility | Independence target |
|---|---|---|
| Edge Engine | request routing, health-aware failover, origin selection | Cloudflare/Vercel edge dependency |
| DNS & Domain Engine | domain records, onboarding, verification, TLS automation | registrar/DNS control-plane dependency |
| CDN & Cache Engine | static/media caching, purge, cache policy | CDN dependency |
| Web Runtime Engine | deploy and run Next.js/web workloads | Vercel/Netlify dependency |
| API Gateway Engine | authenticated API routing, rate limits, service discovery | managed gateway dependency |
| Media Engine | ingest, transcode, package, HLS delivery | hosted video dependency |
| Object Storage Engine | assets, recordings, VOD masters, backups | cloud object-storage dependency |
| Data Engine | PostgreSQL/Supabase-compatible application data | hosted database dependency |
| Identity Engine | accounts, sessions, roles, operator access | hosted auth dependency |
| Payments Engine | payment orchestration, webhooks, reconciliation | single PSP dependency |
| Analytics Engine | first-party events, telemetry, dashboards | analytics SaaS dependency |
| Observability Engine | logs, metrics, traces, uptime and alerts | monitoring SaaS dependency |
| Security/FORTRESS Engine | secrets, policy, audit, threat controls | external security control-plane dependency |
| Backup/Recovery Engine | immutable backups, restore tests, disaster recovery | provider-specific recovery dependency |
| Provisioner Engine | domains → DNS → runtime → SSL → email → app setup | manual infrastructure operations |

## Minimum independence rule

KORA is not considered infrastructure-independent merely because an `owned` runtime option exists in configuration. An engine becomes **verified independent** only after:

1. an actual deployment exists;
2. health checks pass from outside the primary provider;
3. critical data can be read/written as designed;
4. media playback works where applicable;
5. backup/restore has been exercised;
6. failover has been tested;
7. secrets and operator access are secured;
8. monitoring detects failure;
9. the recovery procedure is documented.

## KORA runtime contract

The KORA application already supports a provider-independent runtime selection model. `KORA_PRIMARY_RUNTIME=owned` selects the owned runtime and `KORA_FALLBACK_RUNTIME=owned` keeps the owned path as fallback. Streaming remains separately gated so an unverified media stack cannot be presented as ready.

## Implementation order

### Phase 1 — control plane

- Edge routing contract
- health/ready endpoints
- deployment manifest
- service registry
- audit events
- runtime status dashboard

### Phase 2 — state and media

- object storage abstraction
- PostgreSQL abstraction
- media ingest abstraction
- HLS packaging/delivery abstraction
- signed playback URLs

### Phase 3 — delivery

- owned origin
- reverse proxy/load balancer
- cache layer
- TLS automation
- DNS automation

### Phase 4 — operations

- centralized logs
- metrics
- backups
- restore verification
- incident/runbook automation
- failover drills

### Phase 5 — KORA cutover

- deploy a complete owned KORA stack
- run production-like smoke tests against owned runtime
- test live channel playback
- test VOD playback
- test authentication
- test payments/webhooks in sandbox
- test analytics
- test operator control plane
- perform controlled failover
- only then consider owned runtime production-ready

## Non-negotiable status rule

`configured` means configured.

`deployed` means deployment was verified.

`ready` means health checks passed.

`production` means the production endpoint and critical journeys were externally verified.

Never infer one state from another.
