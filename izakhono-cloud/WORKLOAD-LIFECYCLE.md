# IZAKHONO CLOUD v1.9 — Signed Workload Lifecycle

This stage adds a signed workload contract and a reversible lifecycle rehearsal without starting a real workload.

## Security properties
- controller signs every workload manifest with ED25519
- image references must be immutable `@sha256:<digest>` values
- privileged mode is forbidden
- host networking is forbidden
- host mounts are forbidden
- root filesystem must remain read-only
- low privileged ports are not accepted by this candidate
- a workload is targeted to exactly one IZAKHONO node ID
- staging requires that node to already have `READY` or `LOCAL_READY`
- signature or manifest tampering is rejected

## Lifecycle
`sign -> verify -> stage -> rehearse -> rollback`

The lifecycle records state transitions under an owner-controlled node. `stage` and `rehearse` do not start containers, processes or VMs. `rollback` records a reversible rollback state.

## Truth boundary
The following are fixed in v1.9:

- `execution_allowed=false`
- `remote_execution=false`
- `automatic_failover=false`
- `public_ready=false`

The `apply` operation always fails closed. Real workload execution remains blocked until a real owner-controlled machine passes a separate execution proof gate. A CI rehearsal is not proof that a production workload has run.

## Why this layer exists
The scheduler can now hand off a deterministic placement proposal to a cryptographically signed workload contract. The next real-machine stage can therefore prove execution without allowing an unsigned, mutable or privileged workload to bypass the control plane.
