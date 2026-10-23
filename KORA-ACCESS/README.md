# KORA ACCESS

KORA ACCESS is the unified authorisation and permission orchestration layer for KORA.

## Architecture

`KORA ID → KORA TRUST → KORA ACCESS → KORA SECURITY / FORTRESS → KORA SERVICES`

## Purpose

KORA ACCESS determines whether a subject may perform an action on a resource within a defined organisation, jurisdiction, service and context. It separates authorisation from identity and verification.

## Access model

- Subject: user, organisation, device, vehicle or service identity reference.
- Resource: KORA service, account, vehicle, fleet, record or capability.
- Action: read, create, update, operate, approve, administer, export or emergency-use.
- Scope: organisation, jurisdiction, service and purpose constraints.
- Decision: allow, deny, conditional or step-up-required.

## Security principles

- Default deny for undefined high-impact permissions.
- Least privilege and explicit scope.
- Trust state may inform access but does not itself grant authorisation.
- Security state can restrict otherwise permitted actions.
- Emergency workflows require explicit policy and auditability.
- No claim that an external action executed unless an integrated system acknowledges execution.
- Do not store passwords, private keys, access tokens or unnecessary biometric material in access records.
