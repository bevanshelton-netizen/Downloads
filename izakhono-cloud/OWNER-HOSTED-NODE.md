# IZAKHONO CLOUD v1.5 — Owner-Hosted Node

This mode exists for owners who do not want to enter bank or card details with a cloud provider.

## What it does
It turns an owner-controlled Ubuntu computer into the first physical IZAKHONO CLOUD node. The software remains the same fail-closed stack: the node is not marked READY unless the immutable installer, checksum validation and production proof all succeed.

## What it avoids
- no Oracle, AWS, Azure, DigitalOcean or other cloud account is required
- no bank or card details are required by IZAKHONO CLOUD
- no third-party VPS subscription is required when using hardware you already own

## What still has to physically exist
Software cannot create CPU, RAM, storage, electricity or an internet connection. A real machine must run the node. It may be an existing desktop, spare PC, mini-PC or dedicated server under the owner's control.

## Minimum first-node target
- Ubuntu 24.04 LTS
- x86_64 or Arm64
- 4 GB RAM minimum
- at least 20 GB free disk for the first proof; 40 GB+ storage recommended for production use
- stable internet connection
- for a public production node: router/firewall access for TCP 80 and 443 and a stable public address or equivalent owner-controlled ingress

## One-command bootstrap
On the Ubuntu machine:

```bash
curl -fsSL https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/izakhono-cloud-v1-5-owner-hosted/izakhono-cloud/owner-node-bootstrap.sh | bash
```

The bootstrap downloads the already verified immutable v1.4 installer commit and runs the same production proof. It will not claim READY if the proof fails.

## Private-first option
The node may first be proven on the local network. This validates the owner-controlled compute path without exposing it publicly. Public launch remains a separate gate: HTTPS endpoints must be reachable and independently verified from outside the owner's network before any commercial-live claim.

## Security rule
Do not paste private SSH keys, banking credentials, card numbers or root credentials into chat, GitHub issues, source code or public logs. Owner credentials created by IZAKHONO remain root-only on the node.

## Direction
This is the foundation for an IZAKHONO-owned infrastructure layer: owner nodes can later be enrolled into a multi-node control plane for scheduling, replication, backups and failover. The orchestration software can be ours; the physical machines still have to exist somewhere.
