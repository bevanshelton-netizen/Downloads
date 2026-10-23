# KORA TRUST

KORA TRUST is the trust and verification orchestration layer connecting KORA ID, KORA SECURITY, FORTRESS, users, devices, vehicles and organisations.

## Architecture

`KORA ID → KORA TRUST → KORA SECURITY / FORTRESS → KORA SERVICES`

## Purpose

KORA TRUST records what has been asserted, what evidence or verifier supports the assertion, its scope, expiry and current state. Trust is contextual and must never be treated as a universal guarantee.

## Trust principles

- Verify before relying on a high-impact assertion.
- Separate identity, authentication, authorisation and verification.
- Scope trust to a subject, claim, verifier, jurisdiction and purpose.
- Expire or revoke trust when its validity changes.
- Never expose secrets or unnecessary biometric material in trust records.
- Never claim verification succeeded unless the integrated verifier provides a confirmed result.

KORA TRUST is an orchestration layer and does not itself constitute regulated identity verification, licensing, accreditation, certification or legal assurance unless an appropriately authorised external system confirms that result.
