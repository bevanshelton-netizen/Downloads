# IZAKHONO Hybrid Infrastructure Policy

IZAKHONO uses internal and external infrastructure together, but they do not have equal authority.

## Tier 1 — IZAKHONO-owned authority

Owned infrastructure remains authoritative for:

- customer and lead data;
- authentication and service identity;
- payment callbacks and payment-sensitive routes;
- FORTRESS protection;
- write-capable business operations;
- source of truth databases;
- primary runtime where physically available.

## Tier 2 — External transport to owned compute

Tailscale Funnel can expose IZAKHONO EDGE when direct public ingress is blocked by CGNAT, router forwarding, public IP or certificate/DNS conditions.

Path:

    Internet
      -> Tailscale Funnel
      -> IZAKHONO EDGE
      -> FORTRESS
      -> IZAKHONO RUNTIME
      -> application

Application compute and data remain owned.

## Tier 3 — External compute contingency

Existing external deployments such as Growth OS on Vercel may remain available as continuity endpoints.

They are accepted as a contingency only when their health/status contract proves the expected product and a fail-safe write posture. For Growth OS, the external endpoint must report `liveAdWrites:false`.

External compute fallback is therefore suitable for:

- public information;
- campaign/brand continuity;
- read-only dashboards where safe;
- emergency user messaging;
- links back to recovered owned services.

It is **not** automatically granted payment, ad-spend, identity or sensitive-write authority.

## No surprise cutover

Hybrid proof never changes DNS automatically and never reroutes payments automatically. FAILOVER/WITNESS remain responsible for owned HA safety; external contingencies are an additional resilience layer, not a bypass of fencing or FORTRESS.

## Prove the current state

Run:

    sudo bash prove-growth-os-hybrid.sh
    sudo bash select-growth-os-hybrid-route.sh

A hybrid proof receipt is stored at:

    /var/lib/izakhono-deploy/proofs/growth-os-hybrid-proof.json
