# Ubuntu Africa Cloud — Deployment Guide

## A. Supabase
1. Create a free Supabase project.
2. SQL Editor: run `supabase/schema.sql`, then `supabase/phase3.sql`, then `supabase/final.sql`.
3. Authentication: enable Email/Password.
4. Set Site URL to your deployed URL.
5. Add redirect URLs: `/auth/confirm` and `/update-password` on the deployed origin.
6. Create your own account through the app.
7. In SQL Editor, replace `YOUR_EMAIL_HERE` in the commented statement in `final.sql` and run that one INSERT to make yourself super admin.

## B. Environment variables
Set all four variables from `.env.example`. `SUPABASE_SERVICE_ROLE_KEY` is server-only and must never be exposed in browser code or committed.

## C. Local test
```bash
npm install
npm run typecheck
npm run build
npm run dev
```

## D. Free deployment route
Use Cloudflare Workers for the full-stack Next.js deployment. For an existing Next.js project, current Cloudflare tooling can auto-detect and configure the framework. From the project folder run `npx wrangler deploy`, sign in to Cloudflare when prompted, and accept the generated configuration. Deploy first to the free `*.workers.dev` address. Free quotas may change, so verify the dashboard before launch.

## E. First launch test
- Register owner account and verify email.
- Create organisation.
- Create a website project.
- Submit it.
- Open `/admin` as the super admin.
- Approve and publish.
- Verify public route `/sites/<project-slug>`.
- Create support/content/payment records.
- Confirm another customer cannot read the first customer's project IDs.

## F. Production rules
- Never expose service-role key.
- Keep arbitrary code uploads disabled.
- Keep customer shell/Docker access disabled.
- Use manual EFT only until PayFast is deliberately integrated and tested.
- Add real backup/restore testing before charging customers.
- Recheck free-tier limits before onboarding each batch of customers.
