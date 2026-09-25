# IZAKHONO Growth OS OIDC Bridge

A narrow owner-host bridge between the public Growth OS resilience deployment and IZAKHONO-owned services.

## Trust boundary

- Loopback bind only: `127.0.0.1:8920`.
- Public transport is separate (Cloudflare/Tailscale/owned EDGE).
- Every protected call must carry a Vercel OIDC token.
- OIDC verification is pinned to team `bevan2`, project `izakhono-growth-os-resilience`, production environment, project ID `prj_OpMGIOe5TXhyhn6lHabQOOafRTV6`.
- Custom audience: `https://bridge.domains.izakhonoafrica.co.za`.
- No arbitrary proxy and no shell route.
- Internal DATA/PAY keys are injected only on NODE01 and never returned externally.

## Allow-listed routes

AUTH: login, me, logout.

DATA: stats, approvals, approval decision, measurement events.

PAY: health, products, orders, order status. Payment credentials remain inside IZAKHONO PAY; the bridge never receives iKhokha App Secret.

The bridge fails closed when a required internal key or platform payment registration is missing.
