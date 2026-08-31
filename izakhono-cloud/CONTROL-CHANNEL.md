# IZAKHONO CLOUD v1.7 — Authenticated Controller-to-Node Channel

v1.7 establishes a cryptographically authenticated control path between an IZAKHONO controller and enrolled owner-controlled nodes.

This is intentionally **not** remote shell, workload scheduling, failover or public-production promotion.

## What v1.7 proves

- the controller has its own locally generated ED25519 identity
- each command envelope is signed by the controller
- nodes trust only an explicitly pinned controller public key
- commands are addressed to one specific node ID
- command validity is time-limited to a maximum of 15 minutes
- each command carries a random nonce and unique command ID
- nodes reject expired commands, wrong-target commands, altered signatures and untrusted controller keys
- a node records each accepted command ID once and rejects replay
- the node signs an acknowledgement with its existing v1.6 node identity
- the controller can verify that acknowledgement against the enrolled node public key
- neither private key is exported

## Allowed actions

v1.7 recognizes only:

- `status`
- `inventory`
- `health`

Even these are acknowledged as `verified_not_executed`. The control channel proves identity, integrity, targeting, expiry and replay protection before any later execution layer is considered.

Every v1.7 command and acknowledgement must retain:

- `remote_execution=false`
- `schedulable=false`
- `public_ready=false`

## Controller trust

Controller trust is explicit rather than discovered automatically. On an owner-controlled node, copy the controller **public** key through an owner-approved path and run:

```bash
sudo ./pin-controller.sh /path/to/controller-public.pem
```

The node refuses silent replacement by a different controller key.

Never copy a controller private key to a node. Never paste controller or node private keys into chat, GitHub, logs or tickets.

## Command lifecycle

1. Controller generates or validates its ED25519 identity.
2. Controller creates a short-lived signed command for one node ID.
3. Transport moves the JSON envelope to that node. v1.7 is transport-neutral and does not open a network listener.
4. Node verifies the pinned controller key, signature, target, validity window and safety flags.
5. Node atomically claims the command ID to prevent replay.
6. Node creates a signed acknowledgement with status `verified_not_executed`.
7. Controller verifies the acknowledgement against the node public key already admitted by v1.6 enrollment.

## Why there is no listener yet

Opening a public control port before we have real-machine trust, firewall and certificate proof would create unnecessary attack surface. v1.7 therefore establishes the authentication protocol first. A later transport can carry the signed envelopes over mutually authenticated TLS or another owner-controlled secure channel without changing the trust model.

## Promotion boundary

A successful v1.7 test proves authenticated command exchange only. It does **not** prove:

- remote workload execution
- container scheduling
- replication
- failover
- high availability
- internet reachability
- public HTTPS correctness
- commercial readiness

Those remain separate gated milestones on real owner-controlled machines.
