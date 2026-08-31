# IZAKHONO CLOUD v1.13 external verifier

This layer lets a second machine or verifier identity cryptographically verify a v1.12 owner-hardware attestation and the exact runtime-proof file it references, then issue a separately signed verification receipt.

It does **not** prove who physically owns or controls the machine. The receipt therefore remains:

- `verification_level=external_cryptographic_verification`
- `hardware_control_independently_witnessed=false`
- `independent_hardware_verified=false`
- `public_ready=false`
- `commercial_ready=false`

## Why this layer exists

The owner node already signs its sanitized attestation. v1.13 adds a distinct verifier key so a second system can prove that it independently checked:

- the node signature;
- the node/public-key fingerprint;
- the exact runtime-proof SHA-256 binding;
- real container-runtime evidence;
- isolation and rollback evidence;
- the readiness truth boundary;
- that the verifier key is different from the owner-node key.

## External verification

On a separate verifier machine, keep the verifier private key local and run:

```bash
python3 izakhono-cloud/independent-verifier.py issue \
  --attestation owner-attestation.json \
  --runtime-proof runtime-proof.json \
  --owner-attestation-tool izakhono-cloud/owner-attestation.py \
  --verifier-state-dir ./verifier-state \
  --output verifier-receipt.json
```

Then verify the resulting receipt without the verifier private key:

```bash
python3 izakhono-cloud/independent-verifier.py verify verifier-receipt.json \
  --attestation owner-attestation.json \
  --runtime-proof runtime-proof.json
```

The receipt contains only the verifier public key and safe proof metadata. Do not copy private node or verifier keys into GitHub, chat, logs or proof packets.

## What remains before independent hardware verification

A real independent witness must still establish that the attested machine is genuinely owner-controlled and that the runtime proof was produced on that physical machine. Software running on the same machine cannot prove physical ownership by itself.

Only after that separate witnessed step should a future layer consider `independent_hardware_verified=true`. v1.13 cannot set it.
