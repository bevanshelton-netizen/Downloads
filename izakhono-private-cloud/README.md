# IZAKHONO Private Cloud

Permanent owned-compute target for IZAKHONO.

Architecture:
Dedicated physical server -> Ubuntu LTS hypervisor -> KVM/libvirt -> isolated IZAKHONO runtime VMs -> Autonomy Engine / Infrastructure Executor -> platform-specific engines.

The laptop is administration-only and is never a hypervisor, runtime, ingress, worker, scheduler, payment processor or availability dependency.

## NODE01 baseline
Recommended starting hardware: x86-64 CPU with hardware virtualization, 64 GB ECC RAM where practical, mirrored enterprise NVMe/SSD storage, dual NICs, UPS and reliable business fibre. Add NODE02 for failover before treating a single premises as highly available.

## Safety
No production-live claim is created by these scripts. PAY remains subject to its existing independent HTTPS, FORTRESS and iKhokha verification gates. Secrets are not committed. External resilience remains reversible and may remain active during migration.
