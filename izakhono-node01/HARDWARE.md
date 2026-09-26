# NODE01 Hardware Profile

NODE01 is software-defined and can move between machines without changing application contracts.

## Development / proof node

- 4 modern CPU cores
- 16 GB RAM
- 512 GB SSD
- gigabit Ethernet
- UPS strongly recommended

## Primary production NODE01

- 8 to 16 modern CPU cores
- 32 to 64 GB RAM
- 2 x enterprise or high-endurance NVMe drives, mirrored
- 2 TB usable storage or more
- gigabit or faster wired networking
- hardware-backed TPM where available
- UPS with graceful-shutdown support
- separate external/NAS backup target
- stable public connectivity

## Expansion

GPU workloads should move to a dedicated IZAKHONO GPU COMPUTE NODE when they begin competing with transactional workloads. Backups and replicas should live on physically separate media or hosts.

A second production machine should become NODE02/standby rather than adding every workload to NODE01 indefinitely.
