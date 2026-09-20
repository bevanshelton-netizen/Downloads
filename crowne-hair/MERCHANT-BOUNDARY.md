# CROWNÉ Hair by Netty — Merchant Separation

## Ownership boundary

CROWNÉ Hair by Netty is Netty's independent merchant business.

IZAKHONO AFRICA (PTY) LTD provides website, infrastructure and technology services only. IZAKHONO's merchant accounts, payment API keys, bank details and settlement accounts must never be reused for CROWNÉ customer payments.

## Payment rule

CROWNÉ direct checkout may be enabled only when all of the following are true:

1. Netty's merchant account has been opened and verified.
2. The merchant account is linked to Netty's declared settlement bank account.
3. Netty-specific payment credentials are stored server-side only.
4. CROWNÉ products have confirmed stock, supplier provenance, final specifications, delivery terms and final selling prices.
5. A successful sandbox/test transaction and a verified live end-to-end payment acceptance test have been completed.
6. The CROWNÉ return, webhook and fulfilment flow has been verified.

Until then, CROWNE_HAIR_DIRECT_CHECKOUT must remain false.

## Secret handling

Never commit merchant API credentials to GitHub.
Never place them in browser JavaScript.
Never copy IZAKHONO PAY secrets into CROWNÉ.
Use the local-only configure-crowne-netty-merchant.sh setup path or another approved secret manager.

## Settlement

The payment provider account configured for CROWNÉ must settle to Netty's declared merchant bank account, not to IZAKHONO AFRICA.
