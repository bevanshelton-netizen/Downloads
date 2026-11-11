# IZAKHONO BUILD ENGINE v1

Independent, reusable, owned-first build and deployment controller for IZAKHONO platforms.

## Authority

- Build/deployment authority: IZAKHONO NODE01 and IZAKHONO OWNED CLOUD.
- Source authority: IZAKHONO CODE / canonical owned source checkout.
- Build execution: disposable Linux systemd sandbox under `izakhono-ci`.
- Dependency source: IZAKHONO PACKAGE NODE where configured.
- Runtime: IZAKHONO RUNTIME NODE.
- Recovery: IZAKHONO BACKUP NODE plus four separately mounted copies.
- GitHub, Vercel and Cloudflare are not runtime or build authorities. They may remain optional source mirrors or external resilience adapters.

## One reusable pipeline

```text
Project build plan
  -> source commit pin
  -> preflight
  -> disposable sandbox build
  -> immutable release + SHA-256 manifest
  -> five-copy encrypted backup gate
  -> health-gated IZAKHONO RUNTIME activation
  -> deployment receipt
  -> controlled rollback if required
```

A failed build, backup gate or health check does not replace the active release. The runtime's activation process starts the new release and checks its health before switching the active route.

## Five independent backup copies

The backup gate requires exactly five separately mounted filesystems/failure domains:

1. Primary encrypted BACKUP NODE archive.
2. Separate physical disk.
3. Separate NAS.
4. NODE02 replica.
5. Offline rotation media.

The existing BACKUP NODE encrypts archives with AES-256-GCM, verifies authenticated decryption and writes SHA-256 sidecars for mirrors. The build engine additionally checks that all five configured targets are present, have distinct filesystem device IDs, that all four external mirrors completed, and that the primary archive passes cryptographic verification. Deployment is blocked unless all five copies pass.

The example target paths are placeholders, not claims that hardware is already mounted. Block-device targets are checked against their parent physical disks; network targets are checked against their remote source hosts. RAM-backed and overlay filesystems are not accepted. Configure actual independent storage roots in `/etc/izakhono/build-engine/five-backups.json`, then configure the four external roots in `IZAKHONO_BACKUP_MIRROR_ROOTS` in `/etc/izakhono/backup-node.env`. Each external target must be mounted at its configured root. The offline target must be attached for the backup gate to pass.

The installer registers a dedicated `owned-build-engine` encrypted backup set containing `/var/lib/izakhono-build-engine` and `/var/lib/izakhono-runtime` (including immutable releases). The backup service source allowlist must include `/var/lib/izakhono-build-engine`.

## Install

On the dedicated IZAKHONO Linux infrastructure host, after NODE01, CI WORKER, RUNTIME and BACKUP NODE are installed:

```bash
cd izakhono-build-engine
sudo bash install-linux.sh
```

Do not install the production build engine on a laptop or WSL host.

## Configure five backups

Copy the example only as a starting point; replace every path with the real mount root. Do not reuse one filesystem for multiple targets.

```bash
sudo nano /etc/izakhono/build-engine/five-backups.json
sudo nano /etc/izakhono/backup-node.env
```

Set `IZAKHONO_BACKUP_MIRROR_ROOTS` to the comma-separated paths for disk, NAS, NODE02 and offline rotation. Restart BACKUP NODE after changing its environment file:

```bash
sudo systemctl restart izakhono-backup-node
```

The dedicated `owned-build-engine` set is created by the installer; it includes the engine state and immutable runtime releases. Export the backup recovery key to a separate offline medium. Never keep the only recovery key on the primary host.

## Project plan

Copy `config/build-plan.example.json` and set:
- project ID/name and hostname;
- canonical source checkout and project subdirectory;
- pinned branch or commit;
- exact build commands and explicit network policy per command;
- runtime artifact paths;
- runtime command, environment file and health path.

Commands are argument arrays, not shell strings. Only the documented build executables are accepted. Network is disabled by default and may be enabled only for npm dependency-install steps. The npm cache persists on NODE01 and uses IZAKHONO PACKAGE NODE as its registry, reducing repeated package downloads. Build steps run with resource limits, no inherited infrastructure secrets and write access limited to the disposable workspace and package cache.

## Commands

```bash
node /opt/izakhono-build-engine/engine.mjs validate /path/to/build-plan.json
node /opt/izakhono-build-engine/engine.mjs preflight /path/to/build-plan.json
sudo node /opt/izakhono-build-engine/engine.mjs deploy /path/to/build-plan.json
sudo node /opt/izakhono-build-engine/engine.mjs status
sudo node /opt/izakhono-build-engine/engine.mjs rollback example-app
```

## Safety boundaries

- No arbitrary shell command in a project plan.
- No production deploy before all five encrypted backup copies are verified.
- No public DNS changes or payment routing changes.
- No laptop/WSL deployment target.
- No third-party build/runtime dependency.
- Secrets are read from root-owned service environment files and never placed in project build environments.
- Existing active release remains in service until the new release passes its health check.
- A successful local runtime deployment does not by itself prove public DNS/TLS or external payment readiness.

## Acceptance

Run:

```bash
npm run check
```

Then on the physical NODE01 host, complete the first controlled deployment and restore drill. Software tests cannot prove that five physical storage failure domains exist; the five-backup gate will fail closed until they are actually mounted and verified.
