# KORA Partner Gateway v1 — confidence gate

Legal operator: **IZAKHONO AFRICA (PTY) LTD trading as KORA**.

## What v1 is allowed to do

- Ingest an approved partner catalogue as metadata plus authorised HTTPS destination links.
- Discover partner content inside KORA.
- Track KORA-originated handoffs without storing IP addresses.
- Receive authenticated conversion callbacks from partners using hashed webhook keys.
- Show partner/member reporting for referrals and conversions.
- Record verified rights separately from catalogue metadata.
- Permit authenticated or direct playback only when the database rights decision finds a current verified grant for the viewer territory.

## What v1 is not allowed to do

- Treat catalogue metadata as a streaming licence.
- Accept HLS/DASH stream URLs through the catalogue-import endpoint.
- Mark partner-reported revenue as verified automatically.
- Represent a prospect as an active signed partner.
- Collect partner subscription money unless a separate reseller/collection agreement authorises it.
- Restream sports or premium television without explicit rights.

## Outreach readiness gate

A media house may be approached for a live 90-day handoff/acquisition pilot when all of the following are true:

1. Migration 023 is applied to the production KORA database.
2. KORA Partner Gateway Gate is green on the release revision.
3. The partner exists in status `pilot` or `active` with agreement state `pilot` or `full`.
4. At least one catalogue item is loaded with an HTTPS destination controlled or approved by the partner.
5. A test handoff produces a referral record and a clean redirect.
6. A signed test webhook produces a `reported` conversion without auto-verifying revenue.
7. Partner dashboard access is verified for the intended partner user.
8. Any authenticated/direct playback test has a separate current verified rights grant for the test territory.
9. Legal, privacy, content classification and brand-use approvals for the pilot are documented.
10. Public messaging describes the relationship exactly as contracted.

Until these gates pass, KORA can demonstrate the product but must not claim that a prospective media house has joined the platform.
