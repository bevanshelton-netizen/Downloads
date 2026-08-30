# IZAKHONO BUILDER

A reusable, free-first application engine for IZAKHONO projects.

## Default rule

Build with our own reusable stack first:

- Cloudflare Workers for application/API compute
- D1 for relational data
- R2 for object/file storage
- Worker static assets for the website
- GitHub Actions for automated validation
- Generated security secrets; never commit production secrets
- No paid SaaS dependency unless the required feature cannot be delivered safely on the free-first stack

## Create a new app

```bash
cd izakhono-builder
./create-app.sh my-app "My App"
cd ../my-app
./scripts/bootstrap.sh
```

The generator creates a deployable application with:

- responsive public landing page
- Worker API
- D1 migration
- R2 binding
- lead capture
- anti-abuse hashing/rate limiting
- same-origin CORS
- health endpoint
- one-command Cloudflare deployment
- CI validation

## Build philosophy

1. Reuse before rebuilding.
2. Free tier before recurring cost.
3. One-command deployment before dashboard clicking.
4. Secure defaults before feature volume.
5. Keep each business/project isolated even when it uses the same engine.
6. Add paid infrastructure only after demand, revenue, scale, or a hard technical requirement justifies it.

## Production note

The scaffold is a launch foundation, not a substitute for product-specific business logic. Each app should add only the modules it needs (payments, learning, marketplace, video, insurance workflows, etc.) on top of this base.