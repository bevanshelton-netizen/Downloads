# IZAKHONO ONE — Public Commercial Launch Control

Date: 25 September 2026  
Status: PUBLIC CUSTOMER ENTRANCE APPROVED; COMMERCIAL VERIFICATION IN PROGRESS

## CEO launch decision

IZAKHONO ONE may be opened to public customers. The portfolio Owner Command Centre remains owner-only and is not registered in `owner-host/platforms.json` for public customer routing.

## Customer launch contract

- Public customer entrance: `https://yfawrenhudjomhnglfhq.supabase.co/functions/v1/izakhono-one`
- Owned destination remains: `one.domains.izakhonoafrica.co.za`
- External Supabase route is the resilience/customer-launch route until the owned public route independently passes the owned HTTPS gate.
- iKhokha is the customer checkout provider.
- Membership entitlement is fail-closed: a browser success page never activates access.
- ONE entitlement activates only after a signed iKhokha callback plus independent provider status `PAID` and exact-amount verification.
- Customer payment history is available in Plans & Billing.
- Public ONE launch surface is zero-attribution: no advertising IDs, behavioural profiling, fingerprinting or passive clickstream attribution.
- Legal merchant shown to customers: IZAKHONO AFRICA (PTY) LTD.
- Current membership checkout is one payment for one month; it does not create an automatic debit order.

## Pricing

Founding 100, while places remain:

- Start: R199/month
- Business: R499/month
- Pro: R999/month

Standard pricing after the Founding 100 allocation is complete:

- Start: R299/month
- Business: R699/month
- Pro: R1,499/month

The checkout API is the pricing authority. The customer page reads current server pricing, and checkout rejects a stale expected amount before creating an iKhokha link.

## Production payment controls

Current Supabase production functions after the launch hardening:

- `izakhono-one`: public customer surface with dynamic pricing, policies and billing history.
- `izakhono-one-api`: authenticated workspace and billing-history API.
- `izakhono-checkout-api`: live-mode-only iKhokha link creation, securepay host validation, expected-price validation.
- `izakhono-ikhokha-webhook`: signed callback verification plus independent iKhokha status/amount check before entitlement.
- `izakhono-payment-result`: ONE-aware success/failure/cancel return that cannot grant entitlement.

## Owner Command Centre boundary

The static `ports/izakhono-command-center` surface is an owner dashboard and is not a customer product. It must not be added to public routing or linked from the public ONE customer entrance. Any remote owner-access layer must require server-side owner authentication; client-side hiding is not an access-control mechanism.

## Launch gate

The workflow `.github/workflows/izakhono-one-commercial-launch-gate.yml` independently checks:

1. Public ONE HTTPS returns the expected customer experience.
2. Merchant identity, iKhokha wording, receipts and launch pricing are present.
3. Passive attribution markers are absent.
4. Checkout reports iKhokha configured in live mode with the correct current server prices.
5. ONE payment return points back to ONE.
6. Unsigned webhook requests fail closed.
7. Owner Command Centre remains absent from public owner-host routing.

## Final commercial proof still required

Do not label the payment system **end-to-end VERIFIED LIVE** until one real customer/payment verification completes the full chain:

`customer checkout → iKhokha PAID → signed callback → independent provider-status check → exact amount match → receipt saved → ONE membership active → billing receipt visible`.

A live payment must not be simulated or falsely marked paid. The first genuine paid transaction can serve as the final commercial proof.
