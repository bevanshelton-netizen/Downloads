# IZAKHONO CLOUD v1.1 — Hardening Checkpoint

This branch records the independent IZAKHONO CLOUD v1.1 hardening candidate and its release checksum. The complete validated source package is retained as the generated release artifact rather than committing a partial archive to GitHub.

## v1.1 hardening
- protected management API
- protected Owner Console
- installer-generated owner credentials
- project/storage plan quotas
- dedicated customer runtime network
- health-gated deployment promotion
- safe rollback queue
- corrected audit writes
- identity/control abuse guards
- stronger launch-gate checks

## Release integrity
The v1.1 tarball SHA-256 is recorded in `izakhono-cloud-v1.1-hardening.tgz.sha256`.

## Launch boundary
A real Docker-capable server is still required for live-host proof. Do not describe this release as commercially live until production networking, DNS/TLS, persistence, rollback and restore gates pass.
