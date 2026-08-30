# IZAKHONO CLOUD v1.1 — Source Checkpoint

This branch carries the independent IZAKHONO CLOUD v1.1 hardening candidate.

## Restore source

```bash
bash unpack-izakhono-cloud-v1.1.sh
```

The script restores the complete source tree and runs the launch gate.

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

A real Docker-capable server is still required for live-host proof. Do not describe this release as commercially live until production networking, DNS/TLS, persistence, rollback and restore gates pass.
