# KORA 90-Day Commercial Partner Pilot

## Purpose

This module turns the KORA Partner Gateway into a measurable 90-day distribution and customer-acquisition pilot for authorised media partners.

It does **not** grant content rights, imply a signed relationship, change partner DRM/authentication, or alter KORA payment infrastructure.

## Surfaces

- Public proposal: `/partners/pilot`
- Existing public partner gateway: `/partners`
- Existing partner dashboard: `/partner`
- Pilot control room: `/partner/pilot`

## Pilot lifecycle

1. **Draft** — KORA and the prospective partner scope territory, customer journey, attribution and economics.
2. **Approved** — commercial/technical owners approve the pilot but traffic is not yet active.
3. **Live** — approved referrals and partner conversion callbacks may be associated with the pilot.
4. **Day 30** — acquisition-quality and integration-friction review.
5. **Day 60** — optimisation review.
6. **Day 90** — expand, extend, deepen integration, negotiate content rights, or conclude.
7. **Completed/Cancelled** — pilot evidence remains available for audit/reconciliation.

## Evidence model

`partner_referrals.pilot_id` associates a KORA hand-off with the pilot.

`partner_conversions.pilot_id` associates a partner-reported commercial event with the pilot.

Reported conversions are not automatically revenue. The control room treats only `status='verified'` events as verified conversions/revenue.

## Rights boundary

The existing Partner Gateway remains authoritative:

- direct playback requires a verified rights grant;
- authenticated playback requires the approved partner integration/right;
- external hand-off remains the default low-risk mode;
- no pilot status can override territorial or asset-level rights controls.

## Commercial parameters

The public pilot page presents KORA's opening negotiation framework:

- fixed acquisition fee **or** approximately 10–20% of a qualifying initial transaction;
- approximately 3–8% ongoing attributable subscription revenue only where KORA continues to deliver measurable value;
- no automatic minimum guarantee;
- no automatic exclusivity.

These are negotiating parameters, not existing third-party terms.

## Prospective partner representation

The public page explicitly states that CANAL+, MultiChoice, DStv or any other prospective organisation is **not represented as a signed KORA partner until an agreement is effective**.

## Database activation

Apply migrations through:

`supabase/024_partner_pilot.sql`

The guarded bootstrap and incremental database activation scripts have been advanced to schema 24.

Do not apply a migration to an unverified database target. The existing pinned-project checks and public-launch safety gates remain in force.

## Infrastructure

The IZAKHONO portfolio directive remains authoritative:

`ISN-01 / NODE01 -> CODE / Forge -> Data/Auth/Storage -> Runtime -> FORTRESS -> EDGE/TLS -> IZAKHONO DNS`

External infrastructure remains a reversible resilience path until the owned route passes all public cutover gates.

This module does not itself change hosting, DNS, payment providers, prices, customer records or settlement instructions.
