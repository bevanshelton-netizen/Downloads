# CREATIVE SUITE COMMERCIAL READINESS

## Approved price references
- Creative: USD $5 per 30-day access period.
- Gamer: USD $15 per 30-day access period, including Creative Suite.

## Current payment constraint
IZAKHONO PAY currently validates registered products in ZAR and iKhokha is implemented as a hosted one-time purchase rail. Therefore:

- Do not invent a ZAR conversion.
- Do not register saleable Creative/Gamer products until approved ZAR settlement amounts are chosen.
- Do not claim automatic recurring billing.
- Until recurring is verified, a successful purchase should grant 30 days access and require a new verified checkout for the next period.

## Code gates now in place
- Payment portfolio knows about Creative Suite.
- IZAKHONO PAY registry has Creative Suite metadata but intentionally exposes no saleable product code yet.
- Owned deployment health publishes the $5/$15 pricing reference and recurring-billing=false state.
- Checkout remains disabled in the owner-host deployment contract.
- Public Terms, Privacy, Pricing and Refund/Cancellation routes exist in the app.

## Remaining sellable gates
1. Owned public HTTPS verification for creative.domains.izakhonoafrica.co.za.
2. Signup/auth verification.
3. Approve exact ZAR settlement prices for Creative and Gamer.
4. Register Creative and Gamer product codes in IZAKHONO PAY.
5. Configure callback/return URLs and platform credentials.
6. Verify payment → entitlement → cancellation/refund/reconciliation end to end.
7. Only then change checkout/registration flags and release the prepared marketing campaign.
