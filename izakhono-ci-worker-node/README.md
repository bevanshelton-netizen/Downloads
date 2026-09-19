# IZAKHONO CI WORKER NODE

Owned continuous-integration worker for IZAKHONO CODE.

## V1 capabilities

- pipeline registration;
- CODE NODE repository cloning with encrypted read tokens;
- QUEUE NODE-backed build scheduling and retry;
- commit-SHA pinning;
- command-array steps with an executable allowlist;
- no shell interpolation;
- HMAC-verified CODE push webhook trigger;
- per-step status and logs;
- disposable workspaces;
- infrastructure-secret stripping from build environments;
- production systemd sandbox execution;
- network disabled by default per pipeline;
- memory, CPU and runtime limits;
- SQLite WAL metadata;
- zero runtime npm dependencies.

## Production sandbox

Production defaults to `IZAKHONO_CI_EXECUTOR=systemd`.

Each build step is launched as the dedicated `izakhono-ci` account with transient systemd restrictions including:

- `NoNewPrivileges=yes`
- `PrivateTmp=yes`
- `ProtectSystem=strict`
- `ProtectHome=yes`
- `PrivateDevices=yes`
- `RestrictSUIDSGID=yes`
- `LockPersonality=yes`
- workspace-only write access
- memory / CPU / runtime limits
- `PrivateNetwork=yes` unless that pipeline explicitly enables network access

CI itself runs as a root control service because creating transient sandbox units and changing ownership of disposable workspaces requires host authority. Repository code does **not** run as root.

## Secrets

Repository clone tokens are AES-256-GCM encrypted in CI metadata.

Build processes receive a minimal environment: PATH, HOME, locale and CI markers. QUEUE, CODE, AUTH, DATA, AI, NOTIFY, backup and CI administration secrets are not forwarded into repository processes.

## Webhook flow

CODE NODE push webhook → CI WORKER signature verification → QUEUE NODE job → disposable clone → sandboxed steps → run status/log.

## CI test mode

The repository self-test uses an explicit `direct-test` executor because GitHub-hosted runners do not provide a controllable systemd host for transient-unit proof. That executor is hard-blocked unless both `NODE_ENV=test` and the explicit unsafe-test acknowledgement are present.

The **production installer never enables direct-test mode**. Final systemd sandbox proof must be performed on the first IZAKHONO-controlled Linux node.

## PACKAGE NODE integration

When `IZAKHONO_PACKAGE_URL` is configured, CI injects `NPM_CONFIG_REGISTRY` into build steps. npm commands in network-enabled pipelines resolve package metadata and tarballs through IZAKHONO PACKAGE NODE. Fully network-isolated pipelines remain isolated and cannot reach the host-local mirror.

## Boundaries

V1 is CI, not a public multi-tenant build farm. Treat pipeline creation as an administrative operation. Network-enabled builds remain explicit because PACKAGE NODE reduces registry dependence but does not itself firewall every other outbound destination.
