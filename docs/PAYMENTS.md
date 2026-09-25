# VIDEONOMY payments and creator earnings

## Default creator-fan payment path: iKhokha

Creator tips use the server-side iKhokha payment-link adapter. Browser code never receives the iKhokha app secret.

Required runtime secrets/vars:
- `IKHOKHA_APP_ID`
- `IKHOKHA_APP_SECRET`
- `IKHOKHA_MODE=live`
- `PUBLIC_BASE_URL=https://<public-videonomy-domain>`

A tip:
1. creates a VIDEONOMY creator-payment record,
2. requests a signed iKhokha payment link,
3. sends the fan to the hosted payment page,
4. accepts only a signature-verified callback linked to the stored payment,
5. records successful revenue in the creator ledger as **pending**,
6. becomes **available** only after settlement review records actual external cost.

The payout queue can draw only from available earnings and requires an independently verified payout profile. The application database stores an opaque payout account reference and safe display label rather than raw bank-account or card numbers.

## PayFast compatibility

The existing PayFast custom-web adapter remains for the founding advertiser/commercial-package flow and as a reversible payment adapter.

Required PayFast values:
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE`
- `PAYFAST_MODE=sandbox|live`
- `PUBLIC_BASE_URL`
- optional `PAYFAST_ALLOWED_CIDRS`

PayFast paid state still requires signature, source, exact stored amount and provider validation checks.

## Money-state rule

`pending` means revenue has been confirmed but is not yet withdrawable.
`available` means settlement/cost review is complete and the creator may request a payout.
`paid` means VIDEONOMY has recorded completion of the creator payout.

A view count never creates money by itself. Revenue-backed ledger entries create earnings.
