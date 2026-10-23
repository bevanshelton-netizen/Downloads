# KORA SECURITY

KORA SECURITY is the dedicated security orchestration and control layer for the KORA ecosystem.

## Architecture

`KORA ID → KORA SECURITY → FORTRESS → KORA VEHICLE / KORA FLEET / KORA NAV / KORA EMERGENCY`

## Purpose

KORA SECURITY coordinates security sessions, trusted identity/device references, access policies, threat states, security incidents, control requests, FORTRESS integration references and audit events across KORA services.

## Security states

- `normal`
- `elevated`
- `threat`
- `lockdown`
- `offline`
- `compromised`
- `resolved`

## Controls

- `monitor`
- `warn`
- `restrict`
- `escalate`
- `lock`

Security controls are requests until an execution acknowledgement confirms that the integrated control actually executed.

## Boundaries

KORA SECURITY is an orchestration layer. It must not claim physical security intervention, police/security dispatch, intrusion prevention, encryption status, authentication success, identity verification success, or any other external action unless that result is explicitly confirmed by an integrated system.

Do not store unnecessary passwords, tokens, private keys, biometric templates or other secrets in KORA SECURITY records.

Security escalation must be auditable, attributable, reversible where technically possible, and jurisdiction-aware.
