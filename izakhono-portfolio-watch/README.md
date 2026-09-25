# IZAKHONO PORTFOLIO WATCH

Owner-controlled competitive, product, pricing, workflow and regulatory monitoring for the full IZAKHONO portfolio.

## Purpose

Hosted task products can impose small account-level task limits. Portfolio Watch moves this capability onto IZAKHONO-controlled infrastructure and does not impose an application-level count such as five tasks.

This service is an operations control plane. It does not replace any product's own engine. Every platform remains independently deployable.

## What it monitors

Each platform has an isolated profile in `portfolio.json` with official or high-value sources relevant to its category. The initial registry covers 42 current platform/product lines and is designed to expand.

Signals include:

- meaningful launches and feature releases;
- AI, agent and automation capabilities;
- creator and small-business workflow changes;
- pricing, packaging, plan and credit changes;
- regulatory/accreditation/compliance notices;
- fraud, security and trust developments;
- marketplace, payments, employment, automotive and infrastructure changes.

## Noise control

The first successful fetch is a baseline and does not alert.

After baseline, the engine extracts only watched sentences and pricing markers, hashes that signal set, and alerts only when the material signal changes and crosses the platform threshold. Dynamic page chrome is intentionally ignored as much as possible.

## Alert format

Every alert records:

1. what changed;
2. likely impact on the named IZAKHONO platform;
3. one product decision worth considering;
4. source URL and materiality score.

Alerts are always retained in the owned SQLite ledger. If `IZA_WATCH_NOTIFY_URL` is configured, a copy is sent to the selected IZAKHONO notification adapter.

## Owned architecture

Primary intended route:

`NODE01 / ISN-01 -> IZAKHONO Portfolio Watch -> local SQLite -> IZAKHONO NOTIFY NODE -> owner inbox`

Public exposure is not required. The service binds to `127.0.0.1` by default.

The service has its own internal scheduler, so it does not consume ChatGPT task slots and does not require GitHub Actions or an external cron service to operate. It can also be triggered manually through its authenticated API.

## Run locally

Python 3.11+ is recommended. No third-party Python packages are required.

```bash
cd izakhono-portfolio-watch
export IZA_WATCH_ADMIN_TOKEN="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
python3 app.py
```

Health:

```
GET http://127.0.0.1:8860/health
```

Authenticated endpoints:

```
GET  /api/platforms
GET  /api/alerts
GET  /api/runs
POST /api/run
Authorization: Bearer <IZA_WATCH_ADMIN_TOKEN>
```

## Linux / NODE deployment

```bash
cd izakhono-portfolio-watch
sudo bash install-linux.sh
```

The installer creates a dedicated system user, persistent state under `/var/lib/izakhono-portfolio-watch`, a root-readable environment file, and a hardened systemd service.

## Docker

```bash
docker build -t izakhono-portfolio-watch .
docker run -d \
  --name izakhono-portfolio-watch \
  --restart unless-stopped \
  -p 127.0.0.1:8860:8860 \
  -e IZA_WATCH_HOST=0.0.0.0 \
  -e IZA_WATCH_ADMIN_TOKEN='replace-with-long-random-secret' \
  -v izakhono-portfolio-watch-data:/app/data \
  izakhono-portfolio-watch
```

## Notification integration

Set:

```bash
IZA_WATCH_NOTIFY_URL=http://127.0.0.1:<notify-port>/<owned-adapter-endpoint>
IZA_WATCH_NOTIFY_KEY=<adapter-key-if-required>
```

If no notify route is configured, alerts remain available in the local ledger through `/api/alerts`; the monitor still works.

## Privacy and safety

- no advertising IDs;
- no behavioral user tracking;
- no customer-data scraping;
- public competitor/regulator pages only;
- admin API protected by bearer token;
- localhost binding by default;
- no arbitrary shell execution;
- no credentials stored in `portfolio.json`;
- first-party/official sources preferred;
- external sources are replaceable inputs, not infrastructure dependencies.

## Capacity

There is no hard-coded platform or task count limit. Real capacity depends on CPU, memory, source count, fetch latency and check frequency. A six-hour default cadence is deliberately conservative for public product/pricing/regulatory pages.

## Status

Code and tests can prove **BUILT / VERIFIED LOCALLY** after CI passes. Do not call the owned monitor **OWNED LIVE VERIFIED** until it is installed on the real NODE01/ISN-01 target and its health/API run is verified there.
