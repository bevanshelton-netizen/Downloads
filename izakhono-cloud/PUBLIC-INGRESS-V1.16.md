# IZAKHONO CLOUD v1.16 — Public Ingress & HTTPS Gate

This layer completes the software path between a healthy owner-node deployment and a public HTTPS route while remaining fail-closed.

## Flow

1. v1.15 produces a deployment receipt after build + isolated health proof.
2. `public-ingress.py plan` binds a concrete hostname to that exact receipt.
3. The plan emits a deterministic Caddy route with automatic ACME TLS.
4. DNS must already resolve to the intended public owner-node IP before apply.
5. The owner node must have the existing READY marker and an explicit public-ingress activation marker.
6. The application remains bound to loopback; only the ingress layer owns ports 80/443.
7. External `public-ingress.py verify` proves DNS, TLS handshake and the HTTPS health endpoint.
8. A failed external HTTPS proof must roll back the route instead of declaring success.

## Example plan

```bash
python3 izakhono-cloud/public-ingress.py plan \
  --project bevan-shelton-racing \
  --hostname race.example.com \
  --upstream-port 18080 \
  --health-path /health \
  --deployment-receipt-sha256 <64-hex-receipt> \
  --target-ip 203.0.113.10 \
  --out /tmp/racing-ingress.json
```

The documentation address above is only an example; the planner deliberately rejects non-public target IP values when one is supplied.

## Independent HTTPS verification

Run from a genuinely separate machine/network after DNS and ingress activation:

```bash
python3 izakhono-cloud/public-ingress.py verify \
  --hostname race.your-domain.example \
  --health-path /health \
  --expected-ip <PUBLIC_IP> \
  --out /tmp/public-https-proof.json
```

The resulting proof captures resolved IPs, TLS version/cipher, certificate metadata, health status and a deterministic proof SHA-256 without storing private keys or secrets.

## Security boundary

- no wildcard hostname promotion
- no localhost/private-only hostname promotion
- no private target IP accepted for a public plan
- app upstream stays on `127.0.0.1`
- Caddy is the only public 80/443 ingress component
- no DNS provider credentials are required or stored by this layer
- no public-ready claim is made by the planner itself
- external HTTPS proof is required after activation
- `commercial_ready=false` until real owner hardware, DNS, TLS, backup/restore, monitoring and operational ownership have all been independently exercised

## Truth boundary

The CI gate proves deterministic planning and rejection of unsafe inputs. CI does **not** prove that an owner-controlled server exists, that a real domain resolves, or that a public certificate has been issued. Those remain real-world gates.