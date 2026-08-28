# FAISReady launch checklist

## Completed
- Financial-services visual design and responsive landing experience
- RE5 and RE1 learner tracks
- 540 original launch-bank questions (300 RE5 / 240 RE1)
- Quick drills, deep drills, diagnostics and full mocks
- Topic mastery and weak-area coaching
- Learner account architecture
- Company dashboard and bulk pricing proposition
- PayFast signed checkout and ITN verification scaffold
- Supabase production database schema and entitlement model

## External configuration required before taking live money
1. Connect a production host (Vercel/Netlify-compatible).
2. Create/connect Supabase and apply the schema.
3. Add Supabase URL/keys as protected environment variables.
4. Add Izakhono PayFast Merchant ID, Merchant Key and passphrase as protected environment variables.
5. Confirm Izakhono's bank account is the verified payout account inside PayFast.
6. Complete a PayFast Sandbox transaction end to end.
7. Grant the correct 90-day/120-day entitlement only after verified ITN confirmation.
8. Switch sandbox off only after successful validation.

## Content governance
- Original preparation questions only; no confidential/leaked-paper claims.
- Maintain mapping to the current FSCA RE1/RE5 preparation guide and legislation.
- Obtain qualified FAIS compliance/training review before claiming complete coverage.
