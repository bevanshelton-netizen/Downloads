# IZAKHONO CLOUD v1.10 — Controlled Local Execution Candidate

v1.10 is the first layer that contains a real local container execution path, but it remains deliberately constrained and **is not a production-ready or public-ready claim**.

## Purpose

The scheduler and signed workload layers can now hand a specific owner-controlled node an immutable, controller-signed workload. v1.10 adds a local execution permit that the node signs with its own ED25519 identity before any container runtime is allowed to start the workload.

## Required gates

Execution is blocked unless all of the following are true:

- the node has a v1.6 identity whose public-key fingerprint matches its node ID
- `/var/lib/izakhono-cloud/READY` exists; `LOCAL_READY` alone is not enough
- `/var/lib/izakhono-cloud/ALLOW_LOCAL_EXECUTION` exists and contains exactly `enabled=true`
- the v1.9 workload signature verifies
- the signed workload targets this exact node ID
- the image is immutable and pinned by SHA-256 through the v1.9 contract
- the workload stays within the v1.10 proof limits: <= 1 CPU, <= 512 MB RAM, <= 64 MB ephemeral disk
- no ports are published
- privileged mode, host networking and host mounts are forbidden
- root filesystem remains read-only
- the node-created execution permit is valid, unexpired, single-use and bound to the exact workload bundle SHA-256

## Isolation used by the candidate executor

The generated container runtime command uses:

- `--read-only`
- `--network none`
- `--cap-drop ALL`
- `--security-opt no-new-privileges:true`
- `--pids-limit 128`
- explicit CPU and memory limits
- a small no-exec/no-suid `/tmp` tmpfs
- no host mounts
- no published ports

No shell interpolation is used for workload values; runtime arguments are passed as an argument vector.

## Explicit local activation

There is no network listener and no remote shell. The execution path can only be entered locally and requires the explicit `--execute-local` flag in addition to the root-owned activation file.

Without `--execute-local`, the tool only prints the validated execution plan and reports `execution_performed=false`.

## Rollback

A started proof container receives a deterministic execution ID. The rollback command removes that exact container and records `state=rolled_back_local`.

If container creation or start fails, the executor attempts immediate removal before failing closed.

## Truth boundary

v1.10 may prove that the code can perform a tightly isolated local container lifecycle. It does **not** prove the owner hardware, router, public internet path, storage durability, multi-node failover or commercial service are ready.

The following remain false until separate real-machine gates pass:

- `public_ready=false`
- `commercial_ready=false`
- `automatic_failover=false`
- no remote execution service
- no automatic scheduler-to-runtime execution

CI may use a fake container runtime to prove argument construction, authorization, replay protection and rollback logic. That is a software-path test, not proof that a real owner-controlled Docker host has executed the workload.

## Real-node proof requirement

Before v1.10 can be promoted beyond draft status, an owner-controlled Ubuntu 24.04 machine must independently show:

1. real `READY`
2. local activation performed on that machine
3. signed workload and node-signed permit verification
4. execution through the real Docker runtime
5. resource/isolation flags confirmed on the created container
6. successful rollback
7. no public-ready or commercial-ready claim inferred from that local proof
