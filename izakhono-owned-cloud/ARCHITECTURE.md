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
      ├─ IZAKHONO ANALYTICS NODE :8830
      ├─ IZAKHONO NOTIFY NODE    :8840
      ├─ IZAKHONO AI GATEWAY NODE :8850
      ├─ IZAKHONO CODE NODE       :8860
      ├─ IZAKHONO PACKAGE NODE    :8910
      ├─ IZAKHONO BACKUP NODE     :8870
      ├─ IZAKHONO CI WORKER NODE  :8880
      ├─ IZAKHONO REPLICA NODE    :8890
      ├─ IZAKHONO FAILOVER NODE   :8920
      └─ IZAKHONO DNS control     :8900

Control interfaces bind to loopback: RUNTIME control :8790, EDGE control :8795 and DNS control :8900. DNS data-plane starts safely on 127.0.0.1:5353 and moves to authoritative port 53 only during deliberate public-edge activation.

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
- NOTIFY encrypts contact destinations at rest and delegates scheduling/retries to QUEUE NODE.
- AI GATEWAY encrypts provider credentials, hashes client keys, stores no prompt/response bodies and can route to local model servers.
- CODE stores bare Git repositories on owned disks, hashes repo tokens, and signs outbound push webhooks.
- PACKAGE caches npm metadata and tarballs on owned storage and pins the upstream registry host.
- BACKUP encrypts snapshots before archive storage, verifies authenticated decryption, keeps its admin key private and restores only into staging.
- CI WORKER keeps repository clone tokens encrypted, strips infrastructure secrets from build environments, rejects non-allowlisted executables and defaults production builds to a systemd sandbox.
- REPLICA streams already-encrypted BACKUP archives to approved peers, verifies SHA-256 on receipt, stores immutable objects separately from replica metadata and never requires the BACKUP recovery key.
- FAILOVER observes primary/standby health, requires fencing before promotion approval and never mutates production DNS automatically in V1.
- Services run under a non-login `izakhono` account.
- systemd hardening limits filesystem access.
- No service relies on a browser-visible server secret.

## Recovery plane

BACKUP NODE captures the service data directories and `/etc/izakhono` into AES-256-GCM encrypted archives. Its archive directory is not included in its own source set.

At least one mirror target must be a physically separate disk, NAS or second machine for meaningful disaster resilience. The BACKUP encryption recovery key must also exist on a separate offline medium; losing both the server and that separately stored key makes the encrypted archives unrecoverable.

## Backup source set

Back up:
- `/var/lib/izakhono-data`
- `/var/lib/izakhono-object`
- `/var/lib/izakhono-queue`
- `/var/lib/izakhono-runtime`
- `/var/lib/izakhono-auth`
- `/var/lib/izakhono-analytics`
- `/var/lib/izakhono-notify`
- `/var/lib/izakhono-ai-gateway`
- `/var/lib/izakhono-code`
- `/var/lib/izakhono-package`
- `/var/lib/izakhono-ci`
- `/var/lib/izakhono-replica` (metadata only)
- `/var/lib/izakhono-failover`
- `/etc/izakhono`

BACKUP NODE archive storage itself lives under `/var/lib/izakhono-backup` and is deliberately excluded from the source set.

REPLICA received archive objects live under `/srv/izakhono-replica-objects` and are also excluded. Only REPLICA metadata under `/var/lib/izakhono-replica` is included.

Keep encrypted archives on multiple physical devices and periodically prove restore into staging.

## Independent witness plane

WITNESS NODE runs on a third failure domain, not inside the primary service plane:

    Primary host ─┐
                  ├── private/VPN network ── IZAKHONO WITNESS NODE :8930
    Standby host ─┘

The witness grants one short leadership lease at a time and signs lease receipts with Ed25519. Each leadership transfer increments a fencing token. The private signing key remains on the witness; application hosts only need the public key plus their own member credential.

The witness alone does not make failover automatic. An old primary must be forced to stop writes when its lease expires, so RUNTIME/EDGE enforcement and physical multi-host proof remain required.

## Expansion path

Next owned availability step: enforce witness leases/fencing in RUNTIME and EDGE on two physically distinct production hosts, then prove controlled DNS/route automation.

The stack remains modular so each service can later move onto its own machine without changing the application-facing API contract.
