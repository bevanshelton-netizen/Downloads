# IZAKHONO CLOUD v1.11 — Runtime Proof Harness

v1.11 closes the gap between a fake-runtime CI rehearsal and an actual container engine exercise, without overstating what GitHub-hosted CI proves.

## What the harness proves

The harness drives the v1.9 signed workload and v1.10 local-execution path through a real Docker engine. It verifies:

- an immutable image digest is used
- the workload is signed and verified
- the local node signs a short-lived execution permit
- execution is bound to the exact node, workload and bundle hash
- Docker receives read-only root filesystem, network none, cap-drop ALL, no-new-privileges, PID, CPU and RAM limits
- no host binds or published ports are present
- the proof container can be rolled back and is absent afterwards

## CI mode

```bash
bash izakhono-cloud/runtime-proof-harness.sh ci
```

CI mode may pull Alpine only when the runner has no suitable local digest. It exercises a real Docker daemon on GitHub-hosted infrastructure.

This is useful runtime evidence, but it is **not** proof of owner-controlled hardware. The proof file therefore always records:

- `owner_controlled_hardware_verified=false`
- `public_ready=false`
- `commercial_ready=false`
- `requires_independent_owner_hardware_attestation=true`

## Owner-node mode

After an owner-controlled Ubuntu 24.04 node has produced `/var/lib/izakhono-cloud/READY`, run locally on that machine:

```bash
sudo bash izakhono-cloud/runtime-proof-harness.sh owner
```

Owner mode does not automatically pull an image. It uses a locally available repository digest, or a digest explicitly supplied through `IZAKHONO_PROOF_IMAGE_DIGEST`.

Running the harness locally is the explicit activation for this one proof. It temporarily writes `ALLOW_LOCAL_EXECUTION=enabled=true`, executes one tightly constrained proof workload, verifies Docker isolation, rolls the container back, then restores the previous activation state.

The resulting sanitized proof JSON is written under:

```text
/var/lib/izakhono-cloud/proofs/runtime/
```

Private controller and node keys are never copied into the proof JSON. The temporary proof-controller private key is deleted when the harness exits.

## Truth boundary

Even in owner mode, the script cannot independently establish legal or physical ownership of the computer. It can prove that the invocation occurred on a node carrying the READY marker and that a real Docker runtime executed and rolled back the isolated workload. Independent owner-hardware attestation remains a separate gate.

v1.11 does not enable network listeners, remote shell access, automatic scheduler-to-runtime execution, failover, public readiness or commercial readiness.
