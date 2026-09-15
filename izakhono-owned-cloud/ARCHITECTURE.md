# IZAKHONO OWNED CLOUD — Architecture

## Public path

    Internet
      ↓
    IZAKHONO EDGE NODE :443
      ↓
    IZAKHONO RUNTIME NODE :8080
      ↓
    Application process

## Private service plane

    Application
      ├─ IZAKHONO DATA NODE      :8787
      ├─ IZAKHONO OBJECT NODE    :8800
      ├─ IZAKHONO QUEUE NODE     :8810
      ├─ IZAKHONO AUTH NODE      :8820
      └─ IZAKHONO ANALYTICS NODE :8830

Control interfaces bind to loopback: RUNTIME control :8790 and EDGE control :8795.

## Identity plane

AUTH NODE is the single owned identity authority for human users and service accounts. Applications should not maintain parallel password databases.

## Analytics plane

ANALYTICS NODE owns consent-aware behavioral and campaign analytics. It does not store raw IP addresses, rejects common PII property names, and HMAC-hashes visitor/session identifiers. AUTH NODE remains the identity authority; personal identity should not be copied into analytics events.

## Security model

- Public source contains no generated service keys.
- Installer-generated keys live under `/etc/izakhono/*.env`.
- App-specific environment files live under `/etc/izakhono/apps/`.
- Internal services bind to loopback by default.
- EDGE is the public ingress layer.
- RUNTIME only launches allowlisted commands from a confined release root.
- DATA, OBJECT and QUEUE use authenticated private APIs.
- AUTH hashes passwords and sessions and encrypts TOTP secrets.
- ANALYTICS avoids raw IP storage and requires consent in the supplied tracker.
- Services run under a non-login `izakhono` account.
- systemd hardening limits filesystem access.
- No service relies on a browser-visible server secret.

## Backup minimum

Back up:
- `/var/lib/izakhono-data`
- `/var/lib/izakhono-object`
- `/var/lib/izakhono-queue`
- `/var/lib/izakhono-runtime`
- `/var/lib/izakhono-auth`
- `/var/lib/izakhono-analytics`
- `/etc/izakhono`

Keep backups encrypted and maintain multiple physical copies.

## Expansion path

Next owned services: NOTIFY NODE, AI GATEWAY NODE, CODE NODE expansion, backup replication and multi-node failover.

The stack remains modular so each service can later move onto its own machine without changing the application-facing API contract.
