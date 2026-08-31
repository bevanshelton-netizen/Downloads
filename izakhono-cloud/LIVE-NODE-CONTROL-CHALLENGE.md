# IZAKHONO CLOUD v1.14 — Live node-control challenge

This layer adds a short-lived challenge/response ceremony between the separate v1.13 verifier identity and the owner node identity.

## What it proves

When the ceremony is run in real time on separate machines, the verifier can prove that the party answering the challenge possessed the private key for the exact `izn-*` node during the challenge window. The final receipt is signed by the distinct `izv-*` verifier and is bound to the v1.13 external receipt, v1.12 attestation, runtime proof, challenge and node response by SHA-256.

The final verification level is:

`live_node_key_control_verified`

## What it does not prove

Cryptographic possession of the node private key is not the same as proving physical ownership or physical presence. A key could theoretically be copied or accessed remotely. Therefore v1.14 deliberately keeps these fields false:

- `physical_presence_independently_witnessed=false`
- `physical_ownership_independently_verified=false`
- `independent_hardware_verified=false`
- `public_ready=false`
- `commercial_ready=false`

No PR in this chain should be promoted merely because the CI ceremony passes.

## Proof chain

1. v1.11: real Docker runtime proof.
2. v1.12: node-signed owner-hardware self-attestation.
3. v1.13: separate verifier cryptographic receipt.
4. v1.14: short-lived verifier challenge answered by the target node key.

## Separate-machine ceremony

On the verifier machine, with the v1.13 verifier state available locally:

```bash
python3 izakhono-cloud/live-control-challenge.py issue-challenge \
  --receipt external-verifier-receipt.json \
  --attestation owner-attestation.json \
  --runtime-proof runtime-proof.json \
  --verifier-tool izakhono-cloud/independent-verifier.py \
  --verifier-state-dir /secure/verifier-state \
  --output live-challenge.json \
  --ttl-minutes 5
```

Transfer only `live-challenge.json` to the owner node. Do not transfer verifier private keys.

On the target owner node:

```bash
python3 izakhono-cloud/live-control-challenge.py respond live-challenge.json \
  --node-state-dir /var/lib/izakhono-cloud/node \
  --output live-response.json
```

Transfer only `live-response.json` back to the verifier. Do not export the node private key.

On the verifier machine:

```bash
python3 izakhono-cloud/live-control-challenge.py finalize \
  --challenge live-challenge.json \
  --response live-response.json \
  --receipt external-verifier-receipt.json \
  --attestation owner-attestation.json \
  --runtime-proof runtime-proof.json \
  --verifier-tool izakhono-cloud/independent-verifier.py \
  --verifier-state-dir /secure/verifier-state \
  --output live-control-verification.json
```

A second verifier can validate the final receipt without either private key:

```bash
python3 izakhono-cloud/live-control-challenge.py verify-final \
  live-control-verification.json \
  --challenge live-challenge.json \
  --response live-response.json \
  --external-receipt external-verifier-receipt.json \
  --attestation owner-attestation.json \
  --runtime-proof runtime-proof.json
```

## Security boundaries

- Challenges expire after at most 15 minutes.
- The challenge is signed by the v1.13 verifier identity.
- The response is signed by the exact target node identity.
- The final receipt is signed by the verifier and hash-binds every proof input.
- Private keys remain local to their respective machines.
- No bank/card information, passwords or private keys belong in proof packets, source control or chat.
- This protocol does not open a network listener or enable remote shell access.

## Next physical boundary

The remaining physical-control step requires an actual independent witness or equivalent owner-controlled physical verification process. That event cannot be manufactured by CI or inferred from a cryptographic challenge alone.
