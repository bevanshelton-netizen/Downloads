# IZAKHONO CLOUD v1.15 — Deployment Plane

This layer begins the Vercel-class deployment workflow while preserving the existing fail-closed security model.

## Goal

Convert a project `.izakhono.json` manifest into a deterministic, auditable deployment proposal that later runtime layers can execute only after the existing owner-node trust, READY, signed workload and signed execution-permit gates pass.

## What this adds

- project-manifest validation
- deterministic manifest SHA-256
- deterministic image-tag proposal
- repository-relative build-context and Dockerfile validation
- explicit container port and health path
- immutable image digest required before execution
- no secrets embedded in images
- fail-closed runtime defaults: read-only rootfs, cap-drop ALL, no-new-privileges, no privileged mode, no host mounts
- explicit health gate
- explicit owner activation requirement
- deployment plan SHA-256 for later signing / audit trails

## What this does NOT claim

- no container is started by this planner
- no public port is published
- no DNS record is changed
- no TLS certificate is issued
- no production traffic is promoted
- no automatic failover is enabled
- `public_ready=false`
- `commercial_ready=false`

## Usage

```bash
python3 izakhono-cloud/deploy-plane.py kora-network/.izakhono.json
python3 izakhono-cloud/deploy-plane.py bevan-shelton-racing/.izakhono.json --out /tmp/racing-deploy-plan.json
```

The generated plan is intended to become the bridge between the existing IZAKHONO project contract and the signed workload / owner-node execution path already built in earlier versions.

## Next safe layer

The next layer should bind the deploy-plan SHA-256 to a signed workload bundle, build the image in an isolated builder, record the resulting immutable image digest, run the health gate on an owner-controlled node, and only then create a reversible promotion proposal. Public routing must remain separately gated until real-node HTTPS proof exists.
