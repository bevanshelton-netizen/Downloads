# Ubuntu Africa Cloud — Launch Guide

## 1. Hosting target: Netlify Free

Repository: `bevanshelton-netizen/Downloads`

Branch: `agent/ubuntu-africa-cloud-deploy`

The repository-level `netlify.toml` already configures:

- Base directory: `ubuntu-africa-cloud`
- Build command: `npm run build`
- Publish directory: `.next`
- Node.js: 22

No Cloudflare configuration is required for this deployment.

## 2. Supabase backend

Create one free Supabase project named `Ubuntu Africa Cloud`.

In SQL Editor run, in order:

1. `supabase/schema.sql`
2. `supabase/phase3.sql`
3. `supabase/final.sql`

Enable Email/Password authentication.

## 3. Netlify environment variables

Add these in Netlify under Site configuration > Environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL`

Keep `SUPABASE_SERVICE_ROLE_KEY` secret and server-only. Never commit it to GitHub or place it in a `NEXT_PUBLIC_` variable.

For the first deployment, `APP_URL` may be set to the Netlify production URL once Netlify assigns it, followed by one redeploy.

## 4. Supabase URL configuration

After Netlify assigns the live URL, set that URL as the Supabase Authentication Site URL and add:

- `https://YOUR-NETLIFY-SITE/auth/confirm`
- `https://YOUR-NETLIFY-SITE/update-password`

## 5. Owner setup

Register through the live application and confirm the email address.

Then run the super-admin INSERT provided in `supabase/final.sql`, replacing the placeholder email with the registered owner email.

## 6. Health check

Open:

`https://YOUR-NETLIFY-SITE/api/health`

Expected result before launch:

`status: ready`

If configuration is incomplete, the endpoint returns `configuration_required` and lists only the missing environment variable names. It never returns secret values.

## 7. Launch acceptance test

Before sharing the site publicly, verify:

- home page loads
- registration works
- verification email arrives
- login works
- organisation creation works
- customer dashboard is protected
- website project can be created and previewed
- project can be submitted for approval
- `/admin` works only for a platform admin
- admin can approve and publish a site
- published route `/sites/<slug>` loads publicly
- support ticket submission works
- content request submission works
- manual payment record flow works
- tenant A cannot access tenant B records
- suspended tenants cannot operate normally
- password reset completes successfully

## 8. Pilot launch rules

- Start with managed websites and approved templates only.
- Do not enable arbitrary customer code, shell or Docker access.
- Keep AI assistance manual during the zero-cost pilot.
- Keep payments as manual EFT records until a payment gateway is deliberately integrated and tested.
- Do not activate paid infrastructure or metered services without explicit owner approval.
- Monitor Netlify and Supabase free-tier usage before onboarding each additional customer batch.
