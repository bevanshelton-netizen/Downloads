# FAISReady Twilio Telephony Adapter

## Decision
Twilio is the first telephony provider for the South African launch because it supports South African inbound/outbound voice, local/mobile numbers, SIP, browser/app calling and recording on usage-based pricing.

## Architecture
FAISReady owns:
- users, employers and tenants
- campaigns
- contacts and consent
- agent assignment
- call metadata
- QA and AI insights
- remediation and audit logs

Twilio owns:
- PSTN/SIP connectivity
- phone-number provisioning
- call routing/media
- recordings where enabled

The provider is deliberately replaceable. No core FAISReady table depends on Twilio-specific IDs except optional provider reference fields.

## Server-only environment variables
Never place these in GitHub Pages/client JavaScript:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_API_KEY`
- `TWILIO_API_SECRET`
- `TWILIO_CALLER_ID`

Frontend code may call authenticated FAISReady server/Edge endpoints only.

## Required server endpoints

### POST /telephony/calls
Authenticated employer/agent action.

Input:
```json
{
  "organization_id": "uuid",
  "campaign_id": "uuid|null",
  "contact_id": "uuid",
  "to": "+27..."
}
```

Server responsibilities:
1. Verify JWT.
2. Verify agent belongs to the organization.
3. Verify lawful contact/consent state and campaign permission.
4. Create a pending `calls` row.
5. Ask Twilio to originate the call.
6. Store provider call SID in `provider_call_id`.
7. Return a safe call-state payload.

### POST /telephony/twilio/status
Public provider webhook with Twilio signature validation.

Updates:
- ringing
- answered/in-progress
- completed
- busy
- no-answer
- failed
- duration

### POST /telephony/twilio/recording
Public provider webhook with Twilio signature validation.

Stores only controlled recording metadata/reference. Access to the recording itself must remain restricted and follow retention policy.

## POPIA / compliance gates
Before dialling:
- record purpose/lawful basis
- respect opt-out/do-not-contact flags
- disclose recording where required
- restrict recording/transcript access by tenant and role
- apply retention/deletion policy
- retain audit trail for QA/remediation actions

## FAISReady remediation loop
Call -> QA -> gap detected -> remediation task -> learning assignment -> reassessment -> supervisor review.

## Activation checklist
- [ ] Twilio account created/verified
- [ ] South African number provisioned or BYOC/SIP connected
- [ ] production credentials stored only in server/Edge secret store
- [ ] webhook URLs registered
- [ ] signature validation verified
- [ ] outbound test call
- [ ] inbound test call
- [ ] recording-consent flow verified
- [ ] tenant isolation verified
- [ ] opt-out flow verified
