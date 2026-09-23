# IZAKHONO ONE — Deployment Readiness Pack

This pack separates **technical deployment**, **public pilot**, and **commercial launch** so that no status is overstated.

## Release ladder

**CODE READY** means canonical `main` and CI are green.

**OWNER MACHINE READY** means the one-time IZAKHONO Owner Agent is installed and the machine is producing local receipts.

**TECHNICAL RUNTIME READY** requires healthy AUTH, NOTIFY, AI Gateway, GPU Compute, Model Worker, Runtime, ONE AI, a successful model inference proof and account reachability on the owned machine.

**PUBLIC PILOT READY** adds verified SMTP/recovery, public signup, EDGE routing and independently verified HTTPS.

**COMMERCIAL READY** additionally requires final sustainable pricing, legal/support policies and a verified payment → receipt/invoice → entitlement path.

**VERIFIED LIVE** is only used after an independent public check proves the intended release is reachable.

## One-click readiness check

Run on the owner Windows machine:

```
START-IZAKHONO-ONE-DEPLOYMENT-READINESS.cmd
```

It does not deploy or mutate production. It updates the owner checkout to canonical `main`, runs the Linux preflight and copies:

- `IZAKHONO-ONE-DEPLOYMENT-READINESS.json`
- `IZAKHONO-ONE-DEPLOYMENT-READINESS.txt`

to the Windows Desktop.

## Current expected blockers before the machine runs

1. Owner Agent / local-model request must execute on the physical owner host.
2. SMTP must complete a real handshake before public signup is enabled.
3. `https://one.domains.izakhonoafrica.co.za` must pass an independent HTTPS health check.

Commercial checkout remains a later gate; it is not required for the free/public technical pilot.

## Do not skip

- Do not call the service live because local RUNTIME is healthy.
- Do not turn on signup without working account verification/recovery mail.
- Do not show a successful payment flow until payment, receipt and entitlement pass end-to-end.
- Do not publish final low-cost pricing until inference/storage/support costs prove it sustainable.
