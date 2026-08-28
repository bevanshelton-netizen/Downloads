# FAISReady Production Architecture

## Goal
Turn the current public beta into a secure, multi-tenant South African financial-services workforce platform without weakening the existing public experience.

## Product surfaces
- Individual learner portal
- Employer / institution portal
- FAISReady ID / competence passport
- Careers / jobs marketplace
- Workforce Intelligence
- Academy / development tracking
- Call Centre / QA / coaching module
- Administration / audit / support

## Recommended production stack
- Front end: existing FAISReady web application, progressively migrated from static GitHub Pages to authenticated application hosting
- Auth + database: Supabase (PostgreSQL + Auth + Row Level Security)
- Server-side APIs: serverless functions / API routes
- Payments: PayFast, secrets server-side only
- Telephony: provider adapter layer (Twilio, 3CX/SIP, Amazon Connect or SA provider), never hard-coded into domain logic
- Object storage: private recordings, evidence and documents with signed access URLs
- Monitoring: application logs, audit events, failed webhook queue

## Multi-tenant rules
Every employer-owned record carries `company_id`. Employees and managers access only their tenant. Candidates control explicit sharing of career-profile data. Admin access is audited.

## Core security controls
- Row Level Security on all tenant data
- No service-role or merchant secrets in browser code
- Separate public profile fields from private identity and evidence fields
- Signed URLs for documents/recordings
- Explicit consent events for candidate/employer sharing
- Retention status and deletion workflow for call recordings/transcripts
- Immutable audit trail for credential verification and QA decisions

## Telephony boundary
FAISReady owns:
- campaigns
- contacts
- learner/candidate/customer identity links
- call outcomes
- QA results
- coaching/remediation
- reporting

The provider owns:
- PSTN/SIP connectivity
- phone numbers
- media transport

Provider events are normalised into FAISReady's call-event API. This keeps the product portable.

## Regulatory integrity
- Never represent FAISReady as FSCA-accredited or as an examination body.
- Never treat internal readiness scores as official regulatory qualifications.
- Official RE status requires acceptable evidence and a verification trail.
- Psychometric testing must be separated from FAISReady's job-related knowledge/competence assessments and governed by appropriate South African professional/legal requirements.

## Production launch gates
1. Dedicated database project and environment variables
2. Auth and tenant onboarding
3. RLS tests across learner, company_manager and admin roles
4. Payment sandbox verification and entitlement creation
5. Credential evidence + verification workflow
6. Jobs and application moderation
7. Call-centre provider sandbox + recording-consent flow
8. QA/remediation loop
9. Backup, audit and retention policies
10. Pilot-company acceptance test

## Current external dependencies
The repository can contain all production code and schema, but live operation still requires authorised provider accounts/secrets for Supabase, hosting, PayFast and the selected telephony provider. Those values must be added directly in the relevant provider dashboard, never committed to GitHub.