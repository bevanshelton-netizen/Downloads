# IZAKHONO RUNTIME NODE

Owned application runtime and release router for IZAKHONO platforms.

This is the second piece of the owned stack after IZAKHONO DATA NODE.

## Current capabilities

- register apps by hostname;
- attach additional hostname aliases to an active app without launching a second process;
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


## Witness lease guard

RUNTIME supports three witness modes:

- `off` — no witness activity.
- `observe` — acquire and cryptographically verify WITNESS leases, expose lease/fencing status and forward the fencing token, but never block application traffic.
- `enforce` — all observe behavior plus fail-closed blocking of POST/PUT/PATCH/DELETE when a valid signed lease is absent or expired.

The Linux installer defaults to `IZAKHONO_WITNESS_MODE=observe`. It does not configure a witness credential automatically. This keeps the current single-host runtime unchanged while allowing a primary/standby host to be enrolled explicitly later.

A verified fencing token is propagated downstream as `x-izakhono-fencing-token`. Applications must treat GET/HEAD/OPTIONS as read-only for enforcement semantics to remain valid.


## External bridge aliases

The protected control API supports aliases for external ingress providers:

`POST /v1/apps/{app}/aliases`

Body:

```json
{"hostname":"example.ts.net"}
```

Aliases follow the app's current active deployment automatically, so a temporary public bridge can route through the same RUNTIME process and preserve rollback semantics.
