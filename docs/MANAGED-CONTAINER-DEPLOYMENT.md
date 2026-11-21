# VIDEONOMY managed-container deployment specification

## Purpose

This specification makes the existing IZAKHONO-owned VIDEONOMY engine deployable on a managed cloud container host without requiring IZAKHONO to own physical server hardware. It does not select or authorise a hosting vendor and does not provision infrastructure.

## Runtime contract

- Build from the repository's `owned/Dockerfile` (Node.js 22).
- Start command is already defined by the image: `./owned/node_modules/.bin/tsx owned/server.mjs`.
- Set the container's listening port to the platform-assigned `PORT` (the application defaults to `18081`).
- Set `HOST=0.0.0.0` so the platform ingress can reach the process.
- Configure the platform's HTTP health probe as `GET /api/health` on the application port.
- Route public HTTPS traffic through the platform ingress/reverse proxy to the application port. Do not expose the container's filesystem or SQLite database directly.
- Set `APP_ENV=production` and `PUBLIC_BASE_URL` to the final HTTPS origin.

## Persistent storage and scaling constraints

The owned engine stores both its SQLite database and uploaded media below `VIDEONOMY_DATA_DIR` (default `owned/.owned-data`). Production must set `VIDEONOMY_DATA_DIR=/data` and mount a durable, encrypted persistent volume at `/data`.

The current engine uses SQLite WAL mode and local filesystem media storage. Therefore:
- Run exactly one application replica against a single writable volume. Do not horizontally scale this release or attach the same SQLite volume to multiple active instances.
- The selected host must support durable read/write filesystem storage that survives container replacement and restart.
- Confirm the platform's backup and restore behaviour for the complete `/data` volume. Back up database and media together using an application-consistent procedure.
- Do not use ephemeral container storage for production state.
- Revisit this constraint only after a separately tested migration to a multi-writer database and object storage.

## Required configuration

Supply secrets through the hosting provider's secret manager; never commit them to Git or put them in deployment logs:
- `ADMIN_SECRET`: strong, unique production admin secret.
- `ABUSE_SALT`: strong, unique production abuse-prevention salt.
- `PUBLIC_BASE_URL`: final public HTTPS origin.
- `ALLOWED_ORIGINS`: explicit allowed browser origins, where required.
- `IKHOKHA_APP_ID` and `IKHOKHA_APP_SECRET`: only after the production merchant account and callback configuration are approved. Keep payments disabled/unavailable until verified.
- PayFast credentials only if the commercial-package flow is explicitly enabled and tested.

Use the provider's production payment mode only after vendor credentials, webhook signature verification, callback URL, settlement handling and reconciliation have passed the launch acceptance tests. Never use real customer funds for initial smoke tests.

## Deployment and acceptance sequence

1. Select and authorise the hosting account and region.
2. Create one managed container service from this repository and branch; build with `owned/Dockerfile`.
3. Attach one durable volume at `/data`; configure the environment variables and secrets.
4. Configure the health probe and HTTPS ingress.
5. Deploy with one replica and verify `GET /api/health` returns HTTP 200 with the expected VIDEONOMY service identity and release version.
6. Verify the public homepage and `/shorts.html`.
7. Run controlled tests for creator session, MP4 upload/playback and byte-range requests, likes, follows and comments.
8. Verify database and media persistence across a controlled container restart.
9. Test payment callbacks and ledger transitions in the provider's approved test mode before enabling live payment credentials.
10. Verify backup and restore before public launch.

## Rollback

Keep the previous verified public route available until the new deployment passes acceptance. Before any schema or media migration, take and verify a recoverable backup of the complete persistent data set. Roll back by routing ingress to the last verified release; do not discard or overwrite the persistent volume.

## Explicit non-goals

- This document does not authorise creation of a paid hosting resource.
- It does not authorise use of unrelated IZAKHONO Supabase projects.
- It does not make Vercel's static frontend deployment the backend runtime.
- It does not approve production payment activation.
- A successful image build or deployment status is not proof of a successful production launch; public API, persistence, media, payment and security acceptance are required.
