# IZAKHONO CLOUD v1.5 — Owner-Hosted Node

This mode exists for owners who do not want to enter bank or card details with a cloud provider.

## What it does
It turns owner-controlled hardware into an IZAKHONO CLOUD node. Native Ubuntu 24.04 is the production-proof path. Windows hardware can also be prepared through WSL2 for a private local proof without turning that local proof into a public-readiness claim.

The software remains fail-closed: the native Ubuntu node is not marked READY unless the immutable installer, checksum validation and production proof all succeed.

## What it avoids
- no Oracle, AWS, Azure, DigitalOcean or other cloud account is required
- no bank or card details are required by IZAKHONO CLOUD
- no third-party VPS subscription is required when using hardware you already own

## What still has to physically exist
Software cannot create CPU, RAM, storage, electricity or an internet connection. A real machine must run the node. It may be an existing desktop, spare PC, mini-PC or dedicated server under the owner's control.

## Native Ubuntu production-proof target
- Ubuntu 24.04 LTS
- x86_64 or Arm64
- 4 GB RAM minimum
- at least 20 GB free disk for the first proof; 40 GB+ storage recommended for production use
- stable internet connection
- for a public production node: router/firewall access for TCP 80 and 443 and a stable public address or equivalent owner-controlled ingress

## One-command native Ubuntu bootstrap
On the Ubuntu machine:

```bash
curl -fsSL https://raw.githubusercontent.com/bevanshelton-netizen/Downloads/izakhono-cloud-v1-5-owner-hosted/izakhono-cloud/owner-node-bootstrap.sh | bash
```

The bootstrap downloads the already verified immutable v1.4 installer commit and runs the same production proof. It will not claim READY if the proof fails.

## Windows laptop/desktop preparation
A Windows 10/11 machine with at least 8 GB RAM and 40 GB free disk can be prepared as a private pilot node through WSL2 + Ubuntu 24.04.

The helper is intentionally two-stage:

```powershell
# Hardware/WSL preflight only
powershell -ExecutionPolicy Bypass -File .\owner-node-windows.ps1

# If WSL/Ubuntu must be installed, run from Administrator PowerShell
powershell -ExecutionPolicy Bypass -File .\owner-node-windows.ps1 -InstallWsl

# Private local proof after Ubuntu setup is complete
powershell -ExecutionPolicy Bypass -File .\owner-node-windows.ps1 -RunLocalProof
```

The Windows helper pins the already reviewed Linux owner bootstrap to an immutable commit. If the local proof succeeds it deliberately converts `/var/lib/izakhono-cloud/READY` to `/var/lib/izakhono-cloud/LOCAL_READY` and records `public_ready=false`. A WSL-local proof therefore cannot be mistaken for independent public production proof.

## Private-first option
The node may first be proven on the local network. This validates the owner-controlled compute path without exposing it publicly. Public launch remains a separate gate: HTTPS endpoints must be reachable and independently verified from outside the owner's network before any commercial-live claim.

## Security rule
Do not paste private SSH keys, banking credentials, card numbers or root credentials into chat, GitHub issues, source code or public logs. Owner credentials created by IZAKHONO remain root-only on the node.

## Direction
This is the foundation for an IZAKHONO-owned infrastructure layer: owner nodes can later be enrolled into a multi-node control plane for scheduling, replication, backups and failover. The orchestration software can be ours; the physical machines still have to exist somewhere.
