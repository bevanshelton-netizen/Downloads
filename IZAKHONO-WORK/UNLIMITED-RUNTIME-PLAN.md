# IZAKHONO WORK — Sovereign Runtime

## Goal
Remove ChatGPT Work usage limits from the critical execution path. IZAKHONO WORK must run jobs on owner-controlled compute. External AI services are optional providers, not the scheduler/runtime.

## Runtime
- Persistent job queue on IZAKHONO NODE 01.
- Worker processes consume queued jobs continuously.
- Job state: queued -> running -> verifying -> completed/failed.
- Retry with bounded exponential backoff.
- Durable logs and artifacts per job.
- Health endpoint and owner dashboard.
- No artificial per-session time limit in IZAKHONO WORK itself; practical limits are owner compute/storage/network/provider quotas.

## Provider abstraction
Tasks can select a locally hosted model or an external AI provider. Provider quota exhaustion pauses only that provider; it must not stop the queue, deployments, payment processing, monitoring, or other deterministic jobs.

## Deployment pipeline
IZAKHONO CODE/Forge -> Builder -> Work Queue -> NODE 01 -> health gate -> Edge.

## Payments
Central payment service routes approved portfolio packages through iKhokha. Secrets stay in the owner-controlled secret store and are never committed to Git.

Required secret names:
- IKHOKHA_APPLICATION_KEY_ID
- IKHOKHA_APPLICATION_KEY_SECRET

## Security
- Never put credentials in source control, browser bundles, logs, screenshots, or chat.
- Encrypt secrets at rest and restrict them to the payment service identity.
- Payment success is accepted only after server-side verification.
- Keep audit records for payment references, status transitions, reversals, and fulfilment.

## Launch gate
A commercial app is promoted only when health, checkout, verified payment confirmation, order/enrolment creation, and fulfilment/access pass end-to-end.

## Important boundary
This architecture does not bypass or alter ChatGPT/OpenAI account limits. It removes those limits from IZAKHONO's own runtime by making ChatGPT Work an optional interface rather than the execution engine.
