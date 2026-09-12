# IZAKHONO Engine — ISN-01 Real-Machine Proof

This bridge uses the already-established **IZAKHONO SOVEREIGN NODE — ISN-01** identity and adds a real-machine proof of the new IZAKHONO Engine scheduler/agent path.

## What it proves

The Windows launcher verifies the existing sovereign-node receipt, then uses Ubuntu 24.04 under WSL to:

1. check Docker, Node.js, Git and curl;
2. fetch the pinned IZAKHONO Containers/Engine implementation;
3. start the control plane on loopback only;
4. register ISN-01 using an ephemeral local enrollment token;
5. schedule a disposable `nginx:alpine` workload to ISN-01;
6. let the Engine agent pull and start the image;
7. verify HTTP health on `127.0.0.1:8088`;
8. write `%ProgramData%\IZAKHONO\ISN-01\ENGINE-PROOF.json`.

## Run

Double-click:

`START-IZAKHONO-ENGINE-ISN-01.cmd`

## Safety boundary

This proof is deliberately local-only. It does not change DNS, expose port 8080, create a stable public hostname, enable payments, or claim production/commercial readiness.

Expected receipt values include:

- `node_name=ISN-01`
- `proof_context=owner_machine_local_loopback`
- `scheduler_dispatch=true`
- `image_pull=true`
- `container_start=true`
- `http_health=true`
- `public_ready=false`
- `commercial_ready=false`

The next gate after a verified receipt is private-network control-plane hardening with TLS/mTLS and durable state.
