# FAISReady Production API Contract

All endpoints require authenticated access unless marked public. Tenant-scoped routes derive `company_id` from the authenticated membership, not from untrusted client input.

## Identity
POST /api/auth/onboard-individual
POST /api/auth/onboard-company
GET /api/me
GET /api/me/memberships

## FAISReady ID
GET /api/passport
POST /api/passport/evidence
POST /api/passport/share-consent
DELETE /api/passport/share-consent/:id
POST /api/admin/credentials/:id/verify

## Learning and assessment
GET /api/learning/tracks
POST /api/assessments/start
POST /api/assessments/:id/answer
POST /api/assessments/:id/complete
GET /api/assessments/:id/result
POST /api/remediation/assign

## Employer workforce
GET /api/company/dashboard
GET /api/company/people
POST /api/company/people/invite
POST /api/company/assessments/assign
GET /api/company/readiness-report

## Careers
GET /api/jobs (public filtered listing)
POST /api/company/jobs
PATCH /api/company/jobs/:id
POST /api/jobs/:id/apply
GET /api/company/applications

## Payments
POST /api/payfast/create
POST /api/payfast/itn (public webhook, signature validated)
GET /api/entitlements

## Call centre
POST /api/callcentre/campaigns
GET /api/callcentre/campaigns
POST /api/callcentre/contacts
POST /api/callcentre/calls/start
POST /api/callcentre/calls/:id/disposition
POST /api/callcentre/provider/events (public webhook, provider signature validated)
GET /api/callcentre/calls/:id
POST /api/callcentre/calls/:id/qa
POST /api/callcentre/calls/:id/remediation
GET /api/callcentre/dashboard

## Normalised provider event
```json
{
  "provider": "string",
  "provider_event_id": "string",
  "provider_call_id": "string",
  "event_type": "ringing|answered|completed|recording_ready|failed",
  "from": "string",
  "to": "string",
  "occurred_at": "ISO-8601",
  "recording_locator": "optional provider reference",
  "metadata": {}
}
```

## QA result
```json
{
  "call_id": "uuid",
  "review_type": "human|ai_assisted",
  "score": 0,
  "findings": [
    {
      "category": "disclosure|conduct|accuracy|process|communication",
      "severity": "low|medium|high|critical",
      "note": "string",
      "learning_topic_code": "optional"
    }
  ],
  "requires_remediation": true
}
```

## Required server protections
- Authenticate before tenant data access
- Enforce Row Level Security at database level
- Verify webhook signatures before processing
- Idempotency on PayFast and telephony events
- Rate limit public webhooks and auth-sensitive routes
- Do not return private recording URLs directly; return short-lived signed URLs
- Log admin verification, sharing and QA changes
- Reject client-supplied company ownership assertions
