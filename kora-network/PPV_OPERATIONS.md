# KORA Pay-Per-View Operations — Phase 7

## Principle

A browser never decides the price and a browser return from PayFast never grants access. KORA unlocks a pay-per-view production only after a validated PayFast ITN completes the server-side purchase record.

## Database

Apply `supabase/012_ppv_entitlements.sql` after migration 011. The migration adds provider-payment uniqueness and the service-only `complete_payfast_purchase` function, which validates the stored order amount and atomically creates the permanent entitlement plus cleared revenue.

## Creator workflow

When creating a production, an approved creator chooses one access model:

- `free`
- `ad_supported`
- `premium`
- `pay_per_view`

A pay-per-view production requires a positive ZAR purchase price. The price is saved on the production and later read by the checkout API; it is not accepted from the buyer's browser.

## Buyer workflow

1. Viewer opens a published pay-per-view title.
2. KORA requires authentication and checks for an existing completed entitlement.
3. If not entitled, `/api/payfast/purchase` loads the production and price from the database.
4. KORA reuses the latest matching pending purchase when possible or creates a trusted server-side pending order.
5. The browser posts signed fields directly to PayFast.
6. Browser return to KORA shows a waiting state only; it does not unlock content.
7. PayFast sends the ITN to `/api/payfast/notify`.
8. KORA validates signature, merchant identity and PayFast's remote validation response, then checks the paid amount against the database order.
9. `complete_payfast_purchase` locks the purchase, records the PayFast payment id, marks the purchase complete and records cleared revenue atomically.
10. The returning browser polls only for entitlement status and reloads the title after the completed purchase is visible.
11. Completed paid titles appear in `/account/library`.

## Subscription checkout correction

Phase 7 also moves pending subscription creation to the trusted server client. This avoids depending on a browser RLS insert policy that does not exist. Subscription ITNs are hardened so a later non-complete notification does not downgrade an already-active membership.

## Smoke test

- Confirm a creator cannot create `pay_per_view` without a positive price.
- Confirm the checkout request cannot override the stored price.
- Confirm an unauthenticated buyer is returned to the intended title after sign-in.
- Confirm a browser `?payment=success` return without a valid ITN does not unlock content.
- Confirm an invalid PayFast signature fails.
- Confirm a merchant mismatch fails.
- Confirm an amount mismatch fails both in the route and the database completion function.
- Confirm the same PayFast payment id cannot be recorded against multiple purchases.
- Confirm a duplicate valid ITN for the same completed purchase is idempotent.
- Confirm a non-complete ITN cannot downgrade an already-completed purchase.
- Confirm the completed title becomes watchable and appears in My Library.
- Confirm cleared PPV revenue is written only once.
- Confirm subscription checkout can create its pending server-side order under production RLS.

Keep PayFast in sandbox mode until every test above passes end-to-end. Public production launch remains governed by the existing KORA readiness, legal, regulatory, child-safety and payout-operations gates.
