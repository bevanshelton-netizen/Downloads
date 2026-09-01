# IZAKHONO CLOUD v1.17 — Owner Console Cutover

This layer connects the existing Zero-Cost Host / Owner Console operating model to the v1.15 deployment plane and v1.16 public-ingress gate.

## One action

The Owner Console action **Complete Platform Build** should call:

```bash
python3 izakhono-cloud/owner-console-cutover.py \
  bevan-shelton-racing/.izakhono.json \
  --repo-root .
```

On a real owner READY node, the command generates a deterministic deploy plan, executes the existing isolated alpha deployment path, records a deployment receipt and returns a cutover receipt. Nothing becomes publicly reachable merely because this step passes.

When a real hostname has already been assigned, add `--hostname racing.example.com`. This creates the v1.16 public-ingress plan but still does not apply DNS/TLS or claim public readiness.

## Safety / truth boundary

- Existing `/var/lib/izakhono-cloud/READY` enforcement remains authoritative on owner-node deployment.
- CI may use only the explicit `--ci-proof` mode.
- Failed builds or health gates do not advance to ingress planning.
- Applications remain loopback-only until the separate reversible public-ingress apply path is invoked.
- External HTTPS verification remains mandatory before `public_ready` can ever become true.
- `commercial_ready=false` until owner-node, backup/restore and public-endpoint proof are complete.

## First migration target

`bevan-shelton-racing/.izakhono.json` is the first registered application used to exercise this consolidated path.
