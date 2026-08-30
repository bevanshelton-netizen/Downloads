# IZAKHONO CLOUD v1.3 — Production Proof Hardening

Date: 2026-08-30

## Added
- strict readiness: failures now stop bootstrap instead of being reported as success
- dependency readiness for PostgreSQL and MinIO through Control `/api/ready`
- Identity database readiness endpoint
- verified custom-format PostgreSQL backups with SHA-256 sidecars
- checksum + archive validation before restore
- verified pre-restore checkpoint and deterministic clean restore
- customer workload CPU, memory and PID guardrails
- no-new-privileges, capability drop and isolated tmpfs defaults
- GitHub URL, branch and Dockerfile path validation
- Dockerfile repository-boundary enforcement in the runner
- production proof script for services, HTTPS, runtime network and backup archive integrity

## External boundary
A real Docker-capable Linux VM is still required to execute the live-host proof. Until `production-proof.sh` passes there, this release remains a launch candidate rather than commercial GA.
