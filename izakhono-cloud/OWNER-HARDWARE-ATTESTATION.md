# IZAKHONO CLOUD v1.12 — Owner Hardware Attestation

This layer binds a **real Docker runtime proof** to the IZAKHONO node identity and a sanitized snapshot of the machine that produced it.

It exists to make the physical-host handoff auditable without copying private keys, passwords, card details, MAC addresses, serial numbers or other unnecessary identifiers into proof files.

## What the packet proves

The generated attestation is signed by the node's existing ED25519 private key and contains only:

- node ID derived from the node public key
- SHA-256 of the runtime-proof JSON
- runtime proof scope
- operating system
- CPU architecture and logical CPU count
- total memory
- free root-filesystem space
- Docker server version
- an explicit owner-control claim when the owner chooses to make it

The node private key stays on the node.

## What it does **not** prove

A signed self-attestation is not independent physical-hardware verification. Therefore every v1.12 packet is fixed to:

- `verification_level=self_attested`
- `independent_hardware_verified=false`
- `public_ready=false`
- `commercial_ready=false`

A third party, separate owner-side verifier, or an independently witnessed test is still required before the project may claim independent owner-hardware proof.

## Owner-node flow

First run the v1.11 owner runtime harness on a READY Ubuntu node:

```bash
sudo bash izakhono-cloud/runtime-proof-harness.sh owner
```

That creates a sanitized runtime proof below `/var/lib/izakhono-cloud/proofs/runtime/`.

Then bind that proof to the node identity:

```bash
sudo python3 izakhono-cloud/owner-attestation.py create \
  --runtime-proof /var/lib/izakhono-cloud/proofs/runtime/<runtime-proof.json> \
  --node-state-dir /var/lib/izakhono-cloud/node \
  --output /var/lib/izakhono-cloud/proofs/owner-hardware-attestation.json \
  --owner-control-claim
```

Verify the packet and its runtime-proof binding:

```bash
python3 izakhono-cloud/owner-attestation.py verify \
  /var/lib/izakhono-cloud/proofs/owner-hardware-attestation.json \
  --runtime-proof /var/lib/izakhono-cloud/proofs/runtime/<runtime-proof.json>
```

## Truth boundary

The `--owner-control-claim` switch records the owner's assertion that the machine is under their control. It does not transform that assertion into independent evidence.

Until an independently verified owner-controlled machine passes the chain, PRs in this sequence remain Draft and no public/commercial readiness claim is allowed.
