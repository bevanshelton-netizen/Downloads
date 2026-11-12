# IZAKHONO NODE01 Software

**NODE01 IS SOFTWARE. THE MACHINE RUNNING IT IS REPLACEABLE.**

NODE01 is IZAKHONO's stable software/runtime identity and control plane. It is not a physical server, computer, laptop, VM, cloud instance, hostname or hardware asset.

The previous execution machine has been replaced. The replacement is a separate execution environment running the same NODE01 software identity. Machine replacement does not create a new NODE01 identity. Only the separate runtime binding changes.

## Software responsibilities

NODE01 software governs the approved IZAKHONO service capabilities, including data, runtime, object, queue, auth, analytics, notification, AI gateway, code, package, CI, backup, replica, failover, DNS and edge integrations. Each capability may be implemented by a separately managed service or adapter.

The NODE01 controller binds to `127.0.0.1:8940` by default. That is a local software listen address, not NODE01's identity or the replacement machine's locator.

## Identity and execution environment

- Stable software identity: `logical_node_id: NODE01`
- Identity type: `software-runtime`
- Execution environment: recorded separately as `runtime_host`
- Required boundary: `runtime_host_is_separate: true`
- Replacing or migrating the machine changes the runtime binding only.
- Never derive NODE01's identity from `/etc/machine-id`, hostname, IP address, serial number or cloud instance ID.

## Install

On a supported Linux environment with systemd and Node.js 22.13+:

```bash
sudo bash BUILD-IZAKHONO-NODE01.sh
```

The installer installs the NODE01 software runtime and service adapters. It must preserve the software identity across environment replacement. The actual execution-environment locator must be supplied and verified separately; an unknown locator is recorded as UNBOUND, never guessed.

## Health and acceptance

```bash
curl -fsS http://127.0.0.1:8940/health
curl -fsS http://127.0.0.1:8940/v1/status
```

Local software health does not prove the execution environment binding, public DNS/TLS, or production readiness. Each requires independent evidence.

## Recovery and replacement

When an execution environment is replaced, bind the existing NODE01 software identity to the new environment, restore approved state, verify runtime and service health, and perform backup/restore and release acceptance. Do not mint a new NODE01 identity from the new machine's fingerprint.

## Hardware

Hardware is only one possible execution substrate. Hardware requirements apply to the separately managed physical environment, not to NODE01 software identity.
