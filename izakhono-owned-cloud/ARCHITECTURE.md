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
      ├─ IZAKHONO DATA NODE   :8787
      ├─ IZAKHONO OBJECT NODE :8800
      ├─ IZAKHONO QUEUE NODE  :8810
      └─ IZAKHONO AUTH NODE   :8820

Control interfaces bind to loopback: RUNTIME control :8790 and EDGE control :8795.

## Identity plane

AUTH NODE is the single owned identity authority for human users and service accounts. Applications should not maintain parallel password databases.

AUTH NODE provides:
- scrypt password authentication;
- opaque sessions;
- roles and permissions;
- encrypted TOTP MFA;
- service identities and API keys;
- audit records.

The first owner is bootstrapped once from the server itself. Bootstrap permanently refuses to run after the first user exists.

## Security model

- Public source contains no generated service keys.
- Installer-generated keys live under `/etc/izakhono/*.env`.
- App-specific environment files live under `/etc/izakhono/apps/`.
- Internal services bind to loopback by default.
- EDGE is the public ingress layer.
- RUNTIME only launches allowlisted commands from a confined release root.
- DATA, OBJECT and QUEUE use authenticated private APIs.
- AUTH hashes passwords and sessions and encrypts TOTP secrets.
- Services run under a non-login `izakhono` account.
- systemd hardening limits filesystem access.
- No service relies on a browser-visible secret.

## Backup minimum

Back up:
- `/var/lib/izakhono-data`
- `/var/lib/izakhono-object`
- `/var/lib/izakhono-queue`
- `/var/lib/izakhono-runtime`
- `/var/lib/izakhono-auth`
- `/etc/izakhono`

Keep backups encrypted and maintain multiple physical copies. A single owned server is sovereignty, not redundancy.

## Expansion path

Next owned services: NOTIFY NODE, ANALYTICS NODE, AI GATEWAY NODE, CODE NODE expansion, backup replication and multi-node failover.

The stack remains modular so each service can later move onto its own machine without changing the application-facing API contract.
