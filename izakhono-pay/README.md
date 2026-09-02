# IZAKHONO PAY — Shared Group Payment Backbone

IZAKHONO PAY provides one payment contract for Izakhono platforms while keeping settlement credentials and bank-account details on the owner-controlled host.

## Current production-safe rail

The first rail is direct merchant EFT. IZAKHONO PAY creates a pending order with a unique payment reference. Money settles directly into the configured Izakhono Africa business bank account. The customer receives access/service only after the matching credit is verified.

This is non-custodial orchestration. IZAKHONO PAY does not hold customer funds and does not capture card data.

## Platform integration

Each platform is registered in `products.json` with a platform slug and one or more product codes. Prices are server-controlled; clients do not submit arbitrary amounts.

Platform request:

`POST /api/v1/orders`

Headers:
- `x-izakhono-app: <platform-slug>`
- `x-izakhono-key: <platform-api-key>`
- `content-type: application/json`

Body:
```json
{
  "product_code": "product-code",
  "customer_name": "Customer Name",
  "customer_email": "customer@example.com",
  "customer_reference": "platform-user-or-booking-id"
}
```

The response contains the canonical order ID, exact amount, unique EFT payment reference and runtime bank-payment instructions.

Order status:

`GET /api/v1/orders/status?order=<order-id>` with the same application headers.

## Activation event

After a bank credit is verified, the owner-side confirmation command marks the canonical order paid and sends a signed `payment.paid` callback to that platform's configured HTTPS callback URL. Platforms use that event to activate subscriptions, courses, tickets, downloads, bookings or other entitlements.

Callback verification uses HMAC-SHA256 over:

`<unix-timestamp>.<raw-body>`

with the platform-specific callback secret.

## Owner-side confirmation

Until an authorised FNB/open-banking feed is connected, confirmation is deliberately local-only:

```bash
python3 shared_gateway.py confirm <order-id> --bank-reference <verified-bank-reference>
```

There is intentionally no public `mark paid` endpoint.

## Automatic reconciliation target

The zero-touch production target is:

1. bank feed reports a settled incoming credit;
2. reconciliation matches exact amount + unique IZAKHONO PAY reference;
3. order changes from `pending` to `paid` idempotently;
4. signed `payment.paid` callback is delivered;
5. destination platform grants the registered product entitlement;
6. retries and audit records remain available if callback delivery fails.

Automatic reconciliation must remain disabled until an authorised banking-data/acquiring connection and credentials are available.

## Adding another Izakhono platform

1. Add the platform and products to `products.json` using `product-template.json`.
2. Generate a strong platform API key and callback signing secret; store both only in owner-host environment configuration.
3. Add an HTTPS callback URL implemented by the platform.
4. Create orders through `/api/v1/orders`.
5. Verify signed `payment.paid` events and activate only the product referenced by the event.

Never put the real bank account number, API keys, callback secrets, tunnel tokens or provider credentials in GitHub.
