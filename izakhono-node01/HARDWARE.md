# NODE01 Software Runtime — Replacement Execution Environment

## Locked identity

**NODE01 IS SOFTWARE. NODE01 IS NOT A MACHINE.**

NODE01 is the stable IZAKHONO software/runtime identity. The machine previously used to execute NODE01 has been replaced. The replacement machine is a separate execution environment on which the same NODE01 software identity runs.

The replacement machine must not be called NODE01. The software remains NODE01.

## Replacement and runtime binding

- Preserve `logical_node_id: NODE01`.
- Preserve `identity_type: software-runtime`.
- Update the runtime binding to identify the replacement execution environment using its actual, verified infrastructure locator.
- Set `runtime_host_is_separate: true`.
- Do not carry forward the old machine's locator as if it still identifies the active environment.
- Do not invent or assume the replacement machine's hostname, address or provider.
- Keep execution disabled until the replacement environment's locator is verified and the required security, health, backup and acceptance checks pass.

## Reference execution-environment requirements

- Enterprise CPU capacity sized to the target workload.
- ECC memory where supported.
- Mirrored boot storage and redundant workload storage where required.
- Reliable networking and isolated management access.
- TPM-backed security and Secure Boot where available.
- Protected power and tested recovery procedures.

## Continuity rule

Replacing, migrating, scaling, restarting or losing an execution environment does not create a new NODE01 identity. A replacement environment runs the existing NODE01 software identity through an explicit runtime binding. Infrastructure asset names and logical software identities remain separate namespaces.
