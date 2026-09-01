# IZAKHONO PAY — Sovereign v0.2.0

Status: validated sandbox / non-custodial release.

## Operational capabilities

- Public merchant application and transparent application tracking
- Sandbox merchant provisioning and hashed API keys
- Payment links and payment-intent state machine
- Merchant dashboard with transaction, ledger, KYC, support, settlement and risk visibility
- KYC/onboarding checklist and admin review workflow
- Settlement preparation and lifecycle tracking
- Reconciliation reports
- Risk scan/flag workflow using review signals rather than silent automated termination
- Support SLA targets and breach visibility
- CSV merchant exports for transactions, ledger and settlements
- Rail-adapter registry with credentials deliberately excluded
- Local operations/admin console
- Refund request workflow
- Audit trail
- No raw card capture/storage
- No custodial funds handling

## Validation

The packaged v0.2 release passed Node syntax validation, the original merchant/application/payment-link smoke flow, and a v0.2 operations flow covering merchant dashboard, KYC submission/review, reconciliation, risk scan, and CSV export.

## Production gate

Real-money public operation remains blocked until the applicable South African regulatory/authorisation path and authorised acquiring/banking/payment-rail agreements are completed. IZAKHONO PAY should own the merchant experience and payment state while licensed rails move the funds.
