# VIDEONOMY bootstrap payments

The launch payment adapter is prepared for PayFast custom web integration. Live merchant credentials are **never** committed to GitHub or exposed to browser JavaScript.

## Required Cloudflare secrets/vars
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE` = `sandbox` or `live`
- `PUBLIC_BASE_URL`
- Optional `PAYFAST_ALLOWED_CIDRS` if PayFast changes its published ITN source ranges.

## Security gates before marking a payment paid
1. Verify the ITN signature.
2. Verify the request source is in PayFast's published ITN ranges.
3. Verify `amount_gross` matches the stored payment intent exactly.
4. POST the ITN parameter string back to PayFast's validation endpoint and require `VALID`.
5. Make payment state updates idempotent using the provider transaction reference.

## Currency
PayFast checkout is ZAR. VIDEONOMY may display USD/GBP/EUR estimates, but South African PayFast checkout amounts are stored and sent in ZAR minor units.
