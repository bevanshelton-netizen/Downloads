# IZAKHONO ONE — Deployment Readiness Pack

This pack separates **technical deployment**, **public pilot**, and **commercial launch** so that no status is overstated.

## Release ladder

**CODE READY** means canonical `main` and CI are green.

**OWNER MACHINE READY** means the one-time IZAKHONO Owner Agent is installed and the machine is producing local receipts.

**TECHNICAL RUNTIME READY** requires healthy AUTH, NOTIFY, AI Gateway, GPU Compute, Model Worker, Runtime, ONE AI, a successful model inference proof and account reachability on the owned machine.

**PUBLIC PILOT READY** adds verified SMTP/recovery, public signup, EDGE routing and independently verified HTTPS.

**COMMERCIAL READY** additionally requires final sustainable pricing, legal/support policies and a verified payment → receipt/invoice → entitlement path.

**VERIFIED LIVE** is only used after an independent public check proves the intended release is reachable.

## R0 public launch mode

The public pilot does **not** require purchase of a custom domain.

At a zero-cash budget, the approved route is:

1. Stable public front door: `https://bevanshelton-netizen.github.io/Downloads/one/`
2. External resilience/control: the already verified Supabase ONE hub/control/device-AI endpoints.
3. Owned server authority: ISN-01 / another verified IZAKHONO sovereign node.
4. Direct owned-runtime public transport: the existing outbound Tailscale Funnel adapter, launched with `START-IZAKHONO-ONE-R0-BRIDGE.cmd`.
5. A branded custom domain is deferred as an optional future branding upgrade.

The R0 bridge requires no purchased domain, no public IPv4 and no inbound router port forwarding. Tailscale remains a replaceable transport adapter and never becomes ONE's engine authority.

## One-click owned launch

Run on the owner Windows machine:

```
START-IZAKHONO-ONE-OWNED-LAUNCH.cmd
```

This is the canonical end-to-end owner-host entry point. It bootstraps the owner host if required, installs/refreshes the allow-listed Owner Agent, executes the approved ONE local-model activation, deploys ONE, runs the readiness preflight and preserves the verified external resilience route.

The independent GitHub workflow `IZAKHONO ONE Owned Public Verify` checks the owned hostname after activation. The owned route is only **VERIFIED LIVE** when that external verifier sees exact HTTPS 200 on both `/` and `/health`, the expected ONE AI health contract, public signup, account reachability, chat readiness and zero tracking.

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
3. The selected direct owned-runtime public endpoint (R0 bridge or future custom domain) must pass an independent HTTPS health check before that direct owned route is called VERIFIED LIVE.

Commercial checkout remains a later gate; it is not required for the free/public technical pilot.

## Do not skip

- Do not call the service live because local RUNTIME is healthy.
- Do not turn on signup without working account verification/recovery mail.
- Do not show a successful payment flow until payment, receipt and entitlement pass end-to-end.
- Do not publish final low-cost pricing until inference/storage/support costs prove it sustainable.
