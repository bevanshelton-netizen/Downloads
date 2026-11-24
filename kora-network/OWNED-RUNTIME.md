# KORA on IZAKHONO HOST

## Target

The KORA web application runs as a Node.js container on IZAKHONO-owned HOST infrastructure, behind the IZAKHONO Caddy edge. Vercel is a legacy serving path and reversible fallback until the owned runtime passes independent acceptance.

This document describes the KORA-side build contract. The HOST-side Compose service and routing live in `bevanshelton-netizen/izakhono-builder/products/izakhono-host`.

## Build configuration

Next.js compiles `NEXT_PUBLIC_*` variables into the client bundle. They must be provided as Docker build arguments:

- `NEXT_PUBLIC_APP_NAME`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_KORA_DB_SCHEMA`

`kora-network/Dockerfile` accepts these arguments. Its defaults are non-secret placeholders for CI and package validation. Production builds must supply the real public application URL and Supabase public project/key values. Runtime-only environment variables cannot repair public values already compiled into the browser bundle.

Never pass any Supabase secret/service-role key, Cloudflare Stream token, PayFast credential, webhook secret or KORA internal API secret as a Docker build argument. Those values belong only in the container runtime environment and must be delivered through the approved FORTRESS secret mechanism.

## Runtime configuration

The HOST operator materializes the local `kora.env` from approved FORTRESS secret references. It must contain the server-only Supabase secret, Cloudflare Stream token, PayFast merchant credentials, KORA internal API secret and the approved public application configuration. The file must not be committed or copied into the image.

Keep PayFast in sandbox and all legal, regulatory, child-safety, payout, backup and incident-response approvals false until each named operating process is genuinely signed off.

## Acceptance

- `GET /api/health` proves process liveness only.
- `GET /api/readiness` is the strict production readiness gate.
- `GET /api/version` identifies the deployed source/schema version without exposing secrets.
- `npm run smoke:owned-runtime` checks the owned HTTPS edge, homepage, live/watch routes, health and version endpoints.
- Public launch additionally requires playback, authentication, recurring payment, PPV, creator, moderation, Kids Mode, backup/restore and rollback acceptance.

A healthy container or a successful image build is not a public-live claim. DNS cutover remains a separate, explicitly authorized operation after the owned runtime passes all required evidence.
