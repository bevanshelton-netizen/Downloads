# KORA Network — Owned-First Deployment Architecture

## Objective
KORA production must not depend on a single external hosting provider. The canonical source remains GitHub, while production hosting is designed around IZAKHONO-owned infrastructure with external providers used only as reversible fallbacks.

## Architecture

GitHub (canonical source)
→ CI/build pipeline
→ KORA deployment artifact
→ IZAKHONO-owned hosting/runtime
→ CDN/DNS edge
→ streamkoraafrica.com

Fallbacks:
- External cloud host
- Vercel (emergency/preview only)

## Deployment principles

1. GitHub is the source of truth.
2. Production artifacts must be portable.
3. Build and runtime configuration must not depend on Vercel-specific APIs.
4. Domains and DNS must remain portable.
5. Media storage must be separable from application hosting.
6. Database/auth/storage services must be independently replaceable.
7. A failed provider must not prevent KORA from being restored elsewhere.
8. No provider migration is considered complete until production is independently verified.

## KORA runtime layers

- Web application: Next.js/Node runtime
- Media layer: object storage + CDN
- Data layer: PostgreSQL/Supabase-compatible services
- Authentication: portable OAuth/email authentication
- Payments: gateway abstraction
- DNS/TLS: independently managed
- Monitoring: provider-independent health checks
- CI/CD: GitHub-driven build and deployment

## Immediate migration sequence

1. Freeze the verified KORA landing-page commit.
2. Produce a portable production build/container.
3. Establish an IZAKHONO-owned runtime target.
4. Add health checks and rollback capability.
5. Connect `streamkoraafrica.com` only after the new runtime passes verification.
6. Keep Vercel as a fallback until the owned runtime has demonstrated stable production service.
7. Remove Vercel as a production dependency once the owned path is proven.

## Current canonical landing-page commit

`d16adebdcc4057634923f1ca889917760b69a11a`

This commit contains the African-first, network-led KORA landing-page redesign.
