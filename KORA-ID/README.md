# KORA ID

KORA ID is the identity and account layer for the KORA ecosystem.

## Architecture

`KORA ID → KORA AFRICA → KORA LEARN / WORK / PAY / NAV / AI / MEDIA`

One KORA identity can provide a consistent account experience across KORA services while preserving service-specific permissions and verification states.

## Core domains

- account identity and profile
- authentication and session references
- locale and jurisdiction context
- consent and privacy preferences
- service entitlements
- verification status
- role and organisation membership
- secure recovery references
- audit metadata

## Trust boundary

KORA ID is the account/control-plane layer. It must not imply that identity verification, government identification, professional licensing, financial KYC, employment checks or other regulated determinations have occurred unless those results are explicitly verified and attributed to the appropriate provider or authority.

External identity and verification providers remain adapters until KORA owns or is authorised to perform the relevant function.
