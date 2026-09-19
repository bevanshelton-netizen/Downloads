# IZAKHONO EDGE NODE

Owned HTTPS ingress layer for IZAKHONO RUNTIME NODE.

## V1 capabilities

- HTTPS termination with your certificate/key;
- HTTP → HTTPS 308 redirect;
- hostname-preserving proxy to IZAKHONO RUNTIME NODE;
- HSTS and baseline security headers;
- per-IP + hostname token-bucket rate limiting;
- request-body size limits;
- JSON-line access logs;
- loopback control API;
- live TLS certificate reload;
- systemd hardening;
- zero runtime npm dependencies.

## What remains outside V1

This release does not yet:
- issue/renew ACME certificates automatically;
- provide a global CDN;
- provide anycast routing;
- provide upstream ISP-grade DDoS scrubbing.

Those can be layered later. The first objective is to own the application ingress path on hardware you control.

## Production certificate

Provide:

- `IZAKHONO_TLS_CERT`
- `IZAKHONO_TLS_KEY`

The installer expects `/etc/izakhono/tls/fullchain.pem` and `privkey.pem`.

Certificates can come from your chosen CA. The private key never belongs in GitHub.

## Topology

Internet → IZAKHONO EDGE NODE :443 → IZAKHONO RUNTIME NODE :8080 → app process

Control APIs bind to loopback and are separate from public application traffic.


## FORTRESS — THEE PROTECTOR policy

FORTRESS protection is active by default at the edge. Sensitive payment routes such as IZAKHONO PAY and iKhokha webhooks receive a separate rate bucket, a smaller request-body limit, unsafe-method blocking and JSON enforcement where applicable. The edge adds `x-fortress-protector: active` to responses so the active defensive policy can be verified without exposing any secret.

The FORTRESS application itself remains private on the owner host; the edge does not expose the FORTRESS dashboard or its database to public traffic.


## Witness lease guard

EDGE defaults to `IZAKHONO_WITNESS_MODE=observe`. When witness credentials are configured it acquires and verifies Ed25519-signed leadership receipts, reports lease state in `/health`, and forwards the current fencing token toward RUNTIME.

`enforce` mode additionally blocks POST/PUT/PATCH/DELETE with HTTP 503 after the verified lease expires. Observe mode never blocks traffic, so it is the safe first rollout state for the current single-host production path.

EDGE and RUNTIME independently verify the witness receipt. This avoids relying on only one layer to fence an old primary.
