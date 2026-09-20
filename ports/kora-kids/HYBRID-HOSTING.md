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

## Outside mirrors
The same folder is intentionally portable. It can be deployed unchanged to an external Node/PaaS host using:

- `node server.mjs`
- the included `Dockerfile`
- the included `Procfile`

It can also be published as a static mirror from `index.html`; `health.json` is the static health marker.

External mirrors are failover and distribution infrastructure. They are not the system of record.

## Routing policy
1. Primary: IZAKHONO-owned hostname.
2. KORA Network route: `/kids/tumi-tala`.
3. External mirror/CDN URL.
4. GitHub Pages mirror.

Do not promote an external mirror to authoritative source. Source remains in IZAKHONO CODE/GitHub synchronization until the GitHub migration is fully complete.

## Safety
This preschool property should not collect child personal data or expose child-directed purchases. Parent-managed services, analytics and commerce must stay outside the child-facing experience.
