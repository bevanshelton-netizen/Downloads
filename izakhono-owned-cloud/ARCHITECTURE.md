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
      └─ IZAKHONO QUEUE NODE  :8810

Control interfaces bind to loopback: RUNTIME control :8790 and EDGE control :8795.

## Security model

- Public source contains no generated service keys.
- Installer-generated keys live under `/etc/izakhono/*.env`.
- App-specific environment files live under `/etc/izakhono/apps/`.
- Internal services bind to loopback by default.
- EDGE is the public ingress layer.
- RUNTIME only launches allowlisted commands from a confined release root.
- DATA, OBJECT and QUEUE use authenticated private APIs.
- Services run under a non-login `izakhono` account.
- systemd hardening limits filesystem access.
- No service relies on a browser-visible secret.

## Backup minimum

Back up `/var/lib/izakhono-data`, `/var/lib/izakhono-object`, `/var/lib/izakhono-queue`, `/var/lib/izakhono-runtime`, and `/etc/izakhono` inside an encrypted backup boundary.

Use multiple physical copies. A single owned server is sovereignty, not redundancy.

## Expansion path

Next owned services: AUTH NODE, NOTIFY NODE, ANALYTICS NODE, AI GATEWAY NODE, CODE NODE expansion, backup replication, and multi-node failover.

The current five-node stack is modular so each service can later move onto its own machine without changing the application-facing API contract.