# KORA KIDS — Hybrid hosting contract

## Primary
KORA KIDS is owned and primarily served by IZAKHONO infrastructure:

`ISN-01 -> IZAKHONO CODE -> IZAKHONO RUNTIME -> IZAKHONO EDGE`

Primary hostname:

`https://korakids.domains.izakhonoafrica.co.za`

The primary runtime must pass `GET /health` with:

- `ok: true`
- `service: kora-kids`
- `runtime: izakhono-owned`

## KORA integration
KORA Network is the public discovery layer for the same owned KORA Kids catalogue.

Routes:
1. Network home: `/kids`
2. Flagship original: `/kids/lebo-jabu`
3. Secondary original: `/kids/tumi-tala`

The Lebo & Jabu route redirects to a bundled static interactive experience and carries its Season 1 and language manifests with it. The portable KORA Kids port remains independently deployable on IZAKHONO-owned infrastructure.

## Outside mirrors
The same folder is intentionally portable. It can be deployed unchanged to an external Node/PaaS host using:

- `node server.mjs`
- the included `Dockerfile`
- the included `Procfile`

It can also be published as a static mirror from `index.html`; `health.json` is the static health marker.

External mirrors are failover and distribution infrastructure. They are not the system of record.

## Routing policy
1. Primary: IZAKHONO-owned hostname.
2. KORA Network discovery: `/kids`.
3. KORA flagship route: `/kids/lebo-jabu`.
4. External mirror/CDN URL.
5. GitHub Pages mirror.

Do not promote an external mirror to authoritative source. Source remains in IZAKHONO CODE/GitHub synchronization until the GitHub migration is fully complete.

## Safety
This children's property should not collect child personal data or expose child-directed purchases. Parent-managed services, analytics and commerce must stay outside the child-facing experience. Published language and cultural editions require human review before they can be marked live.
