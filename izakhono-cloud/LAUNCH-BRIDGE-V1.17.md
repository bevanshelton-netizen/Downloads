# IZAKHONO CLOUD v1.17 — Zero-Cost Launch Bridge

## Purpose

This is the bootstrap path for earning revenue before buying dedicated infrastructure.

It deliberately removes two external launch requirements from the first stage:

- Docker is **not required** to run a supported project.
- A public IPv4 address is **not required** when public traffic is carried by an outbound tunnel.

The app process remains bound to `127.0.0.1`. The public edge must be a separate HTTPS/tunnel layer. This keeps the owner machine from exposing the application port directly to the Internet.

## Architecture

```text
customer browser
      |
      v
public HTTPS edge / named outbound tunnel
      |
      v
owner-controlled machine
      |
      +--> 127.0.0.1:PORT
             |
             +--> native Node/Python/other process
```

The tunnel is a **launch bridge**, not the final IZAKHONO CLOUD independence claim. The long-term platform can later replace the tunnel edge and native runtime with IZAKHONO-owned nodes and OCI/container or other runtimes without changing the customer-facing product.

## Manifest

Create a project launch manifest outside secrets:

```json
{
  "schema": "izakhono.launch-bridge/v1",
  "project": "my-project",
  "workdir": "my-project",
  "command": ["npm", "run", "start"],
  "port": 18080,
  "health_path": "/health",
  "startup_timeout_seconds": 30
}
```

Rules:

- `workdir` must remain inside the repository.
- commands are argv arrays; no shell string is evaluated by the launcher.
- ports below 1024 are rejected.
- the launcher forces `HOST=127.0.0.1` and `PORT=<manifest port>` into the child environment.
- credentials, API keys, payment secrets and tunnel tokens must not be stored in the manifest or deployment plan.

## Deterministic plan

```bash
python3 izakhono-cloud/launch-bridge.py plan path/to/launch-manifest.json --out /tmp/launch-plan.json
```

The plan contains SHA-256 bindings for the manifest and plan and records the fail-closed truth boundary.

## Local execution proof

```bash
python3 izakhono-cloud/launch-bridge.py run /tmp/launch-plan.json --repo-root . --proof-only --receipt /tmp/launch-receipt.json
```

This starts the native process, requires the loopback health endpoint to pass, creates a hashed receipt, and then shuts the proof process down.

A successful proof receipt records:

- `local_health_passed=true`
- `docker_used=false`
- `public_ip_used=false`
- `public_https_verified=false`
- `commercial_ready=false`

## Run the app

After the proof succeeds:

```bash
python3 izakhono-cloud/launch-bridge.py run /tmp/launch-plan.json --repo-root . --receipt /tmp/live-launch-receipt.json
```

The launcher stays attached to the app process. A later service wrapper can supervise it automatically on Windows or Linux.

## Public HTTPS without a public IP

For the bootstrap phase, use a **named outbound tunnel** from the public HTTPS edge to `http://127.0.0.1:<port>`.

The production hostname must be a domain under owner control. Tunnel credentials stay on the owner machine and are never committed to GitHub.

Do not use a random/quick development tunnel as the production storefront. The production route needs a stable named tunnel and custom hostname, followed by an external HTTPS health verification.

## Revenue-first truth boundary

This layer is intentionally narrower than full IZAKHONO CLOUD:

- it can run a real customer-facing app without Docker;
- it can be published without a public IP using an outbound tunnel;
- it preserves deterministic plans and receipts;
- it does **not** prove independent infrastructure ownership;
- it does **not** claim HA, automatic failover, independent edge ownership or commercial cloud GA.

The immediate business goal is to get the first monetizable product online safely, collect revenue, and use revenue to fund the first dedicated IZAKHONO nodes. The infrastructure can then migrate behind the same product/domain without rebuilding the business.
