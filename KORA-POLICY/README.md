# KORA POLICY

KORA POLICY is the central policy-orchestration layer for KORA. It converts jurisdiction, organisation, service, trust, access and security context into explicit, auditable policy decisions.

## Architecture

`KORA AFRICA → KORA ID → KORA TRUST → KORA POLICY → KORA ACCESS → KORA SECURITY / FORTRESS → KORA SERVICES`

## Purpose

KORA POLICY provides a common decision layer so individual KORA services do not invent incompatible rules. Policies can be scoped by jurisdiction, organisation, service, resource, purpose and time.

## Core principles

- Explicit policy over implicit assumptions.
- Default deny when a required high-impact rule is missing.
- Jurisdiction-aware rules; countries and territories remain distinct policy contexts.
- Trust informs policy but does not automatically grant permission.
- KORA ACCESS remains responsible for authorisation decisions.
- KORA SECURITY can impose restrictive security conditions.
- Emergency policies must remain explicit and auditable.
- Policy evaluation does not mean an external action was executed.
- No claim of regulatory approval or legal compliance unless verified by the appropriate authority.
- Policies must be versioned and traceable.
