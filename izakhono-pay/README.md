# IZAKHONO PAY — Shared Group Payment Backbone

IZAKHONO PAY provides one payment contract for Izakhono platforms while keeping payment-provider credentials, callback secrets and settlement details on trusted server infrastructure.

## Primary online rail: iKhokha

For one-time online purchases, IZAKHONO PAY uses the iKhokha iK Pay API when `IKHOKHA_APP_ID` and `IKHOKHA_APP_SECRET` are configured.

The customer is redirected to iKhokha's hosted secure checkout. IZAKHONO PAY does not capture card details, PINs, CVVs, banking passwords or OTPs.

A purchase is activated only after:

1. iKhokha sends a signed callback;
2. IZAKHONO PAY verifies the callback signature;
3. the order and payment-link references match;
4. IZAKHONO PAY independently checks the payment-link status with iKhokha;
5. the confirmed amount exactly matches the server-controlled product price;
6. the canonical order is marked paid idempotently;
7. a signed `payment.paid` event is sent to the originating platform.

Browser return alone never unlocks a product.

## EFT fallback

Direct merchant EFT remains available as a controlled fallback when `IZAKHONO_PAY_EFT_FALLBACK=true`. EFT orders use a unique reference and can only be confirmed by the owner-side reconciliation path. Manual confirmation is intentionally refused for iKhokha orders.

This keeps the existing bank-settlement route available without weakening the iKhokha confirmation path.

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

With iKhokha enabled, the response contains a hosted `redirect_url`. With EFT fallback, it contains the exact amount, unique payment reference and runtime bank-payment instructions.

Order status:

`GET /api/v1/orders/status?order=<order-id>` with the same application headers.

Pending iKhokha orders are securely reconciled against the provider status during status checks, so a delayed webhook does not permanently block a valid purchase.

## Platform activation event

After verified settlement, IZAKHONO PAY sends a signed `payment.paid` callback to the platform's configured HTTPS callback URL.

Callback verification uses HMAC-SHA256 over:

`<unix-timestamp>.<raw-body>`

with the platform-specific callback secret.

## Owner-side EFT confirmation

Until an authorised bank feed is connected, EFT confirmation remains local-only:

```bash
python3 shared_gateway.py confirm <order-id> --bank-reference <verified-bank-reference>
```

There is intentionally no public `mark paid` endpoint.

## Adding another Izakhono platform

1. Add the platform and products to `products.json` using `product-template.json`.
2. Generate a strong platform API key and callback signing secret; store both only in trusted server configuration.
3. Add its HTTPS entitlement callback URL.
4. Optionally configure its post-payment return URL through `IZAKHONO_PAY_RETURN_URLS_JSON`.
5. Create orders through `/api/v1/orders`.
6. Verify signed `payment.paid` events and activate only the referenced product.

The iKhokha App ID and App Secret are shared at the central gateway and are not copied into every child platform.

Never commit real iKhokha credentials, bank account numbers, API keys, callback secrets, tunnel tokens or provider credentials to GitHub.
