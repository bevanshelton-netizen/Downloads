# IZAKHONO EDGE — Owned Engine

## Purpose

This layer removes Cloudflare, Vercel, Caddy, Nginx, Traefik and other hosted/reverse-proxy products from KORA's required production serving path.

The owned path is:

```text
Internet
  -> IZAKHONO-controlled DNS
  -> public IP / owner-controlled router
  -> ISN-01 ports 80/443
  -> IZAKHONO EDGE engine
  -> 127.0.0.1:18080
  -> KORA sovereign runtime
```

PR #136 remains the runtime foundation. The temporary Cloudflare proof in PR #137 is not a dependency of this engine.

## Engine properties

The engine is a self-contained Go binary built from repository source and Go's standard library. It provides:

- direct HTTP/HTTPS listeners;
- TLS termination from operator-supplied certificate files;
- host-based routing;
- reverse proxying only to loopback origins;
- continuous health checks with fail-closed routing;
- HTTP to HTTPS redirects;
- an owned ACME HTTP-01 webroot for a replaceable certificate client;
- HSTS and baseline response hardening;
- request-size controls;
- per-client fixed-window rate limiting;
- sanitised forwarding headers;
- local-only health/status API on `127.0.0.1:19090`;
- graceful shutdown;
- a hardened systemd service with restart recovery.

The engine deliberately contains no telemetry, advertising identifiers, behavioural tracking or external control plane.

## Independence boundary

The runtime does not require an external reverse-proxy or hosting provider. A public certificate authority may still be used as a replaceable trust source for browser-valid TLS certificates; certificate issuance is not compute hosting and is kept outside the engine.

The engine refuses to route to non-loopback upstreams. That means a configuration error cannot silently move KORA compute to an external host.

## Build and test

```bash
cd izakhono-cloud/edge-engine
go test ./...
go vet ./...
go build -trimpath -ldflags="-s -w" -o izakhono-edge-engine .
```

## Install on ISN-01

Prerequisites:

- PR #136 KORA runtime healthy at `127.0.0.1:18080`;
- a chosen stable KORA public hostname;
- browser-valid certificate and key for that hostname;
- owner-controlled inbound path for TCP 80 and 443 to ISN-01;
- systemd and Go available on the node.

Then:

```bash
sudo ./izakhono-cloud/edge-engine/install-owned-edge.sh \
  --hostname <KORA_PUBLIC_HOSTNAME> \
  --cert /path/to/fullchain.pem \
  --key /path/to/privkey.pem
```

The installer builds from source, creates a locked service account, copies the TLS material into the owned edge directory, generates a KORA-only config, validates it, installs the hardened systemd unit, starts the engine and verifies the local admin health endpoint.

## Local verification

```bash
curl http://127.0.0.1:19090/health
curl http://127.0.0.1:19090/status
```

A local install is not by itself proof of public readiness. Production truth requires a separate request from outside the owner network to the final hostname and verification of DNS, TLS and the real KORA response.

## Certificate renewal

The engine owns serving, not certificate authority issuance. A replaceable ACME client may write HTTP-01 tokens to:

```text
/var/lib/izakhono-edge/acme
```

After a renewed certificate is copied into `/etc/izakhono-edge/tls/`, restart:

```bash
sudo systemctl restart izakhono-edge
```

No Cloudflare tunnel, Vercel compute or hosted reverse proxy is required.

## Truth boundary

Passing CI proves the engine source builds, unit tests pass and the independence/security contracts are enforced in software.

It does not prove:

- that the owner router forwards 80/443;
- that the ISP/public IP is reachable rather than CGNAT-blocked;
- that production DNS points to the node;
- that a valid production certificate is installed;
- that an external internet client has completed the final HTTPS round trip.

Those are activation gates on the owner network, not application rebuild work.
