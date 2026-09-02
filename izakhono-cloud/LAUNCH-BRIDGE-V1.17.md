# IZAKHONO CLOUD v1.17 — Zero-Cost Launch Bridge

## Purpose

This is the bootstrap path for earning revenue before buying dedicated infrastructure.

It deliberately removes two external launch requirements from the first stage:

- Docker is **not required** to run a supported project.
- A public IPv4 address is **not required** when public traffic is carried by an outbound tunnel.

The application process remains bound to `127.0.0.1`. Public HTTPS is a separate edge/tunnel layer, so the owner machine does not need to expose the application port directly to the Internet.

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
      +--> IZAKHONO Launch Bridge
              |
              +--> 127.0.0.1:PORT
                      |
                      +--> native Node/Python/other process
```

The tunnel is a **launch bridge**, not the final IZAKHONO CLOUD independence claim. The long-term platform can later replace the edge and native runtime with IZAKHONO-owned nodes and additional runtimes without changing the customer-facing product.

## Manifest

A project uses a deterministic launch manifest:

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

## Windows one-command path

On an owner-controlled Windows machine with Python 3 installed:

```powershell
powershell -ExecutionPolicy Bypass -File .\izakhono-cloud\launch-bridge-windows.ps1 -Manifest .\path\to\launch-manifest.json -RepoRoot . -ProofOnly
```

The helper generates the deterministic plan, starts the real native process, requires the health route to pass, writes a hashed proof receipt into the Windows temporary directory, and confirms that neither Docker nor a public IP was used.

After proof, omit `-ProofOnly` to keep the application running.

## First revenue pilot: FAISReady

FAISReady is now wired as the first revenue-bearing Launch Bridge workload:

- public storefront with a limited free sample;
- server-side R299 / R399 / R549 plans;
- native Python revenue server;
- local SQLite orders, payment-event audit and entitlements;
- signed PayFast hosted checkout;
- fail-closed PayFast ITN verification before access is granted;
- 90-day / 120-day access-token enforcement;
- Quick-Tunnel public sandbox runner;
- remotely-managed named-tunnel runner with token kept out of command-line arguments;
- public HTTPS health proof receipt;
- SQLite online backup, integrity check and restore-check receipt.

The old full preparation engine is not the public storefront; it is served through the paid `/learn` route only when an active entitlement token exists.

## Public HTTPS without a public IP

For temporary sandbox testing, FAISReady can use a Quick Tunnel. Quick Tunnel URLs are temporary and must not be treated as production.

For a stable deployment, configure a remotely-managed tunnel/custom hostname to the loopback service. Tunnel tokens remain outside Git through `TUNNEL_TOKEN` or `TUNNEL_TOKEN_FILE`.

The edge runner independently calls the public `/health` endpoint before producing an edge proof receipt.

## Revenue-data recovery

The FAISReady bootstrap database can be backed up while live using SQLite's online backup API. The backup tool verifies SQLite integrity, restores into a temporary database, compares row counts and writes SHA-256 evidence. Customer/payment backups are private records and are explicitly marked as not eligible for Git commits.

## CI proof

The branch gate now verifies:

- deterministic launch plans;
- native process execution and cleanup;
- no Docker/public-IP dependency;
- Windows helper parsing;
- FAISReady revenue-server self-test;
- PayFast checkout/entitlement contract;
- edge runner secret boundary;
- backup + restore software path;
- FAISReady running through the native Launch Bridge;
- public storefront smoke path without merchant secrets;
- tampered-plan and unsafe-path rejection.

## Truth boundary

The software path is deliberately stronger than the commercial-readiness claim.

- CI does **not** prove a real owner-controlled machine.
- CI does **not** prove a real custom hostname or tunnel account.
- CI does **not** prove a real PayFast merchant transaction.
- CI does **not** prove that a real off-machine backup has been retained.
- `independent_cloud_complete=false`.
- `commercial_ready=false` until the real-world launch gates pass.

The operating strategy is revenue first: get the first product earning safely, then fund dedicated IZAKHONO nodes, replicated storage, scheduling, failover and an increasingly independent edge with revenue instead of blocking the business until the full cloud is complete.
