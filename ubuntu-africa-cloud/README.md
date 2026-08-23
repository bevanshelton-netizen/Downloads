# Ubuntu Africa Cloud v1.0 MVP

A multi-tenant managed website platform designed to launch on free-tier infrastructure first.

## Included
- Email/password authentication
- Organisation onboarding
- Tenant RLS foundation
- Managed website builder and templates
- Draft / submit / approve / publish workflow
- Public customer site pages
- Super-admin control centre
- Customer suspension
- Support tickets
- AI-assisted content request queue (manual during free pilot)
- Manual EFT records and admin verification
- Password reset
- Audit logging for sensitive admin actions
- Netlify deployment configuration
- Health/readiness endpoint at `/api/health`
- Single-run Supabase bootstrap script at `supabase/bootstrap.sql`

## Deployment target
- Netlify Free for the Next.js application
- Supabase Free for authentication and PostgreSQL
- GitHub for source control and build validation

## Not included by design
- Arbitrary customer code execution
- Shell or Docker access for customers
- Paid AI API integration
- Live PayFast integration
- Automatic custom-domain provisioning
- Production malware scanning

These should be added only after the pilot earns revenue and security testing is complete.

See `DEPLOY.md` for the launch sequence.
