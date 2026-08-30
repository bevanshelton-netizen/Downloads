# IZAKHONO CLOUD v1.2 — Staging Bootstrap Status

Date: 2026-08-30

## Added in v1.2
- One-command Ubuntu 24.04 bootstrap
- Automatic Docker Engine + Compose installation
- Automatic firewall rules for SSH/HTTP/HTTPS
- Automatic public IPv4 discovery
- Zero-registration staging hostname using `<IP>.sslip.io`
- Individual HTTPS hostnames for control, identity, apps gateway and Owner Console
- Path-based app routing fallback: `https://apps.<domain>/<project-slug>/...`
- Server readiness probe
- ARM/x86-compatible base-image contract retained

## Why this matters
The first IZAKHONO server no longer requires the owner to buy a domain, manually install Docker, or configure wildcard DNS before proving the platform. Production custom DNS and wildcard app domains are deliberately postponed until staging has passed.

## External boundary
A real Linux VM still has to exist. Account signup, payment-card verification (when a provider requires it), and VM creation are owner/provider actions that cannot be fabricated by the software.
