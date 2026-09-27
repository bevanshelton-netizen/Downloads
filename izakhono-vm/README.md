# IZAKHONO VM

Portable hardened Linux bootstrap for IZAKHONO managed infrastructure.

## Purpose
Runs the IZAKHONO Autonomy Engine and allow-listed Infrastructure Executor on persistent Linux compute. The VM is infrastructure, not a laptop and not a GitHub Actions runner.

## Security
- SSH password authentication disabled by cloud-init.
- Root login disabled.
- No arbitrary-command control plane.
- Existing allow-listed executor remains authoritative.
- FORTRESS/PAY checks remain fail-closed.
- Secrets are never committed to source.

## Activation
Provision Ubuntu 24.04 LTS (recommended minimum 2 vCPU / 4 GB RAM / 40 GB disk), attach an SSH public key at the provider, apply cloud-init.yaml, then run install.sh as root. Cloud-provider credentials and application secrets stay in protected host environment files.

The same image/bootstrap can later be moved to IZAKHONO-owned hardware without changing the application control plane.
