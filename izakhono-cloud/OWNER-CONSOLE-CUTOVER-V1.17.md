# IZAKHONO CLOUD v1.17 — Owner Console Cutover

This layer connects the Zero-Cost Host / Owner Console operating model to the v1.15 deployment plane and v1.16 public-ingress gate.

## One action

The Owner Console action **Complete Platform Build** runs one reviewed control plane against the current application repository. The control-plane checkout and application checkout may be separate, which prevents an infrastructure branch from silently testing stale application code.

Example for KORA:

```bash
python3 /srv/izakhono/control/izakhono-cloud/owner-console-cutover.py \
  kora-network/.izakhono.json \
  --repo-root /srv/izakhono/apps \
  --control-root /srv/izakhono/control
```

On a real owner READY node the command now **must** execute the local Docker build and loopback health probe. A plan-only receipt is not accepted as a completed cutover. The command records a deterministic deploy plan, immutable deployment receipt and final cutover receipt. Nothing becomes publicly reachable merely because this step passes.

When a real hostname has already been assigned, add `--hostname <approved-hostname>`. This creates the v1.16 public-ingress plan but still does not apply DNS/TLS or claim public readiness.

## Current-source proof

CI checks out the reviewed IZAKHONO control plane separately from the repository's current `main` application source, then proves registered applications through the same command. The cutover receipt records the application source commit when Git metadata is available.

Current proof targets:

- `bevan-shelton-racing/.izakhono.json`
- `kora-network/.izakhono.json`

For both targets CI requires an actual Docker execution receipt with a passing loopback health probe. KORA additionally verifies the read-only, non-privileged runtime isolation recorded by the deployment plane.

## Safety / truth boundary

- Existing `/var/lib/izakhono-cloud/READY` enforcement remains authoritative on real owner-node deployment.
- CI may bypass the READY marker only through the explicit `--ci-proof` path.
- Failed builds or health gates do not advance to ingress planning.
- Applications remain loopback-only until the separate reversible public-ingress apply path is invoked.
- External HTTPS verification remains mandatory before `public_ready` can ever become true.
- `commercial_ready=false` until owner-node, backup/restore, public-endpoint and product-specific commercial gates are complete.
- CI proves the software path only; it does not prove physical ownership of the machine that will host production.
