# IZAKHONO Sovereign Node — ISN-01 Activation

## Official naming

- **Platform:** IZAKHONO SOVEREIGN NODE
- **First node:** ISN-01
- **Future multi-node fabric:** IZAKHONO SOVEREIGN GRID
- **Management plane:** IZAKHONO OWNER CONSOLE

The existing internal term **owner-node** remains a compatibility/protocol role. It is not the product name.

## What activation means

ISN-01 activation is deliberately fail-closed. Native owner nodes use the existing `/var/lib/izakhono-cloud/READY` marker. A Windows/WSL laptop uses the reviewed local proof path and `/var/lib/izakhono-cloud/LOCAL_READY`; that local marker can never be interpreted as public production readiness.

The activation command verifies:

1. the appropriate genuine activation marker exists (`READY` for native owner nodes, `LOCAL_READY` for Windows/WSL local proof);
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


## Windows dedicated-laptop one-click path

The repository now includes:

- `START-ISN-01.cmd` — pinned Windows launcher;
- `izakhono-cloud/ACTIVATE-ISN-01-WINDOWS.ps1` — self-elevating automation.

The Windows automation performs the following without requiring the operator to manually assemble the Linux commands:

1. checks for at least 8 GB RAM and 40 GB free space;
2. installs or validates WSL and Ubuntu 24.04;
3. if Windows requires a restart, registers a one-time resume task and continues after the next sign-in;
4. runs the immutable owner-node bootstrap under Ubuntu;
5. converts the private WSL proof to `LOCAL_READY` rather than leaving a production `READY` marker;
6. pulls the pinned reviewed control plane and current KORA source;
7. builds the secret-free KORA handoff;
8. runs the KORA Docker health/isolation proof;
9. writes `/var/lib/izakhono-cloud/SOVEREIGN-NODE.json`;
10. copies that receipt to `%ProgramData%\IZAKHONO\ISN-01\SOVEREIGN-NODE.json`.

Successful laptop proof must record:

- `machine_proof_context=owner_machine_local_candidate`
- `activation_marker_kind=LOCAL_READY`
- `workload_project=kora-network`
- `workload_proof=verified`
- `public_ready=false`
- `commercial_ready=false`

The laptop is therefore allowed to prove owner-controlled compute and workload execution locally, but it is not allowed to self-promote to public production. Public ingress and external HTTPS verification remain separate gates.
