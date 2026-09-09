# IZAKHONO Sovereign Node — ISN-01 Activation

## Official naming

- **Platform:** IZAKHONO SOVEREIGN NODE
- **First node:** ISN-01
- **Future multi-node fabric:** IZAKHONO SOVEREIGN GRID
- **Management plane:** IZAKHONO OWNER CONSOLE

The existing internal term **owner-node** remains a compatibility/protocol role. It is not the product name.

## What activation means

ISN-01 activation is deliberately fail-closed. It does **not** create or fake the existing `/var/lib/izakhono-cloud/READY` marker. That marker must already have been produced by the reviewed owner-node bootstrap/proof path.

The activation command verifies:

1. the genuine READY marker exists;
2. the local Docker engine responds;
3. the machine is recorded as **ISN-01** in a persistent sovereign-node identity receipt;
4. when a KORA handoff directory is supplied, the reviewed KORA owner-node proof runs and its cutover receipt is hashed into the ISN-01 identity.

It does **not** change DNS, enable public ingress, issue TLS certificates, enable payments, or claim commercial readiness.

## Real owner-machine command

After the reviewed bootstrap has created `/var/lib/izakhono-cloud/READY` and the KORA handoff ZIP has been extracted:

```bash
sudo python3 izakhono-cloud/activate-isn-01.py \
  --handoff /path/to/kora-owner-node-handoff
```

Successful workload proof writes:

```
/var/lib/izakhono-cloud/SOVEREIGN-NODE.json
```

The expected safe state is:

- `node_name=ISN-01`
- `platform_name=IZAKHONO SOVEREIGN NODE`
- `workload_project=kora-network`
- `workload_proof=verified`
- `public_ready=false`
- `commercial_ready=false`

## Next gate after ISN-01 workload proof

Only after the real machine produces the verified identity receipt should we proceed to the existing reversible public-ingress path and independent external HTTPS verification. The current Vercel/Supabase route remains intact until that proof passes.

This naming layer changes identity and operator clarity, not the security boundary.
