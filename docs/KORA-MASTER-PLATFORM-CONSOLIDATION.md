# KORA NETWORK — Master Platform Consolidation

**Status:** Architecture baseline / consolidation branch  
**Branch:** `kora/master-platform-consolidation`  
**Canonical product:** KORA NETWORK  
**Canonical application target:** `kora-network`  
**Primary source repository:** `bevanshelton-netizen/Downloads` (`main` currently contains the shared KORA application and related modules)

## 1. Executive decision

All KORA initiatives are governed as one product ecosystem: **KORA NETWORK**. They are not independent customer-facing platforms. They become modules, channels, services or programmes inside one identity, one navigation system, one account model, one content catalogue and one commercial/analytics layer.

This document establishes the consolidation architecture. It does **not** claim that every module is already integrated, deployed or publicly live.

## 2. Product architecture

### Audience-facing destinations

| KORA destination | Scope |
|---|---|
| KORA STREAM | Movies, series, VOD and live viewing |
| KORA BROADCAST | Linear TV, FAST channels, live channels and radio |
| KORA ORIGINALS | KORA-owned/commissioned films, series and documentaries |
| KORA MUSIC | Music, artists, performances and audio |
| KORA KIDS | Children's programming and KORA Kids Studio |
| KORA NEWS | African news and current affairs |
| KORA SPORTS | Sports programming and coverage |
| KORA GAMING | Gaming, esports and African game creators |
| KORA BUSINESS | Enterprise, entrepreneurship, brands and investment stories |
| KORA EDUCATION | Learning, skills and youth opportunities |
| KORA CULTURE | Arts, heritage, faith and community storytelling |
| KORA MARKET | Events, tickets, merchandise and approved commerce |

These are navigation/content destinations under KORA NETWORK, not separate brands or separately deployed products unless a future business case explicitly requires an external distribution endpoint.

### Shared platform services

- **KORA ID:** single identity, profiles, access and entitlements.
- **KORA CREATOR HUB:** creator/producer onboarding, submissions and publishing workflow.
- **KORA RIGHTS CONTROL:** ownership, licences, territories, windows, restrictions and takedown records.
- **KORA CONTENT CORE:** one catalogue, metadata model, artwork, captions, language and asset relationships.
- **KORA BROADCAST CONTROL:** channel registry, schedules, playout and live-stream orchestration.
- **KORA ADVERTISING:** inventory, sponsorship, campaign and ad-performance records.
- **KORA COMMERCE:** subscriptions, purchases, tickets and payment entitlements.
- **KORA ANALYTICS:** audience, viewing, engagement, campaign and revenue reporting.
- **KORA GLOBAL COMMAND:** internal administration, operational oversight, partner pipeline and platform health; never a separate public consumer destination.
- **KORA DISTRIBUTION:** web, mobile, connected-TV and third-party distribution adapters.

## 3. Consolidation rules

1. One KORA brand and one canonical public entry point.
2. One navigation and design system; divisions appear as destinations within KORA.
3. One identity and entitlement model. No duplicate account silos.
4. One content catalogue and rights ledger. A content asset is registered once and surfaced in multiple destinations by metadata and permissions.
5. One commercial ledger for subscriptions, advertising, sponsorship, licensing, commerce and partner settlements.
6. One analytics model with consistent definitions for viewers, sessions, viewing hours, impressions, revenue and retention.
7. Shared services are modular. A module can be replaced without rebuilding the entire platform.
8. Preserve existing functioning code and content. Consolidate through adapters and staged migration, not indiscriminate rewrites.
9. KORA-owned infrastructure is the preferred deployment target under IZAKHONO's owned-first directive. External services remain replaceable adapters/fallbacks.
10. No claim of live, launched, production-ready or migrated until independently verified.

## 4. Existing repository evidence

The shared repository tree currently includes KORA-specific modules and assets including:

- `KORA-ID`, `KORA-TV`, `KORA-LIVE`, `KORA-MUSIC`, `KORA-NEWS`, `KORA-SPORT`, `KORA-LEARN`, `KORA-PAY`, `KORA-ACCESS`, `KORA-POLICY`, `KORA-TRUST`, `KORA-SECURITY`, `KORA-AI`, `KORA-CONNECT`, `KORA-AFRICA`, `KORA-WORK`, `KORA-EMERGENCY`, `KORA-FLEET`, `KORA-NAV`, and `KORA-VEHICLE`.
- KORA Kids Studio, casting, audio intake, localisation, mastering, finishing, rendering and release workflows.
- KORA Gospel TV assets and IZAKHONO-owned deployment scripts.
- KORA channel acquisition documentation and KORA TV channel schemas.

The presence of a folder, schema, workflow or script is not proof that its feature is integrated into the consumer application or running in production. Each module must be assessed for implementation completeness, tests, dependencies, data ownership and deployment status.

## 5. Current Vercel project audit (4 November 2026)

The connected Vercel account exposes three KORA-named projects:

| Project | Latest observed deployment | Observed status | Decision |
|---|---|---|---|
| `kora-network` | Production deployment READY; commit `b3f1f988` | Project API reports `live: false`; SSO protection enabled for non-custom domains | Canonical application candidate; keep as primary |
| `kora-global-command` | Latest deployment ERROR; an earlier deployment READY | Project API reports `live: false`; SSO protection enabled | Fold its required admin capabilities into KORA NETWORK; do not treat as a separate public platform |
| `kora-expansion-network` | Latest production deployment READY; same source commit as `kora-network` | Project API reports `live: false`; SSO protection enabled | Audit root/build configuration and unique functionality, then retire as a separate deployment only after parity is verified |

The latest observed KORA deployment is built from the `Downloads` repository on `main`. Vercel records READY deployment state, but the project-level `live: false` and SSO settings mean public availability must not be assumed. Verify custom-domain access, intended authentication behaviour, runtime health, and data integrations before declaring launch.

## 6. Canonical deployment direction

- Canonical public product: KORA NETWORK.
- Canonical application project: `kora-network`.
- Primary domain candidate: `streamkoraafrica.com` (domain is associated with the project; DNS/TLS/public access must be checked before launch claims).
- IZAKHONO-owned infrastructure remains the preferred runtime where the deployment package and host are verified.
- Vercel is a reversible deployment/fallback option, not the owner of KORA's identity, content rights, customer relationships or business logic.
- `kora-global-command` becomes the internal administration/operations module within KORA.
- `kora-expansion-network` is not to receive new standalone product scope; migrate any unique capabilities into the canonical application after audit.

## 7. Phased consolidation plan

### Phase 0 — Inventory and safety (current)
- Preserve current `main` and production deployments.
- Maintain this consolidation branch for architecture changes.
- Map every KORA route, component, API, database table, scheduled job, environment variable, storage bucket, domain and external integration.
- Identify duplicate features and unique functionality in the two secondary Vercel projects.
- Record module status as: implemented, partial, design-only, external dependency, or unverified.

### Phase 1 — One customer experience
- Establish a unified KORA shell: header, navigation, search, account, footer and responsive layout.
- Add the 12 audience-facing destinations as consistent routes/sections.
- Make all destinations resolve inside the same KORA application and identity context.
- Preserve existing working content and routes through redirects/compatibility paths.

### Phase 2 — Shared services
- Unify KORA ID and access/entitlements.
- Establish the canonical content catalogue and rights ledger.
- Connect broadcast, VOD, Kids and music as content types/destinations rather than separate account systems.
- Unify payments, advertising, subscriptions and commercial reporting.
- Provide one creator/partner onboarding workflow.

### Phase 3 — Internal command centre
- Incorporate Global Command capabilities into a protected KORA administration area.
- Add role-based permissions, audit logs, operational health, content approvals, partner pipeline, funding pipeline and revenue reporting.
- Keep administrative routes inaccessible to public users.

### Phase 4 — Distribution and owned-first runtime
- Define distribution adapters for web, mobile, connected TV, FAST and third-party partners.
- Preserve FAST Channels TV as an optional distribution partner, not a platform dependency.
- Validate IZAKHONO-owned runtime, health checks, TLS, DNS, backups and rollback before production cutover.
- Retain Vercel as a reversible fallback until owned runtime is verified.

### Phase 5 — Decommission duplicates safely
- Compare route and feature parity.
- Export required data and configuration.
- Confirm domain and traffic migration.
- Only then remove redundant project deployments or schedules with explicit rollback evidence.

## 8. Acceptance criteria

Consolidation is complete only when:

- A user enters through one KORA NETWORK identity and navigation.
- All approved destinations work inside one responsive customer experience.
- A content asset is catalogued once and can be surfaced in multiple destinations according to rights.
- One user/profile/entitlement model is enforced across destinations.
- Commercial transactions and revenue can be reconciled in one reporting layer.
- Administration is protected by roles and audit trails.
- All critical routes and workflows pass automated and manual tests.
- Domain, TLS, health checks, backups and rollback are verified.
- Unique capabilities from secondary projects are migrated or formally excluded.
- No separate KORA deployment is retired before parity and recovery are demonstrated.

## 9. Governance and exclusions

- KORA NETWORK is the master brand and product.
- IZAKHONO provides/owns the preferred infrastructure and supporting technology capabilities; it is not a competing KORA consumer brand.
- Allegro Vibez may be integrated as a content/channel partner or music destination where approved, without changing KORA's master identity.
- THE VOICE Community Online Radio is aborted and excluded unless explicitly reinstated.
- No customer-facing division may create a new standalone KORA brand or duplicate user system without approval through the master architecture.

## 10. Immediate engineering sequence

1. Inspect the KORA app root, package scripts, route tree, database schema and environment-variable names (never expose secret values).
2. Inspect the Vercel project root directories and build settings for all three projects.
3. Compare the latest `kora-network` and `kora-expansion-network` deployments; establish whether they are the same app configuration or have unique roots.
4. Inspect Global Command's last successful deployment and error logs; identify the admin functions worth migrating.
5. Produce a route/module/data/integration matrix.
6. Implement the unified shell and navigation in the canonical app.
7. Test in preview; do not promote to production until all acceptance gates pass.

---
**Operating principle:** One KORA ecosystem, modular internally, unified externally, owned-first operationally, and independently verifiable at every release gate.
