# IZAKHONO.CO.ZA Hybrid Deployment Standard

Primary production authority is IZAKHONO-owned infrastructure:

IZAKHONO CODE -> IZAKHONO RUNTIME NODE -> IZAKHONO EDGE NODE -> izakhono.co.za

An independent external deployment is maintained only as resilience. It must:

- build from the same `izakhono-group/` source;
- expose a distinct health response with `runtime: external-resilience`;
- remain independently deployable;
- never replace or control the owned runtime;
- not become the customer-facing canonical route unless an explicit failover decision is made;
- return HTTPS 200 and the current flagship content before it is considered usable.

The public domain must not be called live until trusted TLS for `izakhono.co.za` is verified.

The external route may be used for continuity while owned public ingress is repaired, but it remains a fallback and must be reversible.
