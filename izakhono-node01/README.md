# IZAKHONO NODE01

NODE01 is the first-class sovereign compute node for the IZAKHONO portfolio.

It is not a Vercel project, a GitHub runner, a ChatGPT runtime, or a cloud-provider VM contract. Those may be used as replaceable adapters or resilience paths, but NODE01 remains the authority.

## Core contract

NODE01 owns and supervises:

- IZAKHONO DATA NODE
- IZAKHONO RUNTIME NODE
- IZAKHONO OBJECT NODE
- IZAKHONO QUEUE NODE
- IZAKHONO AUTH NODE
- IZAKHONO ANALYTICS NODE
- IZAKHONO NOTIFY NODE
- IZAKHONO AI GATEWAY NODE
- IZAKHONO CODE NODE
- IZAKHONO PACKAGE NODE
- IZAKHONO CI WORKER NODE
- IZAKHONO BACKUP NODE
- IZAKHONO REPLICA NODE
- IZAKHONO FAILOVER NODE
- IZAKHONO DNS NODE
- IZAKHONO EDGE NODE when TLS or an approved bridge is available

The NODE01 controller binds only to `127.0.0.1:8940`.

## What makes NODE01 ours

- machine identity is generated locally and stored under `/etc/izakhono`;
- service secrets are generated and retained locally;
- application releases live on owned storage;
- internal services bind to loopback/private interfaces;
- public traffic enters only through IZAKHONO EDGE;
- external providers are adapters, not authorities;
- no behavioural tracking, profiling or silent analytics is built into NODE01;
- the system can continue running if GitHub, Vercel or ChatGPT are unavailable.

## Install

On a dedicated Ubuntu/Debian system with systemd and Node.js 22.13+:

```bash
sudo bash BUILD-IZAKHONO-NODE01.sh
```

The installer first installs the existing IZAKHONO owned-cloud service plane, then installs NODE01 identity, controller, watchdog and acceptance proof.

## Health

```bash
curl -fsS http://127.0.0.1:8940/health
curl -fsS http://127.0.0.1:8940/v1/status
```

A healthy NODE01 does not imply a public hostname is live. Public-live status still requires independent DNS/TLS/HTTPS verification.

## Recovery

NODE01's watchdog checks installed, enabled IZAKHONO services and restarts only allow-listed services that unexpectedly become inactive. It never changes public DNS, payment routing or provider credentials.

## Hardware

NODE01 software is hardware-independent. For a serious primary production host, use ECC-capable memory where practical, mirrored NVMe storage, UPS power and a second physical backup target. See `HARDWARE.md`.
