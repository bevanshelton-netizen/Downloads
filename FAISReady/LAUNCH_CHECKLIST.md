# FAISReady launch checklist

## Completed and deployed
- Financial-services visual design and responsive public experience
- Dedicated production launch front door under `FAISReady/launch/`
- RE5 and RE1 learner tracks
- 540-question launch bank architecture (300 RE5 / 240 RE1)
- Quick drills, deep drills, diagnostics and full mocks
- Topic mastery and weak-area coaching
- Live Supabase authentication
- Live learner profile / FAISReady ID foundation
- Live employer workspace creation and tenant membership
- Live jobs publishing and open-role listing
- Workforce Intelligence database foundation
- Call-centre CRM / QA / remediation data model
- Supabase production project connected and RLS enabled
- Organization creator/member bootstrap policy fixed and source-controlled
- PayFast signed-checkout and ITN verification scaffold
- Provider-neutral telephony architecture and Twilio production integration specification
- GitHub Pages public deployment

## External provider gates before taking live money or placing real calls
1. PayFast must complete merchant verification for account 12848922.
2. Confirm Izakhono's intended business bank account is the verified PayFast payout account.
3. Load PayFast Merchant ID, Merchant Key and passphrase only into a secure server runtime; never expose them in browser code.
4. Complete an end-to-end PayFast sandbox transaction and verify ITN remote validation, amount, merchant ID and COMPLETE status.
5. Write the correct 90-day / 120-day entitlement only after verified ITN confirmation.
6. Switch PayFast sandbox off only after successful production validation.
7. Provision the selected telephony provider account/number and server-side credentials before real inbound/outbound calling.
8. Complete consent, recording, retention and webhook-signature validation before activating real call recording.

## Content governance
- Original preparation questions only; no confidential, leaked-paper or recalled-question claims.
- Maintain mapping to the current FSCA RE1/RE5 preparation guide and applicable legislation.
- Obtain qualified FAIS compliance/training review before claiming complete regulatory-content coverage.
- Keep official RE status separate from internal FAISReady readiness scores.

## Commercial launch language until provider gates clear
- Safe: public beta, live multi-user platform, preparation and workforce-readiness platform.
- Do not claim: FSCA-approved/accredited, guaranteed pass, live paid checkout, or live telephony until those facts are verified.
