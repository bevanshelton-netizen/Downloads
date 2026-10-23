# KORA PAY

KORA PAY is the payment and commerce layer for the KORA ecosystem.

## Architecture

`KORA USER → KORA PAY → PAYMENT PARTNER / BANK / ACQUIRER → SETTLEMENT`

KORA owns the merchant/customer experience, payment orchestration, business rules, transaction state, reconciliation experience and integration layer. Regulated partners perform regulated payment and settlement functions until KORA obtains any authorisations required for additional services.

## Core capabilities

- Merchant onboarding
- Checkout and payment links
- Invoices and payment requests
- Transaction status and reconciliation
- Payment routing through supported partners
- Refund and dispute workflow references
- Future marketplace and split-payment adapters
- KORA ecosystem payments across learning, media, mobility and commerce

## Safety and compliance boundary

KORA PAY must never imply that KORA itself holds customer funds, operates a regulated payment service, or has regulatory approval that has not been verified. Pending, successful, failed and settled states remain distinct.

## Owned-first principle

The KORA payment control plane is provider-neutral. External payment processors, banks and acquirers are adapters and can be replaced without rebuilding the KORA customer experience.
