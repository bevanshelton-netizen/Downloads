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
