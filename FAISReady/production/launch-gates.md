# FAISReady Production Launch Gates

## Gate A — Code complete
- [x] Public beta
- [x] Workforce Intelligence concept
- [x] FAISReady ID concept
- [x] Careers concept
- [x] Academy concept
- [x] Call Centre prototype
- [x] Command Centre
- [x] Production architecture
- [x] Environment contract
- [x] API contract
- [x] Call-centre schema foundation

## Gate B — Live backend
- [ ] Dedicated Supabase project connected
- [ ] Auth enabled
- [ ] Multi-tenant memberships created
- [ ] RLS verified with learner / manager / admin test users
- [ ] Private storage buckets created for evidence and recordings
- [ ] Audit logging operational

## Gate C — Payments
- [ ] PayFast merchant approved for FAISReady under Izakhono
- [ ] Sandbox credentials added server-side
- [ ] Payment-create endpoint deployed
- [ ] ITN signature/remote validation verified
- [ ] Successful payment creates entitlement
- [ ] Expiry and duplicate-event handling tested

## Gate D — Telephony
- [ ] Select South African telephony provider / SIP carrier
- [ ] Provision test number
- [ ] Add provider credentials server-side
- [ ] Provider webhook signature validation
- [ ] Inbound call test
- [ ] Outbound call test
- [ ] Disposition + callback workflow
- [ ] Recording/consent policy enabled
- [ ] Recording retention/deletion test

## Gate E — AI QA and remediation
- [ ] Recording/transcript pipeline
- [ ] AI summary
- [ ] QA findings stored
- [ ] Human supervisor override/review
- [ ] Finding maps to learning topic
- [ ] Remediation assignment created
- [ ] Reassessment closes the loop

## Gate F — Institutional pilot
- [ ] Pilot sponsor identified
- [ ] Data-processing / confidentiality requirements agreed
- [ ] Cohort defined
- [ ] Success metrics agreed
- [ ] Baseline assessment completed
- [ ] Intervention delivered
- [ ] Final readiness report produced
- [ ] Case-study permission handled separately

## Gate G — National launch
- [ ] Production domain
- [ ] Terms, privacy, refund/cancellation and data-retention policies
- [ ] Support process
- [ ] Incident response
- [ ] Backup/restore test
- [ ] Monitoring/alerts
- [ ] Employer onboarding workflow
- [ ] Public claims reviewed for regulatory accuracy

## Hard blockers that cannot be completed from source control alone
1. Live provider account creation/connection
2. Provider secrets entered into hosting dashboards
3. Merchant/telephony compliance approval where required
4. Pilot institution's internal approval and data requirements

No source-code workaround should bypass these gates.