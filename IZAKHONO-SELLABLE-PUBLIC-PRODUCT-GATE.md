# IZAKHONO SELLABLE PUBLIC PRODUCT GATE

## Definition

A product is not commercially ready because the code builds. It is **sellable** only when a member of the public can:

1. find the product at a stable public address;
2. understand what it does and what it costs;
3. create or recover an account without staff intervention;
4. buy or activate the service where payment applies;
5. receive a receipt/invoice and correct entitlement;
6. use the product on mobile and desktop;
7. get help and understand cancellation/refund terms;
8. export their data/content in a usable format;
9. see truthful service/usage limits;
10. leave without lock-in.

## Mandatory release gates

- verified public URL
- clear value proposition
- self-service signup
- account recovery
- published pricing
- verified payment path
- receipt/invoice
- Terms of Service
- Privacy Policy
- Refund/Cancellation Policy
- support route
- onboarding
- entitlement/usage visibility
- export/portability
- service-health visibility
- security and abuse controls
- mobile usability
- accessibility baseline
- analytics without tracking, behavioural profiling or advertising IDs

## Payments

Default commercial stack:
**IZAKHONO PAY → approved gateway (currently iKhokha where suitable) → legal merchant → ledger/reconciliation → entitlement.**

No fake checkout. No product may display a successful purchase path until the full payment and entitlement flow has passed end-to-end acceptance.

## Public address rule

Every product must have a stable public web address. We may use an external host as a temporary zero-cost or low-cost bridge, but:
- the source remains IZAKHONO-owned;
- the external route stays replaceable;
- an IZAKHONO-owned hostname remains the target;
- “live” is only claimed after independent verification.

## Limits rule

The default product philosophy is **not artificially limited**.

Where compute, storage, fraud/abuse protection or third-party cost creates a real constraint, publish a fair-use/capacity rule. Do not market literal “unlimited” unless capacity and abuse controls can sustain that claim.

## Commercial status

Use these labels consistently:
- `foundation`
- `building`
- `pilot`
- `sellable`
- `verified-live`

A product cannot reach `sellable` without the applicable gates above.
