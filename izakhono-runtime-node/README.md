# IZAKHONO RUNTIME NODE

Owned application runtime and release router for IZAKHONO platforms.

This is the second piece of the owned stack after IZAKHONO DATA NODE.

## Current capabilities

- register apps by hostname;
- deploy a staged release from disk;
- launch Node/Next.js-compatible processes;
- health-check before activation;
- atomic route switch after a healthy release;
- preserve previous deployment metadata;
- one-command rollback;
- stop apps;
- reverse-proxy requests by Host header;
- per-release logs;
- activity ledger;
- private loopback control API protected by `IZAKHONO_RUNTIME_KEY`;
- zero runtime npm dependencies.

## Deployment contract

Releases are staged below `IZAKHONO_RELEASE_ROOT`. The control API never accepts an arbitrary path outside that root.

Production apps should expose a health endpoint and use either:

```json
{"command":["node","server.js"],"healthPath":"/health"}
```

or an approved npm start command.

Application secrets live in files below `IZAKHONO_ENV_ROOT`, outside source control.

## What this replaces

It replaces the basic application-runtime portion of a hosted deployment platform. It does **not yet** replace public DNS, automatic TLS certificates, global CDN/edge caching, or external DDoS protection. Those belong to IZAKHONO EDGE NODE, the next owned layer.

## Cost model

The software has no hosted-platform subscription. Running it still requires hardware, electricity, connectivity, backups and operational maintenance.
