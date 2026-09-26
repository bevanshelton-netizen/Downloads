# IZAKHONO Platform Infrastructure Directive

**Status:** Portfolio-wide operating directive  
**Issued:** 22 September 2026  
**Updated:** 26 September 2026  
**Operator:** IZAKHONO AFRICA (PTY) LTD  
**Policy:** IZAKHONO-infrastructure-first, laptop-independent, externally reversible

## Decision

Every IZAKHONO platform will use the IZAKHONO infrastructure fabric as its primary technical home.

The owner laptop is **not infrastructure**. It is an administration/client device only. No platform may depend on the laptop for application runtime, deployment execution, workers, queues, databases, storage, authentication, AI inference, media processing, DNS, TLS, EDGE, monitoring, backup, scheduled jobs, public ingress, payment processing or availability.

A platform must continue operating when the laptop is powered off, disconnected, travelling, replaced or being repaired.

Verified external infrastructure may remain in service, or be restored immediately, whenever it is needed for public availability, revenue continuity, distribution, resilience or recovery. External providers remain replaceable adapters and must not become the source of truth.

## Laptop isolation rule

Effective immediately across the whole portfolio:

- laptop role: **ADMIN CLIENT ONLY**;
- platform-to-laptop runtime traffic: **FORBIDDEN**;
- laptop-to-platform administration: permitted only through authenticated management interfaces;
- laptop-hosted self-hosted runners must not carry platform execution labels;
- no production workflow may select the laptop as a runtime or deployment target;
- no platform health gate may require a loopback endpoint on the laptop;
- no platform may store production customer data, secrets, queues, model state, payment state or authoritative deployment state on the laptop;
- no public DNS record, TLS route or EDGE origin may resolve to the laptop;
- no background service required for customer availability may rely on Windows logon, WSL wake-up, laptop boot state or a user session;
- any historical “owner-host”, “ISN-01”, “NODE01 on laptop”, “boot wake” or similar path is legacy administration tooling only and must not be treated as production authority.

The laptop may still be used to approve, observe, diagnose, administer and securely connect to the infrastructure. It is not part of the production data plane or execution plane.

## ChatGPT task-limit independence

ChatGPT product limits are not IZAKHONO infrastructure limits.

No IZAKHONO product, service, workflow or deployment may inherit or enforce ChatGPT task-count, concurrency, session, quota, context-window or product-plan limits as part of its runtime architecture.

Portfolio requirements:

- long-running, scheduled, recurring, batch, parallel and background jobs run on IZAKHONO infrastructure first;
- each platform has its own independently deployable engine and must continue operating without an active ChatGPT session or owner laptop;
- each platform uses infrastructure-hosted workers, job queues and orchestration for concurrent execution;
- ChatGPT can assist with planning, coding, review, debugging and operator interaction, but is not a production runtime dependency;
- external compute, queues, hosting and APIs may be used only as reversible adapters or resilience capacity where approved;
- a ChatGPT interface limit must never become a product, worker, customer, deployment or operational limit;
- existing privacy, security, no-silent-tracking, fallback, rollback and live-verification rules remain mandatory.

## Authoritative architecture

The owned path is:

`IZAKHONO Infrastructure Fabric → CODE / Forge → Data / Auth / Storage / Queue / Analytics → Platform Engine / Runtime → FORTRESS → EDGE / TLS → IZAKHONO DNS`

NODE01, NODE02 and later node identifiers are **logical infrastructure roles**, not names for the owner laptop.

- NODE01 is the primary runtime/compute authority role inside IZAKHONO infrastructure.
- NODE02–NODE04 are infrastructure roles for scaling, standby, backup and recovery.
- A physical or virtual host may fulfil a node role only if it is part of the managed IZAKHONO infrastructure fabric and passes the required security, backup, rollback, health and independent public HTTPS gates.
- The owner laptop is explicitly ineligible to fulfil NODE01–NODE04 production roles.
- Automation targets verified infrastructure capabilities and the dedicated runner label `izakhono-infrastructure`, not a physical laptop hostname or user session.
- Forge and IZAKHONO Code hold the authoritative source and package history.
- FORTRESS controls security policy, secrets boundaries, health checks and audit evidence.
- EDGE terminates public HTTPS and routes traffic only to healthy infrastructure-hosted services.
- Backups, restore tests and rollback instructions are mandatory before public cutover.

## External infrastructure rule

Vercel, Cloudflare, GitHub Pages, controlled VPS capacity, Tailscale or other approved providers may be used as public bridges, distribution layers or fallbacks.

External infrastructure is:

- permitted for immediate launch and revenue continuity;
- retained until the owned route passes all public verification gates;
- replaceable without changing the product's authoritative source or ownership;
- suitable for failover when an owned infrastructure route is unavailable;
- not the portfolio's ultimate source of truth;
- never a reason to fall back to the laptop as a server.

Supabase may remain in use for data, authentication, storage or resilience where already approved. Its replacement or migration requires a separate, tested data plan; hosting migration alone does not authorize a database cutover.

## Public cutover gates

An owned deployment may be called **OWNED LIVE VERIFIED** only when all of the following pass:

1. Application and dependency health checks pass on the real IZAKHONO infrastructure target.
2. The target proves it is not the owner laptop and is eligible for the required infrastructure role.
3. The public domain returns the expected application over HTTPS.
4. DNS, certificates and EDGE routing are valid and monitored.
5. Backup creation and a restore test succeed.
6. A tested rollback or external failback route exists.
7. Secrets, customer data and administrative interfaces remain protected.
8. Product content, legal pages, claims and payment boundaries are approved.

Until then, the last verified external production route remains active.

## Status language

Every platform must use one of these evidence-based labels:

| Label | Meaning |
|---|---|
| **BUILT / VERIFIED** | Package and automated tests pass; no public availability claim. |
| **EXTERNAL LIVE VERIFIED** | A named external URL has passed a current public check. |
| **OWNED LIVE VERIFIED** | IZAKHONO infrastructure, DNS, HTTPS, EDGE and application health have passed the cutover gates. |
| **NOT YET PUBLIC** | No currently verified public route exists. |

The words “live,” “launched,” or “deployed” must not be used without matching evidence.

## Commercial and payment continuity

- iKhokha is the preferred South African payment route where the specific product, links, reconciliation process and legal pages are ready.
- Existing verified payment and lead-intake routes remain active until their replacements pass end-to-end testing.
- A hosting change must never silently change pricing, billing, customer records or settlement instructions.
- Payment processing and reconciliation must not depend on the owner laptop.
- Public fallback may be activated immediately to protect sales and customer access.

## Platforms covered

This directive applies to the full IZAKHONO portfolio, including:

- KORA, KORA Cinema, YHVH Gospel TV and KORA Kids
- Allegro-Vibez and Allegro Radio
- Edu-Build and ECD360
- FAISReady and DOXA-SURE
- AUTO AI and Learner Driver SA
- WorkNow, Memory Mania, Music School and Recording Studio
- CROWNÉ by Netty
- ZEELY-style platform, Business Websites / Supercool and The Chancellor
- FORTRESS, IZAKHONO Code, IZAKHONO Work, IZAKHONO Cloud and IZAKHONO Send
- every current and future IZAKHONO product unless a signed product-specific exception explicitly supersedes this directive

## Required platform inheritance

Each platform repository, package or deployment record must carry or inherit:

- `runtimeAuthority: IZAKHONO_INFRASTRUCTURE`;
- `laptopRuntimeDependency: false`;
- `laptopDataPlane: false`;
- `laptopDeploymentTarget: false`;
- its authoritative source location and approved commit/version;
- its owned infrastructure target and currently verified public route;
- its external fallback route;
- its data, authentication and payment dependencies;
- its platform-specific runtime engine, workers, queues and orchestration where required;
- health, backup, restore and rollback evidence;
- one of the approved status labels above.

Self-hosted production workflows must require the `izakhono-infrastructure` runner label. A generic `self-hosted`, `izakhono`, `owner-host`, `ISN-01` or laptop-bound label is insufficient for production execution.

## Current evidence position

The repository contains substantial sovereign infrastructure software, runtime packaging, health gates, security controls, backup/restore controls and platform deployment tooling. Historical owner-laptop launchers and WSL paths do not establish production infrastructure authority.

Therefore the current portfolio position is:

- IZAKHONO infrastructure is the primary execution destination.
- The owner laptop is an administration/client endpoint only.
- Platform execution must not wait for or communicate with the laptop.
- External infrastructure remains an approved, reversible resilience route.
- Existing verified external services remain protected until the owned infrastructure route is independently verified.
- NODE01 status refers only to the infrastructure role, never to the laptop.
- ChatGPT limits apply only to the ChatGPT interface, never to IZAKHONO runtime capacity.

## Immediate execution order

1. Remove the owner laptop from all platform runner/deployment target selection.
2. Require `izakhono-infrastructure` for every self-hosted production workflow.
3. Bind NODE01 and later node roles only to managed IZAKHONO infrastructure.
4. Verify CODE, Data, Auth, Storage, Queue, Runtime, FORTRESS, EDGE, DNS/TLS and backup services on that infrastructure.
5. Record the current production and fallback URL for every platform.
6. Preserve verified external routes while promoting owned infrastructure one platform at a time.
7. Promote only successful routes to **OWNED LIVE VERIFIED**.
8. Fail back externally whenever an owned-route gate fails; never fail back to the laptop.

This directive is effective immediately across the full IZAKHONO portfolio.
