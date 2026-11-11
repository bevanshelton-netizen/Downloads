# NODE01 Software Runtime — Hardware Requirements

NODE01 is the stable IZAKHONO software/runtime identity. It is not a machine, server, laptop, VM, hostname or hardware asset. The following describes an optional execution environment on which the software may run.

## Reference execution environment
- Enterprise CPU capacity sized to the target workload.
- ECC memory where supported; 128 GB baseline for a larger production profile.
- Mirrored boot storage and redundant workload storage.
- Redundant networking and isolated management access.
- TPM-backed security and Secure Boot where available.
- Protected power and tested recovery procedures.

## Binding and scaling
Record the actual infrastructure locator in the runtime-binding record. Keep it separate from `logical_node_id: NODE01`. A second execution environment may provide standby, failover or workload capacity; do not name it NODE02 merely because it is a second physical machine. Logical software identities and infrastructure asset names are separate namespaces.

Hardware procurement, migration, replacement or loss does not alter NODE01's software identity.
