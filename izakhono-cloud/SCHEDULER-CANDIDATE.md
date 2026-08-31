# IZAKHONO CLOUD v1.8 — Scheduler Candidate

This stage adds deterministic workload-placement **proposals** across verified owner-controlled IZAKHONO nodes.

## What it can do
- inspect a supplied set of candidate node facts
- require signed-enrollment verification and authenticated-controller status
- require READY/LOCAL_READY-derived proof state
- require healthy nodes that still explicitly say `schedulable=false` and `public_ready=false`
- filter by architecture, labels, CPU, memory and disk requirements
- choose one deterministic best-fit candidate
- emit an auditable placement proposal

## What it cannot do
It cannot deploy, start, stop, migrate or fail over a workload. It does not open a network listener or remote shell. It does not promote a node to schedulable or public-ready.

Every result remains:

```text
decision_state=proposal
execution_allowed=false
remote_execution=false
automatic_failover=false
public_ready=false
requires_real_node_proof=true
```

## Why this is separated from execution
Selection logic can be tested safely in CI with synthetic node inventories. Actual execution would change real machines and therefore needs a later promotion gate based on real owner-controlled nodes, resource telemetry, signed commands, rollback and recovery proof.

## Candidate selection
Only nodes meeting all of these conditions are considered:
- valid `izn-*` identity
- `signature_verified=true`
- `controller_authenticated=true`
- `trust_state=candidate`
- proof state is `local_ready` or `runtime_ready`
- `healthy=true`
- `schedulable=false`
- `public_ready=false`
- sufficient CPU, memory and disk
- matching architecture and required labels

The candidate with the highest deterministic residual-capacity score is proposed. Ties are resolved by node ID to ensure repeatable decisions.

## Truth boundary
Passing this stage means the scheduler can make a safe, reproducible placement recommendation from trusted candidate facts. It does **not** mean a workload has run anywhere, that failover exists, or that IZAKHONO CLOUD is commercially live.
