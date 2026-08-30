# IZAKHONO BUILDER

A reusable, free-first application factory for IZAKHONO projects.

## Primary interface: Control Panel

`control-panel/` is now the main way to use the builder. It provides a visual dashboard to:

- register a new application
- choose reusable modules
- generate a build recipe automatically
- track build status from draft to deployment
- keep project history in D1
- protect owner operations with a server-side admin secret
- validate the control panel through GitHub Actions
- deploy the builder itself with one bootstrap command

Deploy the control panel:

```bash
cd izakhono-builder/control-panel
./scripts/bootstrap.sh
```

The bootstrap flow authenticates Cloudflare, provisions the D1 database, applies migrations, generates the private builder admin secret, stores it as a Worker secret, and performs the final deployment.

## Default rule

Build with our own reusable stack first:

- Cloudflare Workers for application/API compute
- D1 for relational data
- R2 for object/file storage when required
- Worker static assets for websites
- GitHub Actions for automated validation
- generated security secrets; never commit production secrets
- no paid SaaS dependency unless the required feature cannot be delivered safely on the free-first stack

## Standard modules

The control panel can plan applications with Leads & CRM, Accounts & Auth, File Uploads, Payments, Email & Notifications, Admin Dashboard, Analytics, Marketplace, Learning, Video and AI Assistant modules.

These modules describe the architecture a project should inherit. Product-specific business logic is added on top rather than rebuilding infrastructure from scratch.

## Command-line generator

The original generator remains available for automation and recovery:

```bash
cd izakhono-builder
./create-app.sh my-app "My App"
cd ../my-app
./scripts/bootstrap.sh
```

It creates a deployable application with a responsive public site, Worker API, D1 migration, R2 binding, lead capture, anti-abuse controls, same-origin CORS, health endpoint, one-command Cloudflare deployment and CI validation.

## Build philosophy

1. Reuse before rebuilding.
2. Free tier before recurring cost.
3. Visual workflow or one-command deployment before dashboard clicking.
4. Secure defaults before feature volume.
5. Keep each business/project isolated even when it uses the same engine.
6. Add paid infrastructure only after demand, revenue, scale, compliance or a hard technical requirement justifies it.

## Production note

IZAKHONO BUILDER is the launch factory. It accelerates creation and standardises infrastructure, but each operating platform still receives the product-specific workflows it actually needs.
