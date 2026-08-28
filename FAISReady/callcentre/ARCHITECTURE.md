# FAISReady Call Centre — South Africa Architecture

## Objective
Build the call-centre capability as a native FAISReady module while keeping telephony provider infrastructure replaceable.

## Core principle
FAISReady owns the workflow, workforce intelligence, learner/candidate context, consent records, quality assurance, remediation and reporting. A third-party telephony/contact-centre provider supplies voice transport and call events.

## Core entities
- organisations
- users
- agents
- supervisors
- contacts
- candidates
- learners
- employees
- campaigns
- queues
- calls
- call_events
- call_dispositions
- callbacks
- consent_records
- recordings
- transcripts
- qa_scorecards
- qa_results
- compliance_checks
- coaching_actions
- learning_assignments
- job_matches
- employer_cohorts
- audit_logs

## Key relationships
- A contact may link to one FAISReady ID.
- A FAISReady ID may link to learner, candidate and employee contexts.
- A call belongs to an organisation, agent, campaign/queue and contact.
- A call may create a callback, learning assignment, job-match action or supervisor review.
- QA results may trigger coaching or remediation.

## Telephony adapter contract
A provider adapter should support:
1. start_outbound_call(contact, agent, campaign)
2. receive_inbound_call(event)
3. receive_call_status(event)
4. receive_recording_reference(event)
5. receive_transcript(event)
6. hangup_call(call_id)
7. transfer_call(call_id, destination)
8. fetch_provider_health()

No provider-specific fields should leak into the core domain model except provider IDs stored as external references.

## South African governance controls
- POPIA purpose limitation and data minimisation.
- Explicit configurable consent/notice for recording where required.
- Direct-marketing suppression and lawful-contact rules.
- Do-not-contact registry per organisation and campaign.
- Role-based access to recordings and transcripts.
- Retention policies configurable by institution.
- Audit trail for access, edits, exports and QA decisions.
- Separation of internal readiness scores from official RE qualification status.
- No automated representation that FAISReady is the FSCA or an exam body.
- Employment-related assessments must remain job-related, fair and governed appropriately.
- Psychometric testing, where used, remains partner/professional governed and separate from ordinary call-centre QA.

## AI call intelligence
AI may assist with:
- transcription
- summaries
- call classification
- disposition suggestions
- quality-assurance sampling
- script/disclosure checklist support
- coaching suggestions
- repeated-error detection
- next-best-action suggestions

AI outputs should remain reviewable and should not silently make high-impact employment or regulatory decisions.

## Pilot deployment sequence
1. Manual campaign + CRM outcomes.
2. Add provider adapter and live inbound/outbound events.
3. Add recording/transcript references.
4. Add QA scorecards and supervisor review.
5. Add AI summaries and coaching suggestions.
6. Link QA gaps to FAISReady learning/remediation.
7. Add employer-specific dashboards and reporting.
8. Add multi-tenant enterprise controls.

## First SA use cases
- RE5/RE1 enrolment and learner support.
- Employer cohort reminders and readiness interventions.
- Candidate recruitment and vacancy matching.
- Financial-services contact-centre QA and coaching.
- Training-gap identification linked to FAISReady Academy.

## Non-goals for initial pilot
- Replacing an institution's entire PBX/contact-centre estate.
- Providing regulated financial advice.
- Making official qualification determinations.
- Automated firing/hiring decisions.
- Locking FAISReady to one telephony vendor.
